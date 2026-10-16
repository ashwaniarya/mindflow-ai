# MindFlow AI session service

Node 20 service on Railway that proxies xAI. Stores chat sessions in Postgres.

## Env
| Var | Purpose |
|---|---|
| `XAI_API_KEY` | xAI key (server only) |
| `DATABASE_URL` | Postgres (Railway reference `${{Postgres.DATABASE_URL}}`) |
| `APP_KEYS` | `app:key,app2:key2` per-app API keys, sent as `X-API-Key` |
| `CORS_ORIGINS` | comma list; `*` wildcard inside a host is allowed |
| `TTS_SERVICE_TOKEN` | token for `/v1/tts`, sent as `X-Service-Token` |
| `RATE_LIMIT_PER_MIN` | per app key (default 60) |
| `XAI_MODEL` | default `grok-4.20-0309-non-reasoning` |

## Endpoints
- `GET /health` → `{ ok: true }`
- `POST /v1/sessions` `{ system?, message?, stream?, response_format? }` → `201 { session_id }`, or with `message` the first reply (`{ session_id, reply, usage }` or SSE).
- `POST /v1/sessions/:id/messages` `{ message, stream?, response_format? }` → `{ session_id, reply, usage }`; with `stream: true`, SSE `event: delta` `{text}` … `event: done` `{session_id, reply}`.
- `GET /v1/sessions/:id` → `{ session_id, system, messages: [{role, content, created_at}] }`
- `POST /v1/complete` `{ messages, tools?, tool_choice?, response_format?, stream? }` (OpenAI format, stateless) → `{ message, finish_reason, usage }`
- `POST /v1/tts` `{ text (≤5000), voice? = "eve", language? = "en" }` + `X-Service-Token` → `audio/mpeg` bytes
- `GET /v1/tts/voices` + `X-Service-Token` → xAI voice list

Errors: `{ error }` with 400/401/404/413/429/502.
