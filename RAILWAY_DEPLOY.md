# Railway Deployment Guide

This repo is deployed as three Railway services plus PostgreSQL.

## Services

Create one Railway project and add the services below.

Current repo note: `backend` and `frontend/app` are in the outer GitHub repo. The `secret-dinner` Telegram bot folder is currently a nested Git repo with its own remote, so Railway will only see it from the outer repo if you intentionally add it there. Otherwise deploy the bot as a separate Railway service from its own repo or with the Railway CLI.

| Service | Railway root directory | Dockerfile | Purpose |
| --- | --- | --- | --- |
| Frontend | `frontend/app` | `frontend/app/Dockerfile` | Public website and admin UI |
| Backend | `backend` | `backend/Dockerfile` | Landing API and admin API |
| Telegram bot | `secret-dinner` | `secret-dinner/Dockerfile` | Long-running Telegram bot worker |
| PostgreSQL | Railway Postgres | - | Database |

## Recommended database setup

Use one Railway PostgreSQL service and create two databases:

- `secret_dinner_landing`
- `secret_dinner_telegram`

Then set separate URLs:

- Backend `DATABASE_URL` points to `secret_dinner_landing`
- Backend `TELEGRAM_DATABASE_URL` points to `secret_dinner_telegram`
- Bot `DATABASE_URL` points to `secret_dinner_telegram`
- Bot `LANDING_DATABASE_URL` points to `secret_dinner_landing`

Using one Postgres service keeps early costs lower than running two separate Postgres services.

## Backend variables

Set these on the `backend` Railway service:

```env
DATABASE_URL=postgresql://...
TELEGRAM_DATABASE_URL=postgresql://...
FRONTEND_ORIGIN=https://your-frontend.up.railway.app

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-strong-password
ADMIN_AUTH_SECRET=replace-with-long-random-secret
ADMIN_COOKIE_NAME=admin_session
ADMIN_COOKIE_SECURE=true
ADMIN_TOKEN_TTL_MINUTES=120
```

The backend Dockerfile sets:

```env
MIGRATIONS_PATH=/app/internal/db/migrations
```

Railway provides `PORT`; do not set `BACKEND_LISTEN_ADDR` unless you specifically need to override it.

## Telegram bot variables

Set these on the `telegram-bot` Railway service:

```env
TELEGRAM_TOKEN=replace-with-bot-token
ADMIN_IDS=123456789,987654321
SMART_GLOCAL_TOKEN=replace-with-payment-token
DATABASE_URL=postgresql://...
LANDING_DATABASE_URL=postgresql://...
```

The bot Dockerfile sets:

```env
MIGRATIONS_PATH=/app/internal/repo/db/migrations
```

This service should run as a worker. It does not need a public domain.

## Frontend variables

Set this on the `frontend` Railway service before building:

```env
VITE_API_BASE_URL=https://your-backend.up.railway.app
```

Because this is a Vite app, `VITE_API_BASE_URL` is baked into the frontend during build.

## Railway setup order

1. Create the Railway project.
2. Add PostgreSQL.
3. Create the two databases or schemas you want to use.
4. Add the backend service from GitHub with root directory `backend`.
5. Add the frontend service from GitHub with root directory `frontend/app`.
6. Add the Telegram bot service from its bot repo root, or move/add the bot folder into the GitHub monorepo first.
7. Set all variables above.
8. Deploy backend first, then bot, then frontend.
9. After frontend deploys, update backend `FRONTEND_ORIGIN` to the final frontend domain and redeploy backend.

## Local Docker checks

From the repo root:

```bash
docker build -t secret-dinner-backend ./backend
docker build -t secret-dinner-bot ./secret-dinner
docker build \
  --build-arg VITE_API_BASE_URL=http://localhost:8080 \
  -t secret-dinner-frontend ./frontend/app
```

## Notes

- Do not commit `.env` files.
- Keep one replica for each service at launch to control costs.
- The Telegram bot must not run in two replicas unless you move it to webhook mode or implement update locking.
- If the admin login works locally but not in production, verify `ADMIN_COOKIE_SECURE=true` and `FRONTEND_ORIGIN` exactly matches the frontend URL.
