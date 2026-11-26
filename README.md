# Pivot

Upload a 3D model on your laptop, scan a QR code with your phone, and rotate the model by moving the phone. No app install: the phone opens a web page and streams its orientation sensors to the laptop in real time.

## Layout

```
apps/web            Next.js app (desktop viewer + phone controller)
apps/api            FastAPI (REST + WebSocket hub)
packages/protocol   WebSocket protocol: spec + TypeScript types
infra               Caddyfile, dev compose overrides
```

## Status

Work in progress. See `AGENTS.md` for contribution rules.
