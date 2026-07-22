# Deploy MSO7 / Maison Edit — Coolify + Docker on Hetzner

This app needs **one always-on Node process + Chromium (Remotion) + ffmpeg + disk**.  
Do **not** use Vercel/Netlify. Local `npm run dev` is for craft; production is Docker.

**Repo:** https://github.com/rajsacko/mso7  
**Recommended host:** Hetzner Cloud **CX22** (~€4–5/mo, 2 vCPU / 4 GB) + [Coolify](https://coolify.io)

---

## 1. Create the VPS (once)

1. Sign up at [Hetzner Cloud](https://www.hetzner.com/cloud).
2. **New project** → **Add server**:
   - Location: closest to you / clients
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (4 GB RAM — minimum for Remotion export)
   - SSH key: add yours
3. Create the server. Note the **public IPv4**.
4. In the Hetzner firewall (or leave Coolify to manage): allow **22**, **80**, **443**.

---

## 2. Install Coolify (once)

SSH in:

```bash
ssh root@YOUR_SERVER_IP
```

Install Coolify (official installer):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open `http://YOUR_SERVER_IP:8000`, create the admin account, and finish the wizard.  
Optional: attach a domain to Coolify itself later.

Docs: https://coolify.io/docs/installation

---

## 3. Deploy MSO7 in Coolify (once)

1. Coolify → **+ New Resource** → **Public Repository** (or GitHub App if you prefer private later).
2. Repository URL: `https://github.com/rajsacko/mso7`
3. Branch: **`master`**
4. Build pack:
   - **Dockerfile** (root `Dockerfile`) — simplest  
   - **or** Docker Compose → `docker-compose.yml` (volume already defined)
5. **Persistent storage** (required if using Dockerfile alone):
   - Add a volume: host path or Coolify volume → container path **`/app/data`**
6. **Environment variables**:

| Key | Value |
|-----|--------|
| `OPENAI_API_KEY` | your key (captions from speech) |
| `MAX_RENDER_SECONDS` | `180` |
| `DATA_ROOT` | `/app/data` |
| `REMOTION_CHROME_EXECUTABLE_PATH` | `/usr/bin/chromium` |

7. **Ports:** expose container **3000** (Coolify HTTP/HTTPS proxy).
8. Domain: assign a domain → enable **HTTPS**.
9. Enable **Auto Deploy** on push to `master`.
10. **Deploy**. First build installs Chromium + ffmpeg — expect several minutes.

After this, every `git push origin master` can redeploy automatically.  
`/app/data` keeps projects, uploads, brand kit, and renders across deploys.

---

## 4. Smoke test (after green deploy)

On the live HTTPS URL:

1. **Library** → New piece → upload a short phone/camera clip.
2. Select the clip → **Edit → Audio** → Medium → **Reduce noise on clip** → play and listen.
3. **Captions** → language → **Generate from speech** → confirm lines + karaoke highlight while playing.
4. **Export** → wait for progress → **Download** MP4.
5. Refresh the page → project still listed (volume persistence).

If export fails with Chromium errors: confirm `REMOTION_CHROME_EXECUTABLE_PATH=/usr/bin/chromium` and that the container has ≥4 GB RAM.

---

## 5. Day-to-day

```bash
git add -A
git commit -m "your message"
git push origin master
```

Coolify rebuilds and restarts. Data volume is untouched.

---

## 6. Stop using Vercel

Pause or remove any old Vercel `mso7` project so traffic only hits Coolify.

---

## Specs

| Item | Value |
|------|--------|
| Image | Multi-stage `Dockerfile` (Node 20 + Chromium + ffmpeg) |
| Listen | `0.0.0.0:3000` |
| Data | `/app/data` volume |
| Chrome | `/usr/bin/chromium` (Docker-hardened Remotion options) |
| Instances | **1** (do not scale horizontally yet) |
| Compose | Optional — see `docker-compose.yml` |
