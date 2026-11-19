/**
 * Spotify Auth — PKCE Flow (100% client-side)
 */
const SpotifyAuth = (() => {
  const SCOPES = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
    'user-read-email'
  ].join(' ');

  const TOKEN_KEY = 'unboard_spotify_token';
  const VERIFIER_KEY = 'unboard_code_verifier';
  const CLIENT_ID_KEY = 'unboard_client_id';
  const REDIRECT_URI_KEY = 'unboard_redirect_uri';
  const ACTIVE_REDIRECT_KEY = 'unboard_active_redirect_uri';

  function getClientId() {
    return localStorage.getItem(CLIENT_ID_KEY) || '';
  }

  function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id.trim());
  }

  function getDefaultRedirectUri() {
    const cleanPath = window.location.pathname.replace(/index\.html$/i, '');
    return window.location.origin + (cleanPath.endsWith('/') ? cleanPath : cleanPath + '/');
  }

  function getRedirectUri() {
    const saved = localStorage.getItem(REDIRECT_URI_KEY);
    if (saved) return saved.trim();
    return getDefaultRedirectUri();
  }

  function setRedirectUri(uri) {
    if (uri && uri.trim()) {
      localStorage.setItem(REDIRECT_URI_KEY, uri.trim());
    } else {
      localStorage.removeItem(REDIRECT_URI_KEY);
    }
  }

  // ---- PKCE helpers ----
  function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  function base64urlencode(buffer) {
    let str = '';
    const bytes = new Uint8Array(buffer);
    for (const byte of bytes) {
      str += String.fromCharCode(byte);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // ---- Auth Flow ----
  async function login() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error(I18n.t('errConfigureClientId'));
    }

    const codeVerifier = generateRandomString(64);
    localStorage.setItem(VERIFIER_KEY, codeVerifier);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const redirectUri = getRedirectUri();
    localStorage.setItem(ACTIVE_REDIRECT_KEY, redirectUri);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(I18n.t('errAuth', { err: error }));
    }

    if (!code) return false;

    const codeVerifier = localStorage.getItem(VERIFIER_KEY);
    const clientId = getClientId();

    if (!codeVerifier || !clientId) {
      throw new Error(I18n.t('errMissingAuthData'));
    }

    const redirectUri = localStorage.getItem(ACTIVE_REDIRECT_KEY) || getRedirectUri();

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(I18n.t('errToken', { err: err.error_description || err.error }));
    }

    const data = await response.json();

    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.removeItem(VERIFIER_KEY);

    // Limpa a URL
    window.history.replaceState({}, document.title, window.location.pathname);

    return true;
  }

  async function refreshToken() {
    const tokenData = getTokenData();
    const clientId = getClientId();

    if (!tokenData?.refresh_token || !clientId) {
      logout();
      return false;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      });

      if (!response.ok) {
        logout();
        return false;
      }

      const data = await response.json();

      const newTokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokenData.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };

      localStorage.setItem(TOKEN_KEY, JSON.stringify(newTokenData));
      return true;
    } catch {
      logout();
      return false;
    }
  }

  function getTokenData() {
    try {
      return JSON.parse(localStorage.getItem(TOKEN_KEY));
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    const tokenData = getTokenData();
    if (!tokenData) return null;

    // Refresh se falta menos de 5 min
    if (Date.now() > tokenData.expires_at - 300000) {
      const refreshed = await refreshToken();
      if (!refreshed) return null;
      return JSON.parse(localStorage.getItem(TOKEN_KEY)).access_token;
    }

    return tokenData.access_token;
  }

  function isLoggedIn() {
    const data = getTokenData();
    return data && data.access_token;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(VERIFIER_KEY);
  }

  return {
    getClientId,
    setClientId,
    getRedirectUri,
    setRedirectUri,
    login,
    handleCallback,
    getAccessToken,
    isLoggedIn,
    logout,
  };
})();
