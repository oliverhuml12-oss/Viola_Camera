// Shared helpers for the Vercel functions: Daily REST API + room naming.
// Files in api/_lib are not exposed as routes (underscore prefix).
import crypto from 'node:crypto';

const DAILY_API = 'https://api.daily.co/v1';

export const ROOM_PREFIX = process.env.ROOM_PREFIX || 'demo-';
export const ROOM_MINUTES = Number(process.env.ROOM_DURATION_MINUTES) || 30;
export const SITE_LANGS = ['cs', 'sk', 'en'];
export const DEFAULT_LANG = SITE_LANGS.includes(process.env.DEFAULT_LANG) ? process.env.DEFAULT_LANG : 'cs';

// Languages Daily Prebuilt's own buttons support. Czech and Slovak are not on
// Daily's list, so Daily's few labels fall back to English for them, while all
// of our own text stays translated. Check Daily's docs before adding more.
const DAILY_UI_LANGS = ['en'];
export function dailyLang(lang) {
  return DAILY_UI_LANGS.includes(lang) ? lang : 'en';
}

export class DailyError extends Error {
  constructor(status, body) {
    super(`Daily API ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
  }
}

export async function daily(path, { method = 'GET', body } = {}) {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error('DAILY_API_KEY is not set');
  const res = await fetch(DAILY_API + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) throw new DailyError(res.status, data);
  return data;
}

// "Anna Nováková" -> "anna-novakova"
export function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 20).replace(/-+$/, '');
}

// Room name: <prefix><lang>-<readable>-<random>, e.g. demo-cs-anna-novakova-7f3k2a
// The language is part of the name, so no database is needed to remember it.
export function newRoomName(label, lang) {
  const readable = slugify(label);
  const random = crypto.randomBytes(3).toString('hex');
  return [ROOM_PREFIX + lang, readable, random].filter(Boolean).join('-');
}

const NAME_RE = /^[a-z0-9-]{3,60}$/;
export function isDemoRoomName(name) {
  return typeof name === 'string' && NAME_RE.test(name) && name.startsWith(ROOM_PREFIX);
}

export function langFromRoomName(name) {
  const code = String(name).slice(ROOM_PREFIX.length, ROOM_PREFIX.length + 2);
  return SITE_LANGS.includes(code) ? code : DEFAULT_LANG;
}

export function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function roomLink(req, name) {
  return `${baseUrl(req)}/call/${name}?lang=${langFromRoomName(name)}`;
}

// Normalise a Daily room object into what our pages need.
export function describeRoom(req, room) {
  const exp = room.config?.exp;
  return {
    room: room.name,
    link: roomLink(req, room.name),
    lang: langFromRoomName(room.name),
    createdAt: room.created_at ? new Date(room.created_at).toISOString() : null,
    expiresAt: exp ? new Date(exp * 1000).toISOString() : null,
  };
}

export function isActive(room, nowSec = Math.floor(Date.now() / 1000)) {
  const exp = room.config?.exp;
  const nbf = room.config?.nbf;
  return !!exp && exp > nowSec && (!nbf || nbf <= nowSec);
}

export function sendError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}
