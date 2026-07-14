# MSO7 / Maison Edit

Clip-first video studio for Maison Sacko — upload footage, place text/logo overlays on the frame, record mic voiceover, extract captions, export with Remotion.

## Quick start (local)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow

1. **Brand kit** — wordmark, palette, logo, music bed  
2. **New piece** — format (Reel 9:16 / YouTube 16:9)  
3. **Studio** — clips, overlays (drag to place), music, mic VO, captions  
4. **Export** — server Remotion render → download MP4  

Voiceover is **microphone only** (no AI TTS).

## Deploy (Coolify + Docker — recommended)

**Do not use Vercel for studio.** Disk is ephemeral → New piece works, then `/studio/...` 404s.

Full Coolify steps (auto-redeploy on `git push`): see **[DEPLOY.md](./DEPLOY.md)**.

```bash
docker compose up -d --build
```

- Port `3000`, volume → `/app/data`  
- Repo: https://github.com/rajsacko/mso7

## Notes

- Preview and export share the same ClipReel path (overlays on the footage).  
- Timeline length accounts for transitions.  
- Remotion Studio (optional): `npm run remotion`  
- Keep `MAX_RENDER_SECONDS` modest on small hosts.  
