// Admin page: create rooms and list the active ones. No sign-in (demo only).
(() => {
  const I = window.ViolaI18n;
  const $ = (id) => document.getElementById(id);
  const REFRESH_MS = 10000;
  let rooms = [];
  let lastLoaded = null;

  // ---------- Language (remembered per browser) ----------
  function savedLang() {
    try { return localStorage.getItem('viola-admin-lang'); } catch { return null; }
  }
  async function setLang(lang) {
    await I.load(lang);
    try { localStorage.setItem('viola-admin-lang', I.lang); } catch { /* private mode */ }
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === I.lang)));
    document.title = 'Viola – ' + I.t('admin.title');
    render();
    renderUpdated();
    if (currentResult) showResult(currentResult);
  }
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

  // ---------- Create ----------
  let currentResult = null;

  $('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('createBtn');
    btn.disabled = true;
    btn.textContent = I.t('admin.creating');
    $('createError').hidden = true;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('nameInput').value.trim(), lang: $('langSelect').value }),
      });
      if (!res.ok) throw new Error('create ' + res.status);
      currentResult = await res.json();
      showResult(currentResult);
      $('nameInput').value = '';
      await loadRooms();
    } catch (err) {
      console.error(err);
      $('createError').textContent = I.t('admin.error');
      $('createError').hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = I.t('admin.create');
    }
  });

  function showResult(r) {
    $('resultLink').textContent = r.link;
    $('resultOpen').href = r.link + '&name=Interviewer';
    $('resultUntil').textContent = I.t('admin.openUntil', { time: I.time(r.expiresAt) });
    $('result').hidden = false;
  }
  $('resultCopy').addEventListener('click', (e) => copy(currentResult.link, e.currentTarget));

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    btn.textContent = I.t('admin.copied');
    setTimeout(() => { btn.textContent = I.t('admin.copy'); }, 2000);
  }

  // ---------- List ----------
  async function loadRooms() {
    try {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      if (!res.ok) throw new Error('list ' + res.status);
      rooms = await res.json();
      lastLoaded = new Date();
      $('listError').hidden = true;
    } catch (err) {
      console.error(err);
      $('listError').textContent = I.t('admin.loadError');
      $('listError').hidden = false;
    }
    render();
    renderUpdated();
  }

  function renderUpdated() {
    $('updated').textContent = lastLoaded ? I.t('admin.updated', { time: lastLoaded.toLocaleTimeString(I.lang) }) : '';
  }

  function countdown(iso) {
    const s = Math.max(0, Math.round((new Date(iso) - Date.now()) / 1000));
    return { text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, soon: s < 300, gone: s === 0 };
  }

  function render() {
    const tbody = $('rows');
    const visible = rooms.filter((r) => !countdown(r.expiresAt).gone);
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty"></td></tr>`;
      tbody.querySelector('.empty').textContent = I.t('admin.empty');
      return;
    }
    tbody.innerHTML = '';
    for (const r of visible) {
      const c = countdown(r.expiresAt);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="room"></td>
        <td class="num created"></td>
        <td class="num closes${c.soon ? ' soon' : ''}" data-exp="${r.expiresAt}"></td>
        <td class="num"><span class="dot${r.participants ? ' live' : ''}"></span><span class="count"></span></td>
        <td class="lang-cell"></td>
        <td><div class="actions">
          <button class="btn small-btn" type="button" data-act="copy"></button>
          <a class="btn soft small-btn" target="_blank" rel="noopener" data-act="open"></a>
          <button class="btn danger small-btn" type="button" data-act="end"></button>
        </div></td>`;
      tr.querySelector('.room').textContent = r.room;
      tr.querySelector('.created').textContent = r.createdAt ? I.time(r.createdAt) : '–';
      tr.querySelector('.closes').textContent = c.text;
      tr.querySelector('.count').textContent = String(r.participants ?? 0);
      tr.querySelector('.lang-cell').textContent = I.t('lang.' + r.lang);

      const copyBtn = tr.querySelector('[data-act="copy"]');
      copyBtn.textContent = I.t('admin.copy');
      copyBtn.addEventListener('click', () => copy(r.link, copyBtn));

      const openLink = tr.querySelector('[data-act="open"]');
      openLink.textContent = I.t('admin.open');
      openLink.href = r.link + '&name=Interviewer';

      const endBtn = tr.querySelector('[data-act="end"]');
      endBtn.textContent = I.t('admin.end');
      endBtn.addEventListener('click', () => endRoom(r, endBtn));

      tbody.appendChild(tr);
    }
  }

  // Two-step "End now" (no browser confirm dialog).
  async function endRoom(r, btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = I.t('admin.confirmEnd');
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = I.t('admin.end'); } }, 4000);
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch('/api/rooms/' + encodeURIComponent(r.room), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('delete ' + res.status);
      if (currentResult && currentResult.room === r.room) { currentResult = null; $('result').hidden = true; }
    } catch (err) {
      console.error(err);
      $('listError').textContent = I.t('admin.error');
      $('listError').hidden = false;
    }
    await loadRooms();
  }

  // Countdown ticks every second; data refreshes every 10 seconds.
  setInterval(() => {
    let expired = false;
    document.querySelectorAll('td.closes').forEach((td) => {
      const c = countdown(td.dataset.exp);
      td.textContent = c.text;
      td.classList.toggle('soon', c.soon);
      if (c.gone) expired = true;
    });
    if (expired) render();
  }, 1000);
  setInterval(loadRooms, REFRESH_MS);

  // ---------- Start ----------
  const startLang = I.pick(savedLang(), (navigator.language || '').slice(0, 2));
  $('langSelect').value = startLang;
  setLang(startLang).then(loadRooms);
})();
