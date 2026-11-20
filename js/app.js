/**
 * UnBoard 98 App — Main application logic
 */
(async function () {
  'use strict';

  // ---- State ----
  let currentUser = null;
  let allPlaylists = [];
  let currentPlaylist = null;
  let originalTracks = [];
  let currentTracks = [];
  let previousTracks = null;
  let currentSortType = null;
  let sortRestored = false;
  let loadRequestId = 0;

  const FALLBACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="#8d94a8" width="1" height="1"/></svg>'
  );
  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // ---- DOM Refs ----
  const screens = {
    login: document.getElementById('login-screen'),
    playlists: document.getElementById('playlists-screen'),
    organizer: document.getElementById('organizer-screen'),
  };

  const els = {
    // Login
    loginBtn: document.getElementById('login-btn'),
    configToggle: document.getElementById('config-toggle'),
    configPanel: document.getElementById('config-panel'),
    clientIdInput: document.getElementById('client-id'),
    redirectUriInput: document.getElementById('redirect-uri-input'),
    saveConfigBtn: document.getElementById('save-config-btn'),

    // Playlists
    playlistsGrid: document.getElementById('playlists-grid'),
    playlistsLoading: document.getElementById('playlists-loading'),
    playlistSearch: document.getElementById('playlist-search'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),

    // Organizer
    backBtn: document.getElementById('back-btn'),
    playlistCover: document.getElementById('playlist-cover'),
    playlistTitle: document.getElementById('playlist-title'),
    playlistDesc: document.getElementById('playlist-desc'),
    playlistStats: document.getElementById('playlist-stats'),
    tracksList: document.getElementById('tracks-list'),
    tracksLoading: document.getElementById('tracks-loading'),
    actionBar: document.getElementById('action-bar'),
    currentSortLabel: document.getElementById('current-sort-label'),
    undoBtn: document.getElementById('undo-btn'),
    applyBtn: document.getElementById('apply-btn'),
    userAvatar2: document.getElementById('user-avatar-2'),
    userName2: document.getElementById('user-name-2'),

    // Modal
    progressModal: document.getElementById('progress-modal'),
    progressTitle: document.getElementById('progress-title'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
  };

  // ---- Utilities ----
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function safeImageUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return '';
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol === 'https:') return parsed.href;
    } catch { /* ignore */ }
    return '';
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function setConfigOpen(open) {
    els.configToggle.classList.toggle('open', open);
    els.configPanel.classList.toggle('show', open);
    els.configToggle.setAttribute('aria-expanded', String(open));
  }

  function setUserAvatar(imgEl, url) {
    const safeUrl = safeImageUrl(url);
    if (safeUrl) {
      imgEl.src = safeUrl;
      imgEl.hidden = false;
    } else {
      imgEl.src = TRANSPARENT_PIXEL;
      imgEl.hidden = true;
    }
  }

  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleDateString(I18n.getLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function formatTotalDuration(tracks) {
    const totalMs = tracks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0);
    const totalMin = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }

  function formatTrackCount(count) {
    return count === 1
      ? I18n.t('trackSingular', { count })
      : I18n.t('trackPlural', { count });
  }

  function toast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    els.toastContainer.appendChild(t);

    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  function showProgressModal(title, text) {
    els.progressTitle.textContent = title;
    els.progressText.textContent = text;
    els.progressBar.style.width = '0%';
    els.progressModal.classList.remove('is-hidden');
  }

  function updateProgress(current, total) {
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    els.progressBar.style.width = `${pct}%`;
    els.progressText.textContent = I18n.t('tracksProcessed', { current, total });
  }

  function hideProgressModal() {
    els.progressModal.classList.add('is-hidden');
  }

  function clearSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  }

  function resetOrganizerState() {
    loadRequestId++;
    currentPlaylist = null;
    originalTracks = [];
    currentTracks = [];
    previousTracks = null;
    currentSortType = null;
    sortRestored = false;
    els.playlistTitle.textContent = '';
    els.playlistDesc.textContent = '';
    els.playlistStats.textContent = '';
    els.playlistCover.src = TRANSPARENT_PIXEL;
    els.tracksList.innerHTML = '';
    els.tracksLoading.classList.remove('show');
    els.actionBar.classList.add('is-hidden');
    els.undoBtn.classList.add('is-hidden');
    els.currentSortLabel.textContent = I18n.t('noSortApplied');
    clearSortButtons();
  }

  function resetAppState() {
    resetOrganizerState();
    currentUser = null;
    allPlaylists = [];
    els.playlistSearch.value = '';
    els.playlistsGrid.innerHTML = '';
    els.playlistsLoading.classList.remove('show');
    setUserAvatar(els.userAvatar, '');
    setUserAvatar(els.userAvatar2, '');
    els.userName.textContent = '';
    els.userName2.textContent = '';
  }

  function bindImageFallback(container) {
    container.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => {
        if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
      }, { once: true });
    });
  }

  function saveConfigFromInputs() {
    const id = els.clientIdInput.value.trim();
    const redirectUri = els.redirectUriInput ? els.redirectUriInput.value.trim() : '';

    if (!SpotifyAuth.isValidClientId(id)) {
      toast(I18n.t('toastInvalidClientId'), 'error');
      return false;
    }

    if (redirectUri && !SpotifyAuth.isValidRedirectUri(redirectUri)) {
      toast(I18n.t('toastInvalidRedirectUri'), 'error');
      return false;
    }

    SpotifyAuth.setClientId(id);
    if (redirectUri) {
      SpotifyAuth.setRedirectUri(redirectUri);
    } else {
      SpotifyAuth.setRedirectUri('');
      if (els.redirectUriInput) {
        els.redirectUriInput.value = SpotifyAuth.getRedirectUri();
      }
    }

    toast(I18n.t('toastConfigSaved'), 'success');
    return true;
  }

  // ---- Init ----
  async function init() {
    I18n.applyDOM();

    if (els.redirectUriInput) {
      els.redirectUriInput.value = SpotifyAuth.getRedirectUri();
    }

    const savedId = SpotifyAuth.getClientId();
    if (savedId && els.clientIdInput) {
      els.clientIdInput.value = savedId;
    }

    // Bind events before async auth/data loading so UI is always responsive
    bindEvents();

    try {
      const isCallback = await SpotifyAuth.handleCallback();
      if (isCallback) {
        toast(I18n.t('toastLoginSuccess'), 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    }

    if (SpotifyAuth.isLoggedIn()) {
      await loadUserAndPlaylists();
    } else {
      showScreen('login');
    }
  }

  // ---- Events ----
  function bindEvents() {
    [els.userAvatar, els.userAvatar2].forEach(img => {
      img.addEventListener('error', () => { img.hidden = true; });
    });
    els.playlistCover.addEventListener('error', () => {
      if (els.playlistCover.src !== FALLBACK_IMG) els.playlistCover.src = FALLBACK_IMG;
    });

    els.loginBtn.addEventListener('click', async () => {
      try {
        const inputId = els.clientIdInput ? els.clientIdInput.value.trim() : '';
        const inputUri = els.redirectUriInput ? els.redirectUriInput.value.trim() : '';

        if (inputId) {
          if (!SpotifyAuth.isValidClientId(inputId)) {
            toast(I18n.t('toastInvalidClientId'), 'error');
            return;
          }
          SpotifyAuth.setClientId(inputId);
        }

        if (inputUri) {
          if (!SpotifyAuth.isValidRedirectUri(inputUri)) {
            toast(I18n.t('toastInvalidRedirectUri'), 'error');
            return;
          }
          SpotifyAuth.setRedirectUri(inputUri);
        }

        if (!SpotifyAuth.getClientId() && els.configPanel && !els.configPanel.classList.contains('show')) {
          setConfigOpen(true);
          els.clientIdInput.focus();
        }
        await SpotifyAuth.login();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    els.configToggle.addEventListener('click', () => {
      setConfigOpen(!els.configPanel.classList.contains('show'));
    });

    els.saveConfigBtn.addEventListener('click', saveConfigFromInputs);

    [els.clientIdInput, els.redirectUriInput].forEach(input => {
      if (!input) return;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveConfigFromInputs();
        }
      });
    });

    els.playlistSearch.addEventListener('input', () => {
      const query = els.playlistSearch.value.toLowerCase().trim();
      filterPlaylists(query);
    });

    els.logoutBtn.addEventListener('click', () => {
      SpotifyAuth.logout();
      resetAppState();
      showScreen('login');
      toast(I18n.t('toastLoggedOut'), 'info');
    });

    els.backBtn.addEventListener('click', () => {
      resetOrganizerState();
      showScreen('playlists');
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentTracks.length === 0) return;
        const sortType = btn.dataset.sort;
        applySortType(sortType);

        clearSortButtons();
        btn.classList.add('active');
      });
    });

    els.undoBtn.addEventListener('click', () => {
      if (previousTracks) {
        currentTracks = previousTracks;
        previousTracks = null;
        currentSortType = null;
        sortRestored = true;
        renderTracks(currentTracks);
        els.undoBtn.classList.add('is-hidden');
        els.currentSortLabel.textContent = I18n.t('orderRestored');
        clearSortButtons();
      }
    });

    els.applyBtn.addEventListener('click', async () => {
      if (!currentPlaylist || currentTracks.length === 0 || els.applyBtn.disabled) return;

      els.applyBtn.disabled = true;
      try {
        showProgressModal(I18n.t('savingToSpotify'), I18n.t('preparing'));

        const uris = currentTracks.map(t => t.uri);
        await SpotifyAPI.reorderPlaylist(currentPlaylist.id, uris, (current, total) => {
          updateProgress(current, total);
        });

        hideProgressModal();
        toast(I18n.t('toastSavedSuccess', { name: currentPlaylist.name }), 'success');

        originalTracks = [...currentTracks];
        previousTracks = null;
        els.undoBtn.classList.add('is-hidden');
      } catch (err) {
        hideProgressModal();
        if (err.code === 'AUTH_EXPIRED') {
          resetAppState();
          showScreen('login');
          toast(err.message, 'error');
        } else if (err.status === 403 || (err.message && err.message.includes('Forbidden'))) {
          toast(I18n.t('forbiddenToast'), 'error');
        } else {
          toast(I18n.t('toastSaveError', { msg: err.message }), 'error');
        }
      } finally {
        els.applyBtn.disabled = false;
      }
    });

    window.addEventListener('unboard:langchange', () => {
      if (allPlaylists.length) {
        filterPlaylists(els.playlistSearch.value.toLowerCase().trim());
      }
      if (currentPlaylist && originalTracks.length) {
        els.playlistStats.textContent = I18n.t('playlistStatsText', {
          count: formatTrackCount(originalTracks.length),
          duration: formatTotalDuration(originalTracks),
        });
        renderTracks(currentTracks);
      }
      if (currentSortType) {
        els.currentSortLabel.textContent = I18n.t('sortLabelPrefix', {
          label: Sorters.getLabel(currentSortType),
        });
      } else if (sortRestored) {
        els.currentSortLabel.textContent = I18n.t('orderRestored');
      }
    });
  }

  // ---- Load Data ----
  async function loadUserAndPlaylists() {
    try {
      showScreen('playlists');
      els.playlistsLoading.classList.add('show');
      els.playlistsGrid.innerHTML = '';

      currentUser = await SpotifyAPI.getMe();

      const avatarUrl = currentUser.images?.[0]?.url || '';
      setUserAvatar(els.userAvatar, avatarUrl);
      els.userName.textContent = currentUser.display_name || '';
      setUserAvatar(els.userAvatar2, avatarUrl);
      els.userName2.textContent = currentUser.display_name || '';

      allPlaylists = await SpotifyAPI.getAllMyPlaylists();
      els.playlistsLoading.classList.remove('show');
      renderPlaylists(allPlaylists);
    } catch (err) {
      els.playlistsLoading.classList.remove('show');
      toast(I18n.t('toastLoadError', { msg: err.message }), 'error');

      if (err.code === 'AUTH_EXPIRED') {
        SpotifyAuth.logout();
        resetAppState();
        showScreen('login');
      }
    }
  }

  // ---- Render Playlists ----
  function renderPlaylists(playlists) {
    els.playlistsGrid.innerHTML = playlists.map(pl => {
      const img = safeImageUrl(pl.images?.[0]?.url) || FALLBACK_IMG;
      const count = pl.tracks?.total ?? pl.items?.total ?? 0;
      const isMine = !currentUser || !pl.owner || pl.owner.id === currentUser.id;
      const ownerLabel = isMine
        ? ''
        : ` • ${escapeHtml(I18n.t('byOwner', { owner: pl.owner?.display_name || I18n.t('otherOwner') }))}`;
      return `
        <button type="button" class="playlist-card" data-id="${escapeHtml(pl.id)}">
          <img class="playlist-card-cover" src="${escapeHtml(img)}" alt="${escapeHtml(pl.name)}" loading="lazy">
          <span class="playlist-card-name" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</span>
          <span class="playlist-card-info">${escapeHtml(formatTrackCount(count))}${ownerLabel}</span>
        </button>
      `;
    }).join('');

    bindImageFallback(els.playlistsGrid);

    els.playlistsGrid.querySelectorAll('.playlist-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const pl = allPlaylists.find(p => p.id === id);
        if (pl) openPlaylist(pl);
      });
    });
  }

  function filterPlaylists(query) {
    if (!query) {
      renderPlaylists(allPlaylists);
      return;
    }
    const filtered = allPlaylists.filter(pl =>
      (pl.name || '').toLowerCase().includes(query)
    );
    renderPlaylists(filtered);
  }

  // ---- Open Playlist ----
  async function openPlaylist(playlist) {
    resetOrganizerState();
    const reqId = ++loadRequestId;
    currentPlaylist = playlist;
    showScreen('organizer');

    els.playlistCover.src = safeImageUrl(playlist.images?.[0]?.url) || FALLBACK_IMG;
    els.playlistTitle.textContent = playlist.name || '';
    els.playlistDesc.textContent = playlist.description || '';
    els.playlistStats.textContent = I18n.t('loadingTracks');
    els.tracksLoading.classList.add('show');

    try {
      const loadedTracks = await SpotifyAPI.getAllPlaylistTracks(playlist.id, (loaded, total) => {
        if (reqId !== loadRequestId) return;
        els.playlistStats.textContent = I18n.t('loadingProgress', { loaded, total });
      });

      if (reqId !== loadRequestId) return;

      originalTracks = loadedTracks;
      currentTracks = [...originalTracks];
      els.playlistStats.textContent = I18n.t('playlistStatsText', {
        count: formatTrackCount(originalTracks.length),
        duration: formatTotalDuration(originalTracks),
      });
      els.tracksLoading.classList.remove('show');

      renderTracks(currentTracks);
    } catch (err) {
      if (reqId !== loadRequestId) return;
      els.tracksLoading.classList.remove('show');
      if (err.code === 'AUTH_EXPIRED') {
        resetAppState();
        showScreen('login');
        toast(err.message, 'error');
      } else if (err.status === 403 || (err.message && (err.message.includes('Forbidden') || err.message.includes('403')))) {
        els.playlistStats.textContent = I18n.t('forbiddenStats');
        toast(I18n.t('forbiddenToast'), 'error');
      } else {
        els.playlistStats.textContent = I18n.t('errorPrefix', { msg: err.message });
        toast(I18n.t('toastLoadTracksError', { msg: err.message }), 'error');
      }
    }
  }

  // ---- Sort ----
  function applySortType(type) {
    if (currentTracks.length === 0) return;

    previousTracks = [...currentTracks];
    currentSortType = type;
    sortRestored = false;

    currentTracks = Sorters.sort(type, originalTracks);

    renderTracks(currentTracks);

    els.actionBar.classList.remove('is-hidden');
    els.currentSortLabel.textContent = I18n.t('sortLabelPrefix', {
      label: Sorters.getLabel(type),
    });
    els.undoBtn.classList.remove('is-hidden');
  }

  // ---- Render Tracks ----
  function renderTracks(tracks) {
    const fragment = document.createDocumentFragment();

    tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = i < 40 ? 'track-row' : 'track-row no-anim';
      if (i < 40) {
        row.style.animationDelay = `${Math.min(i * 12, 360)}ms`;
      }

      const thumbUrl = safeImageUrl(track.album.image) || FALLBACK_IMG;
      row.innerHTML = `
        <span class="track-num">${i + 1}</span>
        <div class="track-title-col">
          <img class="track-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy">
          <div class="track-info">
            <div class="track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</div>
            <div class="track-artist">${escapeHtml(track.artistName)}</div>
          </div>
        </div>
        <span class="track-album-col" title="${escapeHtml(track.album.name)}">${escapeHtml(track.album.name)}</span>
        <span class="track-date-col" title="${escapeHtml(formatDate(track.addedAt))}">${escapeHtml(formatDate(track.addedAt))}</span>
        <span class="track-duration-col">${escapeHtml(formatDuration(track.duration))}</span>
      `;

      fragment.appendChild(row);
    });

    els.tracksList.innerHTML = '';
    els.tracksList.appendChild(fragment);
    bindImageFallback(els.tracksList);
  }

  // ---- Start ----
  init();
})();
