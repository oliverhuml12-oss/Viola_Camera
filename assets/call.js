// Call page: /call/<room>?lang=cs&name=Interviewer
(() => {
  const I = window.ViolaI18n;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const room = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
  const displayName = (params.get('name') || '').trim().slice(0, 40);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Daily theme = Viola brand colours.
  const THEME = {
    colors: {
      accent: '#2265cc', accentText: '#ffffff',
      background: '#ffffff', backgroundAccent: '#f4f7fc',
      baseText: '#0e1b33', border: '#e6ebf3',
      mainAreaBg: '#0e1b33', mainAreaBgAccent: '#1b2a47', mainAreaText: '#ffffff',
      supportiveText: '#55607a',
    },
  };

  const ICONS = {
    ok: '<path d="M11 25l9 9 17-19"/>',
    bad: '<path d="M14 14l20 20M34 14L14 34"/>',
    cam: '<rect x="5" y="13" width="27" height="22" rx="5"/><path d="M32 21l11-6v18l-11-6z"/>',
  };

  let creds = null;     // { roomUrl, token, lang, dailyLang, expiresAt }
  let call = null;      // Daily call frame
  let expiryTimer = null;
  let finished = false;
  let retryAction = null;

  function showJoin() {
    $('joinScreen').hidden = false;
    $('messageScreen').hidden = true;
  }

  function showMessage({ icon, title, text, hint, retry }) {
    leaveCallUI();
    $('msgIcon').className = 'icon-disc' + (icon === 'ok' ? ' ok' : icon === 'bad' ? ' bad' : '');
    $('msgSvg').innerHTML = ICONS[icon] || ICONS.cam;
    $('msgTitle').textContent = I.t(title);
    $('msgText').textContent = I.t(text);
    $('msgHint').hidden = !hint;
    if (hint) $('msgHint').textContent = I.t(hint);
    retryAction = retry || null;
    $('retryBtn').hidden = !retry;
    $('joinScreen').hidden = true;
    $('messageScreen').hidden = false;
  }

  const ended = () => { finished = true; showMessage({ icon: 'ok', title: 'call.endedTitle', text: 'call.endedText' }); };
  const notActive = () => { finished = true; showMessage({ icon: 'bad', title: 'call.notActiveTitle', text: 'call.notActiveText' }); };
  const failed = (retry) => showMessage({ icon: 'bad', title: 'call.errorTitle', text: 'call.errorText', retry });
  const cameraBlocked = () => showMessage({
    icon: 'cam', title: 'call.cameraTitle', text: 'call.cameraText',
    hint: isIOS ? 'call.hintIos' : 'call.hintOther', retry: join,
  });

  function setJoinButton(key, enabled) {
    const btn = $('joinBtn');
    btn.dataset.t = key;
    btn.textContent = I.t(key);
    btn.disabled = !enabled;
  }

  // 1) On load: check the room and get a token, before any tap.
  async function prepare() {
    showJoin();
    setJoinButton('call.checking', false);
    try {
      const q = new URLSearchParams({ room });
      if (displayName) q.set('name', displayName);
      const res = await fetch('/api/token?' + q, { cache: 'no-store' });
      if (res.status === 404) return notActive();
      if (!res.ok) throw new Error('token ' + res.status);
      creds = await res.json();
    } catch (err) {
      console.error(err);
      return failed(prepare);
    }

    // The room's language wins unless the link sets ?lang= explicitly.
    if (!params.get('lang') && creds.lang && creds.lang !== I.lang) await I.load(creds.lang);

    const msLeft = new Date(creds.expiresAt) - Date.now();
    if (msLeft <= 0) return notActive();
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => { if (!finished) ended(); }, msLeft);

    $('closesAt').textContent = I.t('call.closesAt', { time: I.time(creds.expiresAt) });
    $('closesAt').hidden = false;
    setJoinButton('call.join', true);
  }

  // 2) One tap: create the Daily frame and join (the tap also unlocks sound on iPhone).
  async function join() {
    if (!creds) return prepare();
    if (new Date(creds.expiresAt) <= Date.now()) return notActive();
    showJoin();
    setJoinButton('call.connecting', false);

    const Daily = window.DailyIframe || window.Daily;
    if (!Daily) return failed(() => location.reload());

    destroyCall();
    $('callScreen').hidden = false;
    call = Daily.createFrame($('callScreen'), {
      iframeStyle: { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0' },
      showLeaveButton: true,
      showFullscreenButton: false,
      showLocalVideo: true,
      showParticipantsBar: false,
      lang: creds.dailyLang || 'en',
      theme: THEME,
    });

    const frame = call;
    const active = () => call === frame;   // false once this frame is being destroyed

    frame
      .on('joined-meeting', () => { if (active()) document.body.classList.add('in-call'); })
      .on('left-meeting', () => { if (active() && !finished) ended(); })
      .on('camera-error', (ev) => {
        if (!active()) return;
        const type = ev?.error?.type;
        if (type === 'permissions' || type === 'cam-in-use' || type === 'not-found') cameraBlocked();
      })
      .on('error', (ev) => {
        console.error('Daily error', ev);
        if (!active() || finished) return;
        // Room expired or was ended from the admin page -> "call ended".
        if (new Date(creds.expiresAt) - Date.now() < 5000 || /ended|eject|expired/i.test(ev?.errorMsg || '')) return ended();
        failed(join);
      });

    try {
      await frame.join({ url: creds.roomUrl, token: creds.token });
    } catch (err) {
      console.error(err);
      if (active() && !finished) failed(join);
    }
  }

  function leaveCallUI() {
    document.body.classList.remove('in-call');
    destroyCall();
  }

  function destroyCall() {
    if (call) {
      const c = call;
      call = null;   // events from a frame being torn down are ignored (see `active`)
      try { c.destroy(); } catch (e) { /* already gone */ }
    }
    $('callScreen').hidden = true;
    $('callScreen').innerHTML = '';
  }

  $('joinBtn').addEventListener('click', join);
  $('retryBtn').addEventListener('click', () => retryAction && retryAction());
  window.addEventListener('pagehide', () => { finished = true; destroyCall(); });

  I.load(params.get('lang')).then(prepare);
})();
