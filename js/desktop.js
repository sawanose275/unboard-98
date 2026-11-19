/**
 * UnBoard 98 — Desktop shell (windows, taskbar, start menu, language switcher)
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const screens = $$('.screen');
  const taskButtons = $('#task-buttons');
  const startBtn = $('#start-btn');
  const startMenu = $('#start-menu');
  const langBtn = $('#lang-btn');
  const langMenu = $('#lang-menu');
  const clock = $('#tray-clock');

  const infoModal = $('#info-modal');
  const infoTitle = $('#info-title');
  const infoIcon = $('#info-icon');
  const infoText = $('#info-text');

  let lastActiveId = null;

  // ---------- Language Switcher (Win98 taskbar indicator) ----------
  function renderLanguageMenu() {
    const pref = I18n.getPreference();
    const detected = I18n.getDetectedLang();

    langBtn.textContent = I18n.getBadge();
    langBtn.title = I18n.t('langBtnTip', { lang: I18n.getNativeName() });

    langMenu.innerHTML = '';

    const autoRow = document.createElement('div');
    autoRow.className = 'lang-item';
    autoRow.innerHTML = `
      <span>${I18n.t('langAuto', { lang: I18n.getNativeName(detected) })}</span>
      <span class="lang-check">${pref === 'auto' ? '✓' : ''}</span>
    `;
    autoRow.addEventListener('click', () => {
      I18n.setLang('auto');
      setLangMenu(false);
    });
    langMenu.appendChild(autoRow);

    const sep = document.createElement('div');
    sep.className = 'lang-sep';
    langMenu.appendChild(sep);

    I18n.LANGUAGES.forEach(l => {
      const row = document.createElement('div');
      row.className = 'lang-item';
      const isSelected = pref === l.code;
      row.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="lang-code">${l.badge}</span>
          <span>${l.native}</span>
        </span>
        <span class="lang-check">${isSelected ? '✓' : ''}</span>
      `;
      row.addEventListener('click', () => {
        I18n.setLang(l.code);
        setLangMenu(false);
      });
      langMenu.appendChild(row);
    });
  }

  function setLangMenu(open) {
    if (open) {
      setStart(false);
      renderLanguageMenu();
      const rect = langBtn.getBoundingClientRect();
      const rightOffset = Math.max(4, Math.round(window.innerWidth - rect.right));
      langMenu.style.right = `${rightOffset}px`;
    }
    langMenu.classList.toggle('open', open);
    langBtn.classList.toggle('pressed', open);
  }

  langBtn.addEventListener('click', e => {
    e.stopPropagation();
    setLangMenu(!langMenu.classList.contains('open'));
  });

  // ---------- Clock ----------
  function tick() {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString(I18n.getLocale(), { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 10000);

  // ---------- Helpers ----------
  const activeScreen = () => screens.find(s => s.classList.contains('active'));
  const isLoggedIn = () => !$('#login-screen').classList.contains('active');

  function screenTitle(screen) {
    if (screen.id === 'login-screen') return 'UnBoard 98';
    if (screen.id === 'playlists-screen') return I18n.t('playlistsTaskTitle');
    if (screen.id === 'organizer-screen') {
      const name = $('#playlist-title').textContent.trim();
      return name || I18n.t('organizerTaskTitle');
    }
    return screen.dataset.title;
  }

  const TASK_ICONS = {
    'login-screen': `<svg class="ui-svg" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#1DB954" stroke="#0c5e2a" stroke-width="1"/><path d="M4.8 6.8c2-.5 4.3-.4 6.2.6M5.4 9c1.6-.4 3.4-.3 5 .5M6 11.1c1.2-.3 2.5-.2 3.7.4" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    'playlists-screen': `<svg class="ui-svg" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.4 1.5h7.1v8h-13v-9.5z" fill="#f0bf3d" stroke="#8a6510" stroke-width="1" stroke-linejoin="round"/></svg>`,
    'organizer-screen': `<svg class="ui-svg" viewBox="0 0 16 16" fill="none"><path d="M6 12V3.5l7-1.5v8.5" stroke="#103b8c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.5" cy="12" r="2" fill="#103b8c"/><circle cx="11.5" cy="10.5" r="2" fill="#103b8c"/></svg>`,
  };

  function updateDynamicStatusBars() {
    const playlistCount = $$('#playlists-grid .playlist-card').length;
    $('#playlists-status').textContent = playlistCount
      ? I18n.t('playlistsCountStatus', { count: playlistCount })
      : I18n.t('selectPlaylistHint');

    const trackCount = $$('#tracks-list .track-row').length;
    $('#organizer-status').textContent = trackCount
      ? I18n.t('tracksCountStatus', { count: trackCount })
      : I18n.t('ready');

    const name = $('#playlist-title').textContent.trim();
    $('#organizer-window-title').textContent = name
      ? `${name} — UnBoard 98`
      : I18n.t('organizerWinTitle');
  }

  // ---------- Taskbar ----------
  function renderTaskbar() {
    const current = activeScreen();
    if (current && current.id !== lastActiveId) {
      current.classList.remove('minimized');
      lastActiveId = current.id;
    }

    taskButtons.innerHTML = '';
    if (!current) return;

    const btn = document.createElement('button');
    btn.className = 'btn98 task-btn' + (current.classList.contains('minimized') ? '' : ' active');
    btn.innerHTML = TASK_ICONS[current.id] || `<span>${current.dataset.icon || '🗔'}</span>`;
    const label = document.createElement('span');
    label.textContent = screenTitle(current);
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    btn.appendChild(label);
    btn.title = label.textContent;
    btn.addEventListener('click', () => {
      current.classList.toggle('minimized');
      renderTaskbar();
    });
    taskButtons.appendChild(btn);
  }

  const screenObserver = new MutationObserver(renderTaskbar);
  screens.forEach(s => screenObserver.observe(s, { attributes: true, attributeFilter: ['class'] }));

  new MutationObserver(() => {
    updateDynamicStatusBars();
    renderTaskbar();
  }).observe($('#playlist-title'), { childList: true, characterData: true, subtree: true });

  new MutationObserver(() => {
    const n = $$('#playlists-grid .playlist-card').length;
    $('#playlists-status').textContent = n
      ? I18n.t('playlistsCountStatus', { count: n })
      : I18n.t('noPlaylistsFound');
  }).observe($('#playlists-grid'), { childList: true });

  new MutationObserver(() => {
    const n = $$('#tracks-list .track-row').length;
    $('#organizer-status').textContent = n
      ? I18n.t('tracksCountStatus', { count: n })
      : I18n.t('ready');
  }).observe($('#tracks-list'), { childList: true });

  // ---------- Window controls ----------
  $$('.screen').forEach(screen => {
    const win = $('[data-window]', screen);

    $$('.tb-btn[data-action]', screen).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;

        if (action === 'minimize') {
          screen.classList.add('minimized');
          renderTaskbar();
        } else if (action === 'maximize') {
          toggleMax(screen, win);
        } else if (action === 'close') {
          if (screen.id === 'organizer-screen') {
            $('#back-btn').click();
          } else {
            screen.classList.add('minimized');
            renderTaskbar();
          }
        }
      });
    });

    const titleBar = $('.title-bar', win);
    titleBar.addEventListener('dblclick', e => {
      if (e.target.closest('.tb-btn')) return;
      toggleMax(screen, win);
    });

    enableDrag(titleBar, win);
  });

  function toggleMax(screen, win) {
    win.classList.toggle('maximized');
    screen.classList.toggle('is-max', win.classList.contains('maximized'));
  }

  // ---------- Drag windows ----------
  function enableDrag(handle, win) {
    let startX, startY, baseX = 0, baseY = 0, dragging = false;

    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.tb-btn')) return;
      if (win.classList.contains('maximized') || window.innerWidth <= 860) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = parseFloat(win.dataset.x || 0);
      baseY = parseFloat(win.dataset.y || 0);
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const x = baseX + (e.clientX - startX);
      const y = baseY + (e.clientY - startY);
      win.dataset.x = x;
      win.dataset.y = y;
      win.style.transform = `translate(${x}px, ${y}px)`;
    });

    const stop = () => { dragging = false; };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  // ---------- Info Dialog ----------
  function showInfo(title, icon, html) {
    infoTitle.textContent = title;
    infoIcon.textContent = icon;
    infoText.innerHTML = html;
    infoModal.style.display = 'flex';
    $('#info-ok').focus();
  }
  function hideInfo() { infoModal.style.display = 'none'; }
  $('#info-ok').addEventListener('click', hideInfo);
  $('#info-close-x').addEventListener('click', hideInfo);

  function handleCommand(cmd) {
    switch (cmd) {
      case 'about': showInfo(I18n.t('aboutTitle'), '💿', I18n.t('aboutHtml')); break;
      case 'help': showInfo(I18n.t('helpTitle'), '❓', I18n.t('helpHtml')); break;
      case 'language': setLangMenu(true); break;
      case 'playlists':
        if (!isLoggedIn()) {
          showInfo(I18n.t('startPlaylists'), '📁', I18n.t('loginFirstHtml'));
        } else if ($('#organizer-screen').classList.contains('active')) {
          $('#back-btn').click();
        } else {
          $('#playlists-screen').classList.remove('minimized');
          renderTaskbar();
        }
        break;
      case 'logout':
        if (!isLoggedIn()) {
          showInfo(I18n.t('logoutBtn'), '⏻', I18n.t('notLoggedInHtml'));
        } else {
          $('#logout-btn').click();
        }
        break;
    }
  }

  $$('.menu-item[data-menu]').forEach(item => {
    item.addEventListener('click', () => handleCommand(item.dataset.menu));
  });

  // ---------- Start Menu ----------
  function setStart(open) {
    if (open) setLangMenu(false);
    startMenu.classList.toggle('open', open);
    startBtn.classList.toggle('pressed', open);
  }
  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    setStart(!startMenu.classList.contains('open'));
  });
  $$('[data-start]', startMenu).forEach(li => {
    li.addEventListener('click', e => {
      e.stopPropagation();
      const cmd = li.dataset.start;
      setStart(false);
      handleCommand(cmd);
    });
  });
  document.addEventListener('click', e => {
    if (!startMenu.contains(e.target)) setStart(false);
    if (!langMenu.contains(e.target) && e.target !== langBtn) setLangMenu(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setStart(false);
      setLangMenu(false);
      hideInfo();
    }
  });

  // React to language changes
  window.addEventListener('unboard:langchange', () => {
    renderLanguageMenu();
    renderTaskbar();
    updateDynamicStatusBars();
    tick();
  });

  // Initial render
  I18n.applyDOM();
  renderLanguageMenu();
  renderTaskbar();
})();
