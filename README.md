# Viola_Camera

Two parts for Viola's caregiver hiring flow, on one Vercel site:

1. **Camera check** (`/`): step 3 of 5 in the test flow. Confirms the candidate's camera works.
2. **Video call demo** (`/admin` and `/call/<room>`): browser video interviews powered by [Daily](https://www.daily.co). No app, no sign-up.

Because both run on the same domain, a candidate who allowed the camera in the camera check usually won't be asked again on the call page. Android Chrome remembers this reliably; iPhone Safari may ask once more.

## Camera check

- Czech, Slovak and English UI; picks the browser language and falls back to Czech
- Clear states: idle, waiting for permission, success, failure
- Specific failure messages for blocked permission (with iPhone and Chrome hints), no camera found, camera in use by another app, and unsupported browser
- Reduced-motion support
- The "Continue" button currently only shows a mock note where the next test step would go.

## Video call demo

**Admin page (`/admin`)**: create a room (optional candidate name + call language), copy its link, and see active meetings with a live countdown and how many people are connected. **End now** closes a room for everyone. No sign-in, since this is a demo.

**Call page (`/call/<room>`)**: the candidate taps **Join call** once and is in. The page has no name field, lobby, chat or screen share. Every room closes automatically **30 minutes after it was created**, and everyone still in it is removed.

Links look like `https://<site>/call/demo-cs-anna-novakova-7f3k2a?lang=cs`. The same link works for everyone. **Open call** on the admin page adds `&name=Interviewer` so you show up with that name.

### How it works

| Part | File |
| --- | --- |
| Create / list rooms | `api/rooms.js` (`POST` / `GET /api/rooms`) |
| End a room | `api/rooms/[room].js` (`DELETE /api/rooms/:room`) |
| Join token for a room | `api/token.js` (`GET /api/token?room=…&name=…`) |
| Daily API helper, room naming | `api/_lib/daily.js` |
| Pages | `admin.html`, `call.html` + `assets/admin.js`, `assets/call.js` |
| Shared Viola styles, translations | `assets/viola.css`, `assets/i18n.js`, `i18n/{cs,sk,en}.json` |
| Routes | `vercel.json` |

- Rooms are created **private** in Daily with `exp` = now + 30 min and `eject_at_room_exp`, so Daily itself closes them on time.
- There is no database. The list comes from Daily's API; demo rooms are recognised by the `demo-` prefix, and the call language is part of the room name.
- The Daily API key stays on the server (Vercel functions). The browser only ever gets a short-lived meeting token for one room.
- The call is Daily Prebuilt in an iframe, themed with the Viola colours, loaded from `unpkg.com/@daily-co/daily-js@0.89.1`.
- Languages: all of our own text is in Czech, Slovak or English. Daily's own call buttons don't come in Czech or Slovak, so those few labels stay in English.

### Setup

1. Create a free account at [dashboard.daily.co](https://dashboard.daily.co). The free tier covers 10,000 participant-minutes a month (about 165 thirty-minute calls with two people).
2. Copy the API key from **Developers**.
3. In Vercel, open this project → **Settings → Environment Variables** and add `DAILY_API_KEY`. The optional variables are listed in `.env.example`.
4. Redeploy. Open `https://<your-site>/admin`.

**Local development:** camera access needs HTTPS or `localhost`, and the API routes need Vercel's runtime:

```sh
npm i -g vercel
cp .env.example .env   # add your DAILY_API_KEY
vercel dev             # then open http://localhost:3000/admin
```

Static pages only (camera check) still work with `python3 -m http.server 8000`.

### Demo limitations

- **No sign-in:** anyone who finds `/admin` can create or end rooms on your Daily account. Pages are marked `noindex`, but don't share the admin URL publicly. Add a login before real use.
- Not tested on real devices yet. Test with an iPhone (Safari) and an Android phone (Chrome), on mobile data, and by tapping the link inside WhatsApp.

## Notes

- Styling follows the Viola UK website: Onest font, blue/ink colour tokens, pill buttons and soft cards. The logo lives in `images/logo.png`.
