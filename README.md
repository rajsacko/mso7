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

## Deploy (leave Vercel)

This app writes to `data/` and runs Remotion + Chromium in-process. Plain serverless (Vercel / Cloudflare) is a poor fit.

**Recommended:** Hetzner CX22-class (~2–4 GB RAM) + [Coolify](https://coolify.io), or any Docker host with a persistent volume.

### Docker

```bash
docker compose up -d --build
```

- App: port `3000`  
- Volume: `mso7-data` → `/app/data` (projects, uploads, brand, renders)  
- Env: provide `.env.local` with `OPENAI_API_KEY` if you need caption extract  

### Coolify on Hetzner (short)

1. Create a Hetzner CX22 (or similar, 4 GB RAM preferred for export).  
2. Install Coolify; create a new service from this repo.  
3. Build with the included `Dockerfile`.  
4. Attach a persistent volume at `/app/data`.  
5. Set env vars from `.env.example`; expose HTTPS.  
6. Keep **one** always-on instance (do not horizontal-scale until you move `data/` to object storage).  

Fly.io / Railway also work if you attach a volume and size the machine for Chromium (~2–4 GB RAM). Free idle tiers are usually too small for export.

## Notes

- Preview and export share the same ClipReel path (overlays on the footage).  
- Timeline length accounts for transitions.  
- Remotion Studio (optional): `npm run remotion`  
- Keep `MAX_RENDER_SECONDS` modest on small hosts.  
