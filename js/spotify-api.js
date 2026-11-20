/**
 * Spotify Web API Wrapper
 */
const SpotifyAPI = (() => {
  'use strict';

  const BASE_URL = 'https://api.spotify.com/v1';
  const MAX_RATE_LIMIT_RETRIES = 5;

  function resolveUrl(endpoint) {
    if (typeof endpoint !== 'string' || !endpoint) {
      throw new Error('Invalid Spotify API endpoint.');
    }
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      if (!endpoint.startsWith(`${BASE_URL}/`)) {
        throw new Error('Blocked request outside Spotify Web API.');
      }
      return endpoint;
    }
    return `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  async function request(endpoint, options = {}, retried = false, rateRetries = 0) {
    const token = await SpotifyAuth.getAccessToken();
    if (!token) {
      const err = new Error(I18n.t('errNotAuthenticated'));
      err.code = 'AUTH_EXPIRED';
      throw err;
    }

    const url = resolveUrl(endpoint);
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (!retried && await SpotifyAuth.refreshToken()) {
        return request(endpoint, options, true, rateRetries);
      }
      SpotifyAuth.logout();
      const err = new Error(I18n.t('errSessionExpired'));
      err.code = 'AUTH_EXPIRED';
      err.status = 401;
      throw err;
    }

    if (response.status === 429 && rateRetries < MAX_RATE_LIMIT_RETRIES) {
      const parsed = Number.parseInt(response.headers.get('Retry-After') || '1', 10);
      const retryAfter = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : 1;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return request(endpoint, options, retried, rateRetries + 1);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const err = new Error(errData.error?.message || I18n.t('errHttp', { status: response.status }));
      err.status = response.status;
      throw err;
    }

    if (response.status === 204) return null;

    return response.json();
  }

  // ---- User ----
  async function getMe() {
    return request('/me');
  }

  // ---- Playlists ----
  async function getMyPlaylists(limit = 50, offset = 0) {
    return request(`/me/playlists?limit=${limit}&offset=${offset}`);
  }

  async function getAllMyPlaylists() {
    const playlists = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await getMyPlaylists(limit, offset);
      if (Array.isArray(data?.items)) {
        playlists.push(...data.items.filter(Boolean));
      }
      if (!data?.next) break;
      offset += limit;
    }

    return playlists;
  }

  // ---- Playlist Tracks/Items ----
  async function getPlaylistItems(playlistId, limit = 100, offset = 0) {
    const safeId = encodeURIComponent(playlistId);
    try {
      return await request(`/playlists/${safeId}/items?limit=${limit}&offset=${offset}`);
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        return await request(`/playlists/${safeId}/tracks?limit=${limit}&offset=${offset}`);
      }
      throw err;
    }
  }

  async function getAllPlaylistTracks(playlistId, onProgress) {
    const tracks = [];
    let offset = 0;
    const limit = 100;
    let total = 0;

    while (true) {
      const data = await getPlaylistItems(playlistId, limit, offset);
      if (total === 0) total = data?.total || 0;

      if (!Array.isArray(data?.items) || data.items.length === 0) break;

      const validItems = data.items.filter(item => {
        const t = item?.track || item?.item;
        return t && typeof t.uri === 'string' && !t.uri.startsWith('spotify:local');
      });

      validItems.forEach(item => {
        const t = item.track || item.item;
        tracks.push({
          originalIndex: tracks.length,
          addedAt: item.added_at || '',
          uri: t.uri,
          id: t.id || '',
          name: t.name || '',
          duration: Number(t.duration_ms) || 0,
          popularity: Number(t.popularity) || 0,
          album: {
            id: t.album?.id || '',
            name: t.album?.name || '',
            image: t.album?.images?.[t.album.images.length > 1 ? 1 : 0]?.url || t.album?.images?.[0]?.url || '',
            imageLarge: t.album?.images?.[0]?.url || '',
            releaseDate: t.album?.release_date || '',
          },
          artists: (t.artists || []).map(a => ({ id: a.id || '', name: a.name || '' })),
          artistName: (t.artists || []).map(a => a.name).filter(Boolean).join(', '),
        });
      });

      if (onProgress) {
        onProgress(tracks.length, total);
      }

      if (!data.next) break;
      offset += limit;
    }

    return tracks;
  }

  // ---- Reorder Playlist ----
  async function reorderPlaylist(playlistId, uris, onProgress) {
    if (!Array.isArray(uris) || uris.length === 0) return;

    const safeId = encodeURIComponent(playlistId);
    const chunkSize = 100;
    const totalChunks = Math.ceil(uris.length / chunkSize);

    let endpointPath = `/playlists/${safeId}/items`;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = uris.slice(i * chunkSize, (i + 1) * chunkSize);

      if (i === 0) {
        try {
          await request(endpointPath, {
            method: 'PUT',
            body: JSON.stringify({ uris: chunk }),
          });
        } catch (err) {
          if (err.status === 404 || err.status === 403 || err.status === 405) {
            endpointPath = `/playlists/${safeId}/tracks`;
            await request(endpointPath, {
              method: 'PUT',
              body: JSON.stringify({ uris: chunk }),
            });
          } else {
            throw err;
          }
        }
      } else {
        await request(endpointPath, {
          method: 'POST',
          body: JSON.stringify({ uris: chunk }),
        });
      }

      if (onProgress) {
        onProgress(Math.min((i + 1) * chunkSize, uris.length), uris.length);
      }

      if (i < totalChunks - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  return {
    getMe,
    getAllMyPlaylists,
    getAllPlaylistTracks,
    reorderPlaylist,
  };
})();
