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
  function createLangRow(labelNode, isSelected, onClick) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lang-item' + (isSelected ? ' selected' : '');
    row.setAttribute('role', 'menuitemradio');
    row.setAttribute('aria-checked', String(isSelected));

    const check = document.createElement('span');
    check.className = 'lang-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = isSelected ? '•' : '';

    row.appendChild(labelNode);
    row.appendChild(check);
    row.addEventListener('click', onClick);
    return row;
  }

  function renderLanguageMenu() {
    const pref = I18n.getPreference();
    const detected = I18n.getDetectedLang();

    langBtn.textContent = I18n.getBadge();
    langBtn.title = I18n.t('langBtnTip', { lang: I18n.getNativeName() });

    langMenu.innerHTML = '';

    const autoLabel = document.createElement('span');
    autoLabel.textContent = I18n.t('langAuto', { lang: I18n.getNativeName(detected) });
    langMenu.appendChild(createLangRow(autoLabel, pref === 'auto', () => {
      I18n.setLang('auto');
      setLangMenu(false);
    }));

    const sep = document.createElement('div');
    sep.className = 'lang-sep';
    sep.setAttribute('role', 'separator');
    langMenu.appendChild(sep);

    I18n.LANGUAGES.forEach(l => {
      const wrap = document.createElement('span');
      wrap.className = 'lang-name-wrap';

      const codeSpan = document.createElement('span');
      codeSpan.className = 'lang-code';
      codeSpan.textContent = l.badge;

      const nativeSpan = document.createElement('span');
      nativeSpan.textContent = l.native;

      wrap.appendChild(codeSpan);
      wrap.appendChild(nativeSpan);

      langMenu.appendChild(createLangRow(wrap, pref === l.code, () => {
        I18n.setLang(l.code);
        setLangMenu(false);
      }));
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
    langBtn.setAttribute('aria-expanded', String(open));
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
    'login-screen': 'assets/icons/favicon.png',
    'playlists-screen': 'assets/icons/playlists.png',
    'organizer-screen': 'assets/icons/organizer.png',
  };

  function updatePlaylistsStatus() {
    if ($('#playlists-loading').classList.contains('show')) {
      $('#playlists-status').textContent = I18n.t('loadingPlaylists');
      return;
    }
    const n = $$('#playlists-grid .playlist-card').length;
    $('#playlists-status').textContent = n
      ? I18n.t('playlistsCountStatus', { count: n })
      : (isLoggedIn() ? I18n.t('noPlaylistsFound') : I18n.t('selectPlaylistHint'));
  }

  function updateOrganizerStatus() {
    if ($('#tracks-loading').classList.contains('show')) {
      $('#organizer-status').textContent = I18n.t('loadingTracks');
      return;
    }
    const n = $$('#tracks-list .track-row').length;
    $('#organizer-status').textContent = n
      ? I18n.t('tracksCountStatus', { count: n })
      : I18n.t('ready');
  }

  function updateDynamicStatusBars() {
    updatePlaylistsStatus();
    updateOrganizerStatus();

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
    btn.type = 'button';
    btn.className = 'btn98 task-btn' + (current.classList.contains('minimized') ? '' : ' active');

    const iconSrc = TASK_ICONS[current.id];
    if (iconSrc) {
      const img = document.createElement('img');
      img.className = 'ico ico-16';
      img.src = iconSrc;
      img.alt = '';
      btn.appendChild(img);
    }

    const label = document.createElement('span');
    label.textContent = screenTitle(current);

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

  new MutationObserver(updatePlaylistsStatus).observe($('#playlists-grid'), { childList: true });
  new MutationObserver(updatePlaylistsStatus).observe($('#playlists-loading'), { attributes: true, attributeFilter: ['class'] });

  new MutationObserver(updateOrganizerStatus).observe($('#tracks-list'), { childList: true });
  new MutationObserver(updateOrganizerStatus).observe($('#tracks-loading'), { attributes: true, attributeFilter: ['class'] });

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
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let minDx = -Infinity;
    let maxDx = Infinity;
    let minDy = -Infinity;
    let maxDy = Infinity;
    let dragging = false;

    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.tb-btn')) return;
      if (win.classList.contains('maximized') || window.innerWidth <= 860) return;

      const rect = win.getBoundingClientRect();
      const taskbarH = $('.taskbar')?.offsetHeight || 34;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = parseFloat(win.dataset.x || '0');
      baseY = parseFloat(win.dataset.y || '0');

      // Keep title bar reachable inside viewport
      minDx = 80 - rect.right;
      maxDx = window.innerWidth - 80 - rect.left;
      minDy = -rect.top;
      maxDy = window.innerHeight - taskbarH - 32 - rect.top;

      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = Math.min(maxDx, Math.max(minDx, e.clientX - startX));
      const dy = Math.min(maxDy, Math.max(minDy, e.clientY - startY));
      const x = baseX + dx;
      const y = baseY + dy;
      win.dataset.x = String(x);
      win.dataset.y = String(y);
      win.style.transform = `translate(${x}px, ${y}px)`;
    });

    const stop = () => { dragging = false; };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  // ---------- Info Dialog ----------
  function showInfo(title, iconSrc, html) {
    infoTitle.textContent = title;
    infoIcon.src = iconSrc;
    infoText.innerHTML = html;
    infoModal.classList.remove('is-hidden');
    $('#info-ok').focus();
  }

  function hideInfo() {
    infoModal.classList.add('is-hidden');
  }

  $('#info-ok').addEventListener('click', hideInfo);
  $('#info-close-x').addEventListener('click', hideInfo);
  infoModal.addEventListener('click', e => {
    if (e.target === infoModal) hideInfo();
  });

  function handleCommand(cmd) {
    switch (cmd) {
      case 'about': showInfo(I18n.t('aboutTitle'), 'assets/icons/unboard.png', I18n.t('aboutHtml')); break;
      case 'help': showInfo(I18n.t('helpTitle'), 'assets/icons/help.ico', I18n.t('helpHtml')); break;
      case 'language': setLangMenu(true); break;
      case 'playlists':
        if (!isLoggedIn()) {
          showInfo(I18n.t('startPlaylists'), 'assets/icons/playlists.png', I18n.t('loginFirstHtml'));
        } else if ($('#organizer-screen').classList.contains('active')) {
          $('#back-btn').click();
        } else {
          $('#playlists-screen').classList.remove('minimized');
          renderTaskbar();
        }
        break;
      case 'logout':
        if (!isLoggedIn()) {
          showInfo(I18n.t('logoutBtn'), 'assets/icons/error.ico', I18n.t('notLoggedInHtml'));
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
    startBtn.setAttribute('aria-expanded', String(open));
  }

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    setStart(!startMenu.classList.contains('open'));
  });

  $$('[data-start]', startMenu).forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      const cmd = item.dataset.start;
      setStart(false);
      handleCommand(cmd);
    });
  });

  document.addEventListener('click', e => {
    if (!startMenu.contains(e.target) && e.target !== startBtn) setStart(false);
    if (!langMenu.contains(e.target) && e.target !== langBtn) setLangMenu(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setStart(false);
      setLangMenu(false);
      hideInfo();
    }
  });

  window.addEventListener('resize', () => {
    setStart(false);
    setLangMenu(false);
  });

  // React to language changes
  window.addEventListener('unboard:langchange', () => {
    renderLanguageMenu();
    renderTaskbar();
    updateDynamicStatusBars();
    tick();
  });

  // Initial render
  renderLanguageMenu();
  renderTaskbar();
})();
