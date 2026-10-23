// DELETE /api/rooms/:room -> end the room now (everyone is disconnected)
import { daily, isDemoRoomName, DailyError, sendError } from '../_lib/daily.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const name = req.query.room;
  if (!isDemoRoomName(name)) return res.status(404).json({ error: 'not_found' });
  try {
    await daily('/rooms/' + encodeURIComponent(name), { method: 'DELETE' });
    return res.status(204).end();
  } catch (err) {
    if (err instanceof DailyError && err.status === 404) return res.status(204).end();
    return sendError(res, err);
  }
}
