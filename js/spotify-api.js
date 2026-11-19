/**
 * Spotify API Wrapper
 */
const SpotifyAPI = (() => {
  const BASE_URL = 'https://api.spotify.com/v1';

  async function request(endpoint, options = {}) {
    const token = await SpotifyAuth.getAccessToken();
    if (!token) {
      const err = new Error(I18n.t('errNotAuthenticated'));
      err.code = 'AUTH_EXPIRED';
      throw err;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      SpotifyAuth.logout();
      const err = new Error(I18n.t('errSessionExpired'));
      err.code = 'AUTH_EXPIRED';
      throw err;
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return request(endpoint, options);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || I18n.t('errHttp', { status: response.status }));
    }

    if (response.status === 204) return null;

    return response.json();
  }

  // ---- Usuário ----
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
      playlists.push(...data.items);
      if (!data.next) break;
      offset += limit;
    }

    return playlists;
  }

  // ---- Tracks/Items da Playlist ----
  async function getPlaylistItems(playlistId, limit = 100, offset = 0) {
    // Tenta o endpoint moderno /items primeiro, com fallback para o antigo /tracks
    try {
      return await request(`/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`);
    } catch (err) {
      if (err.message && (err.message.includes('404') || err.message.includes('Forbidden') || err.message.includes('403'))) {
        return await request(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`);
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
      if (total === 0) total = data.total || 0;

      if (!data.items || data.items.length === 0) break;

      // Filtra local files e tracks nulas (suporta tanto item.track quanto item.item)
      const validItems = data.items.filter(item => {
        const t = item.track || item.item;
        return t && t.uri && !t.uri.startsWith('spotify:local');
      });

      validItems.forEach((item, i) => {
        const t = item.track || item.item;
        tracks.push({
          originalIndex: offset + i,
          addedAt: item.added_at,
          uri: t.uri,
          id: t.id,
          name: t.name,
          duration: t.duration_ms || 0,
          popularity: t.popularity || 0,
          album: {
            id: t.album?.id || '',
            name: t.album?.name || '',
            image: t.album?.images?.[t.album.images.length > 1 ? 1 : 0]?.url || t.album?.images?.[0]?.url || '',
            imageLarge: t.album?.images?.[0]?.url || '',
            releaseDate: t.album?.release_date || '',
          },
          artists: (t.artists || []).map(a => ({ id: a.id, name: a.name })),
          artistName: (t.artists || []).map(a => a.name).join(', '),
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

  // ---- Reordenar Playlist ----
  async function reorderPlaylist(playlistId, uris, onProgress) {
    const chunkSize = 100;
    const totalChunks = Math.ceil(uris.length / chunkSize);

    // Determina se usamos /items ou /tracks
    let endpointPath = `/playlists/${playlistId}/items`;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = uris.slice(i * chunkSize, (i + 1) * chunkSize);

      if (i === 0) {
        // PUT substitui todas as tracks
        try {
          await request(endpointPath, {
            method: 'PUT',
            body: JSON.stringify({ uris: chunk }),
          });
        } catch (err) {
          // Se falhou no /items, tenta /tracks
          endpointPath = `/playlists/${playlistId}/tracks`;
          await request(endpointPath, {
            method: 'PUT',
            body: JSON.stringify({ uris: chunk }),
          });
        }
      } else {
        // POST adiciona ao final
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
