// GET /api/token?room=<name>&name=<display name>
// Checks the room is an active demo room and returns a meeting token that
// expires together with the room.
import {
  daily, isDemoRoomName, isActive, langFromRoomName, dailyLang, DailyError, sendError,
} from './_lib/daily.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const name = req.query.room;
  if (!isDemoRoomName(name)) return res.status(404).json({ error: 'not_active' });

  let room;
  try {
    room = await daily('/rooms/' + encodeURIComponent(name));
  } catch (err) {
    if (err instanceof DailyError && err.status === 404) return res.status(404).json({ error: 'not_active' });
    return sendError(res, err);
  }
  if (!isActive(room)) return res.status(404).json({ error: 'not_active' });

  const lang = langFromRoomName(name);
  const userName = String(req.query.name || '').trim().slice(0, 40) || 'Candidate';

  try {
    const { token } = await daily('/meeting-tokens', {
      method: 'POST',
      body: {
        properties: {
          room_name: name,
          user_name: userName,
          exp: room.config.exp,
          eject_at_token_exp: true,
          is_owner: false,
          lang: dailyLang(lang),
        },
      },
    });
    return res.status(200).json({
      roomUrl: room.url,
      token,
      lang,
      dailyLang: dailyLang(lang),
      expiresAt: new Date(room.config.exp * 1000).toISOString(),
    });
  } catch (err) {
    return sendError(res, err);
  }
}
