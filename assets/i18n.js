// Tiny translation helper shared by the call and admin pages.
// Strings live in /i18n/<lang>.json; elements with data-t="key" get the text.
window.ViolaI18n = (() => {
  const LANGS = ['cs', 'sk', 'en'];
  const DEFAULT = 'cs';
  let strings = {};
  let current = DEFAULT;

  function pick(...candidates) {
    for (const c of candidates) if (c && LANGS.includes(c)) return c;
    return DEFAULT;
  }

  async function load(lang) {
    current = pick(lang);
    const res = await fetch(`/i18n/${current}.json`, { cache: 'no-cache' });
    strings = await res.json();
    document.documentElement.lang = current;
    apply();
    return current;
  }

  function t(key, vars = {}) {
    const s = strings[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  function apply(root = document) {
    root.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    root.querySelectorAll('[data-t-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.tPlaceholder); });
  }

  function time(iso) {
    return new Date(iso).toLocaleTimeString(current, { hour: '2-digit', minute: '2-digit' });
  }

  return { LANGS, DEFAULT, pick, load, t, apply, time, get lang() { return current; } };
})();
