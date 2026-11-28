/**
 * Spotify Auth — OAuth 2.0 PKCE Flow (100% client-side, user-supplied Client ID)
 */
const SpotifyAuth = (() => {
  'use strict';

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

  // RFC 7636 unreserved 64-char alphabet (divides 256 evenly -> zero modulo bias)
  const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

  let refreshInFlight = null;

  // ---- Safe storage helpers ----
  function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ---- Ephemeral OAuth storage (sessionStorage, fallback to localStorage only on error) ----
  function setTemp(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      safeSet(key, value);
    }
  }

  function getTemp(key) {
    try {
      const v = sessionStorage.getItem(key);
      if (v) return v;
    } catch { /* ignore */ }
    return safeGet(key);
  }

  function removeTemp(key) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    safeRemove(key);
  }

  // ---- Validation ----
  function isValidClientId(id) {
    return typeof id === 'string' && CLIENT_ID_RE.test(id.trim());
  }

  function isValidRedirectUri(uri) {
    if (typeof uri !== 'string' || !uri.trim()) return false;
    try {
      const parsed = new URL(uri.trim());
      if (parsed.protocol === 'https:') return true;
      if (parsed.protocol === 'http:') {
        const host = parsed.hostname.toLowerCase();
        return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
      }
      return false;
    } catch {
      return false;
    }
  }

  // ---- Config ----
  function getClientId() {
    return (safeGet(CLIENT_ID_KEY) || '').trim();
  }

  function setClientId(id) {
    if (id && id.trim()) {
      safeSet(CLIENT_ID_KEY, id.trim());
    } else {
      safeRemove(CLIENT_ID_KEY);
    }
  }

  function getDefaultRedirectUri() {
    const cleanPath = window.location.pathname.replace(/index\.html$/i, '');
    return window.location.origin + (cleanPath.endsWith('/') ? cleanPath : cleanPath + '/');
  }

  function getRedirectUri() {
    const saved = safeGet(REDIRECT_URI_KEY);
    if (saved && isValidRedirectUri(saved)) {
      const trimmed = saved.trim();
      const currentDefault = getDefaultRedirectUri();
      if (trimmed !== currentDefault && trimmed.toLowerCase() === currentDefault.toLowerCase()) {
        safeSet(REDIRECT_URI_KEY, currentDefault);
        return currentDefault;
      }
      return trimmed;
    }
    return getDefaultRedirectUri();
  }

  function setRedirectUri(uri) {
    if (uri && isValidRedirectUri(uri)) {
      safeSet(REDIRECT_URI_KEY, uri.trim());
    } else {
      safeRemove(REDIRECT_URI_KEY);
    }
  }

  // ---- PKCE helpers ----
  function generateRandomString(length) {
    const values = crypto.getRandomValues(new Uint8Array(length));
    let out = '';
    for (let i = 0; i < values.length; i++) {
      out += PKCE_CHARSET[values[i] & 63];
    }
    return out;
  }

  async function sha256(plain) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(I18n.t('errInsecureContext'));
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  function base64urlencode(buffer) {
    let str = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
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
    if (!isValidClientId(clientId)) {
      throw new Error(I18n.t('errConfigureClientId'));
    }

    const redirectUri = getRedirectUri();
    if (!isValidRedirectUri(redirectUri)) {
      throw new Error(I18n.t('toastInvalidRedirectUri'));
    }

    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(32);

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);

    setTemp(VERIFIER_KEY, codeVerifier);
    setTemp(STATE_KEY, state);
    setTemp(ACTIVE_REDIRECT_KEY, redirectUri);

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

    if (!codeVerifier || !clientId || !expectedState || returnedState !== expectedState) {
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
    if (!data || !data.access_token) {
      throw new Error(I18n.t('errToken', { err: 'missing access_token' }));
    }

    const expiresIn = Number(data.expires_in) || 3600;
    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: Date.now() + expiresIn * 1000,
    };

    safeSet(TOKEN_KEY, JSON.stringify(tokenData));
    return true;
  }

  async function refreshToken() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
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
        if (!data || !data.access_token) {
          logout();
          return false;
        }

        const expiresIn = Number(data.expires_in) || 3600;
        const newTokenData = {
          access_token: data.access_token,
          refresh_token: data.refresh_token || tokenData.refresh_token,
          expires_at: Date.now() + expiresIn * 1000,
        };

        safeSet(TOKEN_KEY, JSON.stringify(newTokenData));
        return true;
      } catch {
        logout();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  function getTokenData() {
    try {
      const raw = safeGet(TOKEN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    const tokenData = getTokenData();
    if (!tokenData || !tokenData.access_token) return null;

    if (Date.now() > (Number(tokenData.expires_at) || 0) - 300000) {
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
    safeRemove(TOKEN_KEY);
    removeTemp(VERIFIER_KEY);
    removeTemp(STATE_KEY);
    removeTemp(ACTIVE_REDIRECT_KEY);
  }

  return {
    isValidClientId,
    isValidRedirectUri,
    getClientId,
    setClientId,
    getDefaultRedirectUri,
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
