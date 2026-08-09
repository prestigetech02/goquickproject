# GoQuick Web (buyer)

React + Vite + TypeScript customer web app. Talks to the same Laravel `/api/v1` as mobile.

## Setup

```bash
cd web
cp .env.example .env
# Edit VITE_API_BASE_URL and VITE_PAYSTACK_PUBLIC_KEY
npm install
npm run dev
```

App runs at **http://localhost:5173**.

### LAN / phone access

1. Restart Vite (`npm run dev`) — it binds to `0.0.0.0`.
2. Point `VITE_API_BASE_URL` at your PC’s LAN IP (not `127.0.0.1`), e.g. `http://192.168.4.217:8000/api/v1`.
3. Expose Laravel on the network:

```bash
cd backend
php artisan serve --host=0.0.0.0 --port=8000
```

4. On another device on the same Wi‑Fi open `http://<your-lan-ip>:5173`.

## Env

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API base, e.g. `http://127.0.0.1:8000/api/v1` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key (wallet funding) |
| `VITE_PLAY_STORE_URL` / `VITE_APP_STORE_URL` | Runner “get the app” links |
| `VITE_LANDING_URL` | Marketing site |
| `VITE_BROADCAST_DRIVER` | `pusher` (default) or `reverb` — must match backend `BROADCAST_CONNECTION` |
| `VITE_PUSHER_APP_KEY` / `VITE_PUSHER_APP_CLUSTER` | Pusher.com realtime (when driver is `pusher`) |
| `VITE_REVERB_APP_KEY` / `VITE_REVERB_HOST` / `VITE_REVERB_PORT` / `VITE_REVERB_SCHEME` | Laravel Reverb (when driver is `reverb`) |

Backend CORS already allows `http://localhost:5173` and `https://app.goquickapp.com.ng`. Extra origins: `CORS_ALLOWED_ORIGINS` in backend `.env`.

**Important:** all `VITE_*` values are baked in at **build time**. Wrong production values require a rebuild and redeploy.

## Auth / app surface

- Login (phone + password)
- Signup (phone OTP → verify)
- Forgot password
- Protected buyer layout (Home, Wallet, Errands, Chats, Profile, Notifications)
- Runners redirected to `/get-app`

---

## Live server deployment

Ship static files from `dist/` to **`https://app.goquickapp.com.ng`** (already listed in backend CORS). No Node process is required in production.

### What you’re deploying

| Piece | Detail |
|--------|--------|
| App | `web/` — React 19 + Vite 8 + TypeScript |
| Output | Static `dist/` after `npm run build` |
| Auth | Bearer token in `localStorage` / `sessionStorage` (cross-origin OK) |
| API | Same Laravel `/api/v1` as mobile |
| Realtime | Laravel Echo via Pusher.com **or** Reverb (`VITE_BROADCAST_DRIVER`) |
| Payments | Paystack public key baked in at build; callback = `{origin}/wallet` |
| Intended host | `https://app.goquickapp.com.ng` |

### Production topology (aaPanel)

```
https://goquickapp.com.ng     → landing
https://api.goquickapp.com.ng → Laravel API (required first)
https://app.goquickapp.com.ng → this web SPA
```

Also see the broader server guide: [`docs/DEPLOYMENT_AAPANEL.md`](../docs/DEPLOYMENT_AAPANEL.md).

### Plan (order of work)

1. Confirm API health + HTTPS on `api.goquickapp.com.ng`
2. DNS `A` for `app.goquickapp.com.ng` → VPS
3. Create aaPanel site + Let’s Encrypt SSL
4. Set production env for the web build
5. Build `dist/`
6. Nginx: document root = `dist`, SPA `try_files`
7. Align backend CORS / Paystack / store URLs
8. Smoke-test auth, API, chat, wallet
9. Document redeploy steps for the team

### How-to (aaPanel)

#### 1) Prerequisites

- API reachable at `https://api.goquickapp.com.ng/api/v1` (or your live API host)
- Node **18+** where you build (local or server)
- Domain DNS ready

#### 2) Create the site

In aaPanel:

1. **Website → Add site** → `app.goquickapp.com.ng`
2. Point DNS `A` record to the server IP
3. Enable **SSL → Let’s Encrypt** (force HTTPS)

Suggested paths:

```text
/www/wwwroot/app.goquickapp.com.ng
```

or, if the monorepo lives on the server:

```text
/www/wwwroot/errands/web/dist
```

#### 3) Production env (build-time)

Create `web/.env.production` (or export vars before build):

```bash
VITE_API_BASE_URL=https://api.goquickapp.com.ng/api/v1
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxx
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.goquick.app
VITE_APP_STORE_URL=https://apps.apple.com/app/goquick
VITE_LANDING_URL=https://goquickapp.com.ng
VITE_PUSHER_APP_KEY=<same as backend PUSHER_APP_KEY>
VITE_PUSHER_APP_CLUSTER=mt1
```

Do **not** ship LAN URLs (`192.168…`) or `pk_test_` for real payments.

#### 4) Build

**On the server:**

```bash
cd /www/wwwroot/errands/web
npm ci
npm run build
```

**Or build locally and upload only `dist/`:**

```bash
cd web
npm ci
npm run build
# upload contents of dist/ to the site root
```

Vite writes to `web/dist/` (`index.html` + `assets/`).

#### 5) Nginx (static SPA — required)

Set **website root** to the folder that contains `index.html` (the `dist` contents).

aaPanel rewrite / custom config:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Client routes like `/login`, `/errands/123`, and `/wallet` must fall back to `index.html`. Without this, a refresh returns 404.

Optional caching:

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Reload Nginx:

```bash
nginx -t && systemctl reload nginx
```

#### 6) Backend alignment

`https://app.goquickapp.com.ng` is already in `backend/config/cors.php`. If you use another domain:

```env
CORS_ALLOWED_ORIGINS=https://app.goquickapp.com.ng,https://other-origin
```

Then on the API host:

```bash
php artisan config:clear
# or config:cache after editing
```

Confirm:

| Backend | Web need |
|---------|----------|
| `BROADCAST_CONNECTION=pusher` | Matches Echo/Pusher client |
| Pusher key/cluster | Same as `VITE_PUSHER_*` |
| Paystack live secret on API | Matches live public key on web |
| Queue worker running | OTP, emails, jobs |

#### 7) Third-party dashboards

- **Paystack:** allow callback / redirect for `https://app.goquickapp.com.ng/wallet` (app uses `window.location.origin + '/wallet'`)
- **Pusher:** app key allowed for browser clients
- Store links: real Play / App Store URLs when apps are published

#### 8) Smoke test

1. `https://app.goquickapp.com.ng` loads over HTTPS
2. Hard refresh `/login` — no 404
3. Login / signup OTP against live API
4. Home / errands / profile load
5. Chat realtime (Pusher) when a message arrives
6. Fund wallet with a small live amount, or stay on test keys until ready

### Redeploy

```bash
cd /path/to/web
git pull
# update .env.production if needed
npm ci
npm run build
# if dist is not the site root, sync:
# rsync -av --delete dist/ /www/wwwroot/app.goquickapp.com.ng/
```

No PM2 for the web app — only rebuild and overwrite static files.

### Checklist

#### Before go-live

- [ ] API live: `https://api.goquickapp.com.ng` (or your API host)
- [ ] DNS `app.goquickapp.com.ng` → server
- [ ] SSL certificate active
- [ ] Production `VITE_*` set (HTTPS API, live Paystack if charging)
- [ ] `npm run build` succeeds (`tsc -b && vite build`)
- [ ] Site root = built files (`index.html` present)
- [ ] Nginx SPA `try_files` configured
- [ ] CORS allows the app origin (default includes `app.goquickapp.com.ng`)
- [ ] Pusher key/cluster match backend
- [ ] Paystack callback URL / domain configured
- [ ] `VITE_LANDING_URL` → marketing site
- [ ] Store URLs correct (or acceptable placeholders)

#### After deploy

- [ ] HTTPS loads; no mixed-content warnings
- [ ] Direct URL `/errands` and refresh works
- [ ] Login + authenticated API calls work (Network: `Authorization: Bearer …`)
- [ ] Signup OTP / forgot password
- [ ] Runner hitting web sees `/get-app`
- [ ] Chat realtime works
- [ ] Wallet funding redirect returns to `/wallet`
- [ ] Mobile browsers (iOS Safari + Android Chrome) spot-check

#### Ops / security

- [ ] No `APP_DEBUG=true` on API
- [ ] No LAN / `localhost` API URL in the built bundle
- [ ] Only public keys in frontend env (never secret keys)
- [ ] Redeploy process noted for the team

### Common failures

| Symptom | Likely cause |
|---------|----------------|
| Blank page / wrong API host | Built with old `.env`; rebuild with production vars |
| CORS errors in console | Origin not in CORS list / typo / www vs non-www |
| 404 on refresh of `/login` | Missing SPA `try_files` |
| Chat never updates | Wrong Pusher key/cluster or backend not on `pusher` |
| Paystack returns then fails | Test vs live key mismatch, or callback URL not allowed |
| Assets 404 | Uploaded wrong folder (uploaded `web/` instead of `dist/` contents) |

### vs landing / admin

| App | Runtime |
|-----|---------|
| Landing | Node/PM2 **or** static `out/` |
| **Web (buyer)** | **Static `dist/` only** |
| API | PHP-FPM + Laravel |
