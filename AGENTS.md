# Rules for the AI agent

1. Work one commit at a time, in the order of the commit plan. Do not start the next commit until the current one meets its acceptance criteria.
2. Use Conventional Commits: `type(scope): summary`, e.g. `feat(api): add session create endpoint`. Scopes: `web`, `api`, `infra`, `protocol`, `docs`, `ci`.
3. Every commit must pass: lint, typecheck, unit tests, and `docker compose build`. Never commit with failing checks.
4. Every feature commit includes its tests in the same commit.
5. Do not add dependencies outside the tech stack table without writing the reason in the commit body.
6. Protocol changes update `packages/protocol` and the Pydantic models together, plus the protocol table in `packages/protocol/protocol.md`.
7. Never commit secrets. Only `.env.example` is tracked.
8. Keep files under about 300 lines; split by responsibility when larger.
9. Sensor and rendering hot paths: no React state updates per sensor message, no allocations inside `useFrame` (reuse quaternion objects).
10. At the end of each phase, update `README.md` with what now works and how to try it.
11. When something in the design turns out to be wrong or impossible, stop, explain the problem, and propose a change instead of silently working around it.

**Definition of done for a commit:** acceptance criteria met, checks green, no TODOs left without an issue reference, and the change is described in the commit body in 1–3 lines.
