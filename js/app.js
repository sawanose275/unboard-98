/**
 * UnBoard App — Main application logic
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
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(I18n.getLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatTotalDuration(tracks) {
    const totalMs = tracks.reduce((sum, t) => sum + t.duration, 0);
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
    els.progressModal.style.display = 'flex';
  }

  function updateProgress(current, total) {
    const pct = Math.round((current / total) * 100);
    els.progressBar.style.width = `${pct}%`;
    els.progressText.textContent = I18n.t('tracksProcessed', { current, total });
  }

  function hideProgressModal() {
    els.progressModal.style.display = 'none';
  }

  // ---- Init ----
  async function init() {
    I18n.applyDOM();

    if (els.redirectUriInput) {
      els.redirectUriInput.value = SpotifyAuth.getRedirectUri();
    }

    const savedId = SpotifyAuth.getClientId();
    if (savedId) {
      els.clientIdInput.value = savedId;
    }

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

    bindEvents();
  }

  // ---- Events ----
  function bindEvents() {
    els.loginBtn.addEventListener('click', async () => {
      try {
        await SpotifyAuth.login();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    els.configToggle.addEventListener('click', () => {
      els.configToggle.classList.toggle('open');
      els.configPanel.classList.toggle('show');
    });

    els.saveConfigBtn.addEventListener('click', () => {
      const id = els.clientIdInput.value.trim();
      const redirectUri = els.redirectUriInput ? els.redirectUriInput.value.trim() : '';

      if (!id) {
        toast(I18n.t('toastInvalidClientId'), 'error');
        return;
      }
      SpotifyAuth.setClientId(id);
      if (redirectUri) {
        SpotifyAuth.setRedirectUri(redirectUri);
      }
      toast(I18n.t('toastConfigSaved'), 'success');
    });

    els.playlistSearch.addEventListener('input', () => {
      const query = els.playlistSearch.value.toLowerCase().trim();
      filterPlaylists(query);
    });

    els.logoutBtn.addEventListener('click', () => {
      SpotifyAuth.logout();
      showScreen('login');
      toast(I18n.t('toastLoggedOut'), 'info');
    });

    els.backBtn.addEventListener('click', () => {
      currentPlaylist = null;
      originalTracks = [];
      currentTracks = [];
      previousTracks = null;
      currentSortType = null;
      showScreen('playlists');
      clearSortButtons();
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sortType = btn.dataset.sort;
        applySortType(sortType);

        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    els.undoBtn.addEventListener('click', () => {
      if (previousTracks) {
        currentTracks = previousTracks;
        previousTracks = null;
        renderTracks(currentTracks);
        els.undoBtn.style.display = 'none';
        currentSortType = null;
        els.currentSortLabel.textContent = I18n.t('orderRestored');
        clearSortButtons();
      }
    });

    els.applyBtn.addEventListener('click', async () => {
      if (!currentPlaylist || currentTracks.length === 0) return;

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
        els.undoBtn.style.display = 'none';
      } catch (err) {
        hideProgressModal();
        toast(I18n.t('toastSaveError', { msg: err.message }), 'error');
      }
    });

    // Re-render dynamic localized views when language changes
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
      }
    });
  }

  function clearSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  }

  // ---- Load Data ----
  async function loadUserAndPlaylists() {
    try {
      showScreen('playlists');
      els.playlistsLoading.classList.add('show');
      els.playlistsGrid.innerHTML = '';

      currentUser = await SpotifyAPI.getMe();

      const avatarUrl = currentUser.images?.[0]?.url || '';
      els.userAvatar.src = avatarUrl;
      els.userName.textContent = currentUser.display_name;
      els.userAvatar2.src = avatarUrl;
      els.userName2.textContent = currentUser.display_name;

      allPlaylists = await SpotifyAPI.getAllMyPlaylists();
      renderPlaylists(allPlaylists);

      els.playlistsLoading.classList.remove('show');
    } catch (err) {
      els.playlistsLoading.classList.remove('show');
      toast(I18n.t('toastLoadError', { msg: err.message }), 'error');

      if (err.code === 'AUTH_EXPIRED') {
        SpotifyAuth.logout();
        showScreen('login');
      }
    }
  }

  // ---- Render Playlists ----
  function renderPlaylists(playlists) {
    els.playlistsGrid.innerHTML = playlists.map(pl => {
      const img = pl.images?.[0]?.url || '';
      const count = pl.tracks?.total || 0;
      const isMine = !currentUser || !pl.owner || pl.owner.id === currentUser.id;
      const ownerLabel = isMine
        ? ''
        : ` • ${I18n.t('byOwner', { owner: escapeHtml(pl.owner?.display_name || I18n.t('otherOwner')) })}`;
      return `
        <div class="playlist-card" data-id="${pl.id}">
          <img class="playlist-card-cover" src="${img}" alt="${escapeHtml(pl.name)}" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23333%22 width=%221%22 height=%221%22/></svg>'" />
          <div class="playlist-card-name" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</div>
          <div class="playlist-card-info">${formatTrackCount(count)}${ownerLabel}</div>
        </div>
      `;
    }).join('');

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
      pl.name.toLowerCase().includes(query)
    );
    renderPlaylists(filtered);
  }

  // ---- Open Playlist ----
  async function openPlaylist(playlist) {
    currentPlaylist = playlist;
    showScreen('organizer');

    els.playlistCover.src = playlist.images?.[0]?.url || '';
    els.playlistTitle.textContent = playlist.name;
    els.playlistDesc.textContent = playlist.description || '';
    els.playlistStats.textContent = I18n.t('loadingTracks');

    originalTracks = [];
    currentTracks = [];
    previousTracks = null;
    currentSortType = null;
    els.actionBar.style.display = 'none';
    els.undoBtn.style.display = 'none';
    els.tracksList.innerHTML = '';
    clearSortButtons();

    els.tracksLoading.classList.add('show');

    try {
      originalTracks = await SpotifyAPI.getAllPlaylistTracks(playlist.id, (loaded, total) => {
        els.playlistStats.textContent = I18n.t('loadingProgress', { loaded, total });
      });

      currentTracks = [...originalTracks];
      els.playlistStats.textContent = I18n.t('playlistStatsText', {
        count: formatTrackCount(originalTracks.length),
        duration: formatTotalDuration(originalTracks),
      });
      els.tracksLoading.classList.remove('show');

      renderTracks(currentTracks);
    } catch (err) {
      els.tracksLoading.classList.remove('show');
      if (err.message && (err.message.includes('Forbidden') || err.message.includes('403'))) {
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

    currentTracks = Sorters.sort(type, originalTracks);

    renderTracks(currentTracks);

    els.actionBar.style.display = 'flex';
    els.currentSortLabel.textContent = I18n.t('sortLabelPrefix', {
      label: Sorters.getLabel(type),
    });
    els.undoBtn.style.display = 'inline-flex';
  }

  // ---- Render Tracks ----
  function renderTracks(tracks) {
    const fragment = document.createDocumentFragment();

    tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'track-row';
      row.style.animationDelay = `${Math.min(i * 15, 500)}ms`;

      row.innerHTML = `
        <span class="track-num">${i + 1}</span>
        <div class="track-title-col">
          <img class="track-thumb" src="${track.album.image}" alt="" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23333%22 width=%221%22 height=%221%22/></svg>'" />
          <div class="track-info">
            <div class="track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</div>
            <div class="track-artist">${escapeHtml(track.artistName)}</div>
          </div>
        </div>
        <span class="track-album-col" title="${escapeHtml(track.album.name)}">${escapeHtml(track.album.name)}</span>
        <span class="track-date-col">${formatDate(track.addedAt)}</span>
        <span class="track-duration-col">${formatDuration(track.duration)}</span>
      `;

      fragment.appendChild(row);
    });

    els.tracksList.innerHTML = '';
    els.tracksList.appendChild(fragment);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---- Start ----
  init();
})();
