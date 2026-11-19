/**
 * Spotify Auth — OAuth 2.0 PKCE Flow (100% client-side, no client secret)
 */
const SpotifyAuth = (() => {
  // Public OAuth Client ID (safe for public PKCE clients; protected by Redirect URI whitelist + PKCE + state)
  const CLIENT_ID = '1b20d65f1a934ea6bf1669903760a160';

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
  const ACTIVE_REDIRECT_KEY = 'unboard_active_redirect_uri';

  // Clean up any legacy manual config keys from older versions
  try {
    localStorage.removeItem('unboard_client_id');
    localStorage.removeItem('unboard_redirect_uri');
  } catch {
    // ignore storage errors
  }

  function getRedirectUri() {
    const cleanPath = window.location.pathname.replace(/index\.html$/i, '');
    return window.location.origin + (cleanPath.endsWith('/') ? cleanPath : cleanPath + '/');
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
    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(24);
    const redirectUri = getRedirectUri();

    setTemp(VERIFIER_KEY, codeVerifier);
    setTemp(STATE_KEY, state);
    setTemp(ACTIVE_REDIRECT_KEY, redirectUri);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
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
    const redirectUri = getTemp(ACTIVE_REDIRECT_KEY) || getRedirectUri();

    // Immediately remove sensitive single-use OAuth params from the address bar and storage
    clearUrlParams();
    removeTemp(VERIFIER_KEY);
    removeTemp(STATE_KEY);
    removeTemp(ACTIVE_REDIRECT_KEY);

    if (!codeVerifier || (expectedState && returnedState !== expectedState)) {
      throw new Error(I18n.t('errMissingAuthData'));
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
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
    if (!tokenData?.refresh_token) {
      logout();
      return false;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
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
    login,
    handleCallback,
    refreshToken,
    getAccessToken,
    isLoggedIn,
    logout,
  };
})();
