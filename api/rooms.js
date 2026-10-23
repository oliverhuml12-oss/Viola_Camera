// GET  /api/rooms  -> active demo rooms with live participant counts
// POST /api/rooms  -> create a room that is open for ROOM_DURATION_MINUTES
import {
  daily, newRoomName, isDemoRoomName, isActive, describeRoom, dailyLang,
  SITE_LANGS, DEFAULT_LANG, ROOM_MINUTES, sendError,
} from './_lib/daily.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') return await createRoom(req, res);
    if (req.method === 'GET') return await listRooms(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}

async function createRoom(req, res) {
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const lang = SITE_LANGS.includes(body.lang) ? body.lang : DEFAULT_LANG;
  const now = Math.floor(Date.now() / 1000);

  const room = await daily('/rooms', {
    method: 'POST',
    body: {
      name: newRoomName(body.name, lang),
      privacy: 'private',
      properties: {
        nbf: now,
        exp: now + ROOM_MINUTES * 60,
        eject_at_room_exp: true,
        max_participants: 4,
        enable_prejoin_ui: false,
        enable_knocking: false,
        enable_chat: false,
        enable_screenshare: false,
        enable_people_ui: false,
        enable_emoji_reactions: false,
        enable_hand_raising: false,
        start_video_off: false,
        start_audio_off: false,
        lang: dailyLang(lang),
      },
    },
  });

  return res.status(201).json(describeRoom(req, room));
}

async function listRooms(req, res) {
  // All rooms on the Daily account (paginated), filtered to active demo rooms.
  const rooms = [];
  let after = null;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ limit: '100' });
    if (after) q.set('starting_after', after);
    const { data = [] } = await daily('/rooms?' + q);
    rooms.push(...data);
    if (data.length < 100) break;
    after = data[data.length - 1].id;
  }
  const active = rooms.filter((r) => isDemoRoomName(r.name) && isActive(r));

  // Who is connected right now: { "<room-name>": [participants] }
  let presence = {};
  if (active.length) {
    try { presence = await daily('/presence'); } catch (err) { console.error(err); }
  }

  const list = active
    .map((r) => ({ ...describeRoom(req, r), participants: countPresence(presence, r.name) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return res.status(200).json(list);
}

function countPresence(presence, name) {
  const entry = presence?.[name];
  return Array.isArray(entry) ? entry.length : 0;
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
