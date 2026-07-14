# Deploy MSO7 on Coolify (clean path — leave Vercel)

Vercel shows library/studio **404** because projects are stored on disk and serverless `/tmp` does not persist. Coolify + Docker keeps one always-on container with a **volume** at `/app/data`.

**Repo:** https://github.com/rajsacko/mso7

---

## 1. Server (once)

1. Create a **Hetzner Cloud CX22** (or similar): **4 GB RAM** preferred for Remotion export.  
2. Install [Coolify](https://coolify.io/docs/installation) on that VPS.  
3. Point a domain (optional) at the server IP in Coolify.

---

## 2. App in Coolify (once)

1. Coolify → **New Resource** → **Public Repository**  
2. URL: `https://github.com/rajsacko/mso7`  
3. Branch: `master`  
4. Build pack: **Dockerfile** (root `Dockerfile`)  
   - Or **Docker Compose** using `docker-compose.yml`  
5. **Persistent storage**  
   - Mount: host volume → container path `/app/data`  
6. **Environment** (optional):  
   - `OPENAI_API_KEY=` (captions only)  
   - `MAX_RENDER_SECONDS=180`  
   - `DATA_ROOT=/app/data`  
7. Port: **3000**  
8. Enable **HTTPS** + **Auto deploy on push** (GitHub webhook / Coolify Git integration).  
9. Deploy.

After this, every `git push` to `master` can **redeploy** automatically.

---

## 3. Day-to-day

```bash
# after local changes
git add -A
git commit -m "your message"
git push origin master
```

Coolify rebuilds and restarts. `/app/data` volume keeps projects, uploads, brand, and renders.

---

## 4. Stop using Vercel for this app

In Vercel, you can remove or pause `mso7` so you only use Coolify. Studio will work on the Coolify URL (HTTPS domain you assign).

---

## Specs

| Item | Value |
|------|--------|
| Image | Dockerfile (multi-stage) |
| Listen | `0.0.0.0:3000` |
| Data | `/app/data` volume |
| Chrome | `/usr/bin/chromium` for Remotion |
| Instances | **1** (do not scale horizontally yet) |
