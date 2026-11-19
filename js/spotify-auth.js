/**
 * Spotify Auth — OAuth 2.0 PKCE Flow (100% client-side, user-supplied Client ID)
 */
const SpotifyAuth = (() => {
  const SCOPES = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
  ].join(' ');

  const TOKEN_KEY = 'unboard_spotify_token';
  const VERIFIER_KEY = 'unboard_code_verifier';
  const STATE_KEY = 'unboard_oauth_state';
  const CLIENT_ID_KEY = 'unboard_client_id';
  const REDIRECT_URI_KEY = 'unboard_redirect_uri';
  const ACTIVE_REDIRECT_KEY = 'unboard_active_redirect_uri';

  function getClientId() {
    return (localStorage.getItem(CLIENT_ID_KEY) || '').trim();
  }

  function setClientId(id) {
    if (id && id.trim()) {
      localStorage.setItem(CLIENT_ID_KEY, id.trim());
    } else {
      localStorage.removeItem(CLIENT_ID_KEY);
    }
  }

  function getDefaultRedirectUri() {
    const cleanPath = window.location.pathname.replace(/index\.html$/i, '');
    return window.location.origin + (cleanPath.endsWith('/') ? cleanPath : cleanPath + '/');
  }

  function getRedirectUri() {
    const saved = localStorage.getItem(REDIRECT_URI_KEY);
    if (saved && saved.trim()) return saved.trim();
    return getDefaultRedirectUri();
  }

  function setRedirectUri(uri) {
    if (uri && uri.trim()) {
      localStorage.setItem(REDIRECT_URI_KEY, uri.trim());
    } else {
      localStorage.removeItem(REDIRECT_URI_KEY);
    }
  }

  // ---- Ephemeral storage helpers (sessionStorage with localStorage fallback) ----
  function setTemp(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  function getTemp(key) {
    try {
      const v = sessionStorage.getItem(key);
      if (v) return v;
    } catch { /* ignore */ }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function removeTemp(key) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
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

  function clearUrlParams() {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // ---- Auth Flow ----
  async function login() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error(I18n.t('errConfigureClientId'));
    }

    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(24);
    const redirectUri = getRedirectUri();

    setTemp(VERIFIER_KEY, codeVerifier);
    setTemp(STATE_KEY, state);
    setTemp(ACTIVE_REDIRECT_KEY, redirectUri);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const returnedState = urlParams.get('state');

    if (error) {
      clearUrlParams();
      removeTemp(VERIFIER_KEY);
      removeTemp(STATE_KEY);
      removeTemp(ACTIVE_REDIRECT_KEY);
      throw new Error(I18n.t('errAuth', { err: error }));
    }

    if (!code) return false;

    const codeVerifier = getTemp(VERIFIER_KEY);
    const expectedState = getTemp(STATE_KEY);
    const clientId = getClientId();
    const redirectUri = getTemp(ACTIVE_REDIRECT_KEY) || getRedirectUri();

    clearUrlParams();
    removeTemp(VERIFIER_KEY);
    removeTemp(STATE_KEY);
    removeTemp(ACTIVE_REDIRECT_KEY);

    if (!codeVerifier || !clientId || (expectedState && returnedState !== expectedState)) {
      throw new Error(I18n.t('errMissingAuthData'));
    }

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
      const err = await response.json().catch(() => ({}));
      throw new Error(I18n.t('errToken', { err: err.error_description || err.error || response.status }));
    }

    const data = await response.json();

    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
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

    if (Date.now() > tokenData.expires_at - 300000) {
      const refreshed = await refreshToken();
      if (!refreshed) return null;
      return getTokenData()?.access_token || null;
    }

    return tokenData.access_token;
  }

  function isLoggedIn() {
    const data = getTokenData();
    return Boolean(data && data.access_token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    removeTemp(VERIFIER_KEY);
    removeTemp(STATE_KEY);
    removeTemp(ACTIVE_REDIRECT_KEY);
  }

  return {
    getClientId,
    setClientId,
    getRedirectUri,
    setRedirectUri,
    login,
    handleCallback,
    refreshToken,
    getAccessToken,
    isLoggedIn,
    logout,
  };
})();
