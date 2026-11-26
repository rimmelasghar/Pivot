# Pivot WebSocket protocol

Source of truth for messages between the phone, the api and the desktop. The TypeScript
types live in `src/index.ts`; the Pydantic mirror lives in `apps/api/pivot_api/ws/messages.py`.
Any change updates all three in the same commit.

**Endpoint:** `wss://<host>/ws/{sessionId}?role=desktop|phone&token=...&cid=...`

- `role=desktop` uses the `desktopToken` from `POST /api/sessions`.
- `role=phone` uses the `pairToken` from the QR link (`/c/{sessionId}?t={pairToken}`).
  Only one phone may be connected at a time; a second one gets `already_paired` and is closed.
- `cid` (phone, optional): a random id the phone page keeps for the session. A phone with the
  same `cid` may take its slot back while the server still holds its old connection (for example
  right after a network drop or an api restart).

All messages are JSON objects with a `t` (type) field. The server rejects unknown fields.
Sensor messages are sent up to 60 times per second, so keep them small.

| Type | Direction | Payload | Notes |
| --- | --- | --- | --- |
| `hello` | client → server | `{ t, role, client: { ua, platform } }` | First message after connect |
| `peer` | server → both | `{ t, connected: boolean }` | Sent when the other side joins or leaves |
| `q` | phone → desktop | `{ t, q: [x, y, z, w], s: seq, ts }` | Orientation quaternion, seq number, phone timestamp in ms |
| `recenter` | phone → desktop | `{ t }` | Current pose becomes the neutral pose |
| `mode` | phone → desktop | `{ t, mode: "full" or "tilt" }` | Tilt mode ignores yaw (for phones with poor compass) |
| `model` | server → phone | `{ t, name }` | Shows the model name on the phone |
| `ping` / `pong` | both | `{ t, ts }` | Every 5 s; measures round trip and keeps the connection alive |
| `error` | server → client | `{ t, code, message }` | e.g. `session_expired`, `already_paired` |

## Rules

- The server validates every message and drops malformed ones.
- `q`, `recenter` and `mode` from the phone are forwarded to the desktop without being stored.
- A `ping` from a client is answered by the server with a `pong` echoing `ts`.
- The desktop drops any `q` whose `s` is lower than the last one it applied.
- `error` codes: `session_expired`, `already_paired`, `bad_token`, `bad_role`, `invalid_message`,
  `rate_limited`.

## Close codes

| Code | Meaning |
| --- | --- |
| 4401 | Bad token (do not reconnect) |
| 4404 | Session expired or unknown (do not reconnect) |
| 4409 | Already paired: another phone is connected (do not reconnect) |
