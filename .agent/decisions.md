# Decisions

## Approved

| Date | Decision |
|---|---|
| 2026-11-25 | Work on `dev`; PR target `main`. Standing approval to commit and push verified milestones to `origin/dev` |
| 2026-11-25 | T0 accepted. T1 accepted as a **partial** mitigation of S1, not a full fix |
| 2026-11-25 | `Hospital.tsx` PIN screen error handling (shows the server message on 429/400/503) approved |
| 2026-11-25 | In-memory rate limiting; run a single Render instance |
| 2026-11-25 | `X-Forwarded-For` read only from a private peer, last entry only; IPv6 grouped by /64 |
| 2026-11-25 | Wrong PIN keeps returning `200 {doctor: null}` (no frontend change) |
| 2026-11-25 | Public demo PIN `1234` refused when `NODE_ENV` or `VERCEL_ENV` is `production` |
| 2026-11-25 | Spec deviations kept as built: email alerts instead of SMS; join link instead of the "Check" tick/cross; React 19 |
| 2026-11-25 | No automatic dependency upgrades (`npm audit fix --force` would downgrade majors) |
| 2026-11-25 | T2: no schema change. The join token carries its issue time (`j1_<ms base36>_<48 hex>`); legacy tokens fall back to `created_at`, which is correct because they were only issued at creation. TTL 72 h |
| 2026-11-25 | T2: re-invite is refused once a help person has joined (no silent replacement of an alert recipient) |
| 2026-11-25 | 5xx logs record the request path only, never the query string |

## Deferred (need team approval; keep in roadmap)

- **D1 (S1 full fix):** MDCN number + longer PIN sign-in, salted scrypt PIN hash with migration, persistent per-doctor lockout and rate limits.
- **D2 (T7):** build "Delete my card" and emergency-link revocation?
- **D3 (T6):** how the patient authorises a doctor (confirm on the patient's own phone, or a code from the patient's card).
- **D4 (T14):** Termii SMS vs email for family alerts; needs a Termii key and sender ID.
- Atomic fact updates (T8) via a Postgres function: needs migration approval.
- New dependencies or env vars: T5, T19, T21, T23.
