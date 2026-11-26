# Pivot

Upload a 3D model on your laptop, scan a QR code with your phone, and rotate the model by moving the phone. No app install: the phone opens a web page and streams its orientation sensors to the laptop in real time.

## Layout

```
apps/web            Next.js app (desktop viewer + phone controller)
apps/api            FastAPI (REST + WebSocket hub)
packages/protocol   WebSocket protocol: spec + TypeScript types
infra               Caddyfile, dev compose overrides
```

## Run it

Prerequisite: Docker.

```sh
docker compose up --build
```

Open http://localhost:8080.

## What works now

- **Phase 1 – upload and viewer.** Drop a `.glb` / `.gltf` file (max 50 MB) on the page, or click
  "try the sample model". The model is centred, scaled to fit and can be rotated with the mouse.
- **Phase 2 – tunnel and pairing.** A cloudflared quick tunnel gives the stack a public HTTPS URL
  (phones only expose motion sensors on secure pages). The desktop shows a QR code; scan it,
  tap "Tap to connect", and both screens show that they are connected, with the round-trip time.
  The first start of the tunnel can take ~10 s ("Preparing secure link…").

## Development

- Hot reload: `docker compose -f docker-compose.yml -f infra/docker-compose.dev.yml up --build`
- Web checks (host): `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`
- API checks (container):
  `docker compose -f docker-compose.yml -f infra/docker-compose.dev.yml run --rm api pytest`
- Regenerate the sample model: `python apps/web/scripts/make_sample_glb.py`

See `AGENTS.md` for contribution rules.
