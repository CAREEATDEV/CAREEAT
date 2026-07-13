# HYDRA — Backend (Supabase)

Backup + multi-device **sync** for the app's data, and **founder analytics**.
The app stays **offline-first**: the local store (`src/store/useHydration.ts` +
AsyncStorage) is the source of truth; Supabase is a mirror that backs it up and
syncs it across devices / after reinstall.

## Project identifiers

| | |
|---|---|
| Project name | **HYDRA** |
| Ref / project id | `zxrakxkiqfiinszavuqi` |
| API URL | `https://zxrakxkiqfiinszavuqi.supabase.co` |
| Publishable (anon) key | `sb_publishable_A51TxCrIYng_8fa5PtV_yw_TMNtjZAi` |
| Region | `eu-west-1` (Ireland — RGPD) |
| Org | SHIPPLY (separate project from SHIPPLY CARS — HYDRA is independent) |

The publishable key is **safe to ship in the app** — every table is locked by
Row Level Security, so it can only ever read/write the signed-in user's own rows.
**Never** put the `service_role` key in the app or in git.

## Schema

`schema.sql` is the version-controlled copy of what's live. Two tables, both
RLS-locked to `auth.uid()`:

- **`profiles`** — one row per user: `weight_kg, sex, sleep_start_hour,
  sleep_end_hour, awake_hours, ambient_temp_c, relative_humidity_pct, altitude_m,
  daily_goal_override_ml, default_water_ml, widget (jsonb), presets (jsonb),
  onboarded, timezone, locale, app_version, platform`. A row is auto-created on
  signup (trigger `handle_new_user`).
- **`events`** — the timestamped event log, one row per `HydrationEvent`:
  `client_id, type (water|electrolytes|alcohol|caffeine|sport|profile), at,
  volume_ml, abv, caffeine_mg, duration_min, intensity, patch (jsonb), deleted_at`.
  `unique (user_id, client_id)` makes sync **idempotent**; `deleted_at` is a
  soft-delete tombstone so undo/delete propagates across devices.

Field names map 1:1 to the TS types (snake_case ↔ camelCase). `patch` holds the
partial profile for `type='profile'` events.

## Auth

**Email is enabled by default.** For **Sign in with Apple** (iOS-first), configure
it once in the dashboard — it needs your Apple credentials, which only you have:

1. Apple Developer → **Certificates, IDs & Profiles**:
   - App ID with **Sign in with Apple** capability (bundle `com.shipply.hydraapp`).
   - A **Services ID** (e.g. `com.shipply.hydraapp.signin`) — this is the OAuth client id.
   - A **Sign in with Apple Key** → download the `.p8`, note the **Key ID** and
     your **Team ID `QN65J7X695`**.
2. Supabase dashboard → **Authentication → Providers → Apple** → enable, and fill
   the Services ID + the client secret (generated from the `.p8` / Key ID / Team ID).
   Docs: https://supabase.com/docs/guides/auth/social-login/auth-apple
3. In the app (native iOS), use `expo-apple-authentication` to get an identity
   token, then:
   ```ts
   await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })
   ```
   On **Android** (your personal APK), Sign in with Apple isn't native — use
   **email** (magic link or password) there. Same account model, both platforms.

## Client env vars (for the app, later)

```
EXPO_PUBLIC_SUPABASE_URL=https://zxrakxkiqfiinszavuqi.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_A51TxCrIYng_8fa5PtV_yw_TMNtjZAi
```

Add these to `app.config.js` `extra` (or read via `process.env.EXPO_PUBLIC_*`).
Keep them out of the widget target — sync is app-side only.

## Sync protocol (offline-first, to implement when wiring)

The local store stays authoritative. When signed in **and** online:

1. **Give every local event a stable `client_id`** (a uuid generated once when the
   event is created, persisted in AsyncStorage). This is the sync key.
2. **Push** — upsert changed rows, deduped by the unique key:
   ```ts
   await supabase.from('events').upsert(rows, { onConflict: 'user_id,client_id' });
   await supabase.from('profiles').upsert(profileRow); // user_id defaults to auth.uid()
   ```
   `user_id` is defaulted server-side to `auth.uid()`, so the client never sends it.
3. **Delete = soft delete**: set `deleted_at` (don't hard-delete) so other devices
   receive the tombstone on the next pull.
4. **Pull** — fetch only what changed since your cursor:
   ```ts
   const { data } = await supabase.from('events')
     .select('*').gt('updated_at', lastCursor).order('updated_at');
   ```
   Merge into the local store (apply `deleted_at` as a removal), then advance
   `lastCursor` to the max `updated_at` seen. Do the same for `profiles`.
5. **Conflicts**: last-write-wins by `updated_at` is fine (single user, personal
   data). The engine recomputes the level from events, so ordering doesn't matter.

Dependencies to add when wiring (not installed yet — backend-only task for now):
`@supabase/supabase-js`, `react-native-url-polyfill`, `expo-apple-authentication`,
`expo-secure-store` (session storage). Nothing added to the RN app in this step.

## Founder analytics

Private `analytics` schema — **not exposed to the API**, so no client can reach
it. Read it from the **SQL editor** (or the Supabase MCP). Aggregates only, no PII:

```sql
select * from analytics.overview;          -- users, onboarded, platform split, DAU/WAU/MAU
select * from analytics.signups_daily;      -- signups per day
select * from analytics.daily_consumption;  -- per day: active users, water mL, alcohol, ethanol g, sport
select * from analytics.daily_per_user;     -- per active user: avg water / alcohol / ethanol
```

## App integration — Phase 2 (WIRED ✅)

The app now has accounts + cloud sync. Files added:

- `src/lib/supabase.ts` — Supabase client (AsyncStorage session, auto-refresh).
- `src/store/useAuth.ts` — auth store: Apple / email sign-in, sign-up, sign-out,
  `deleteAccount()`.
- `src/screens/AuthScreen.tsx` — login / sign-up UI (Apple button on iOS + email).
- `src/sync/cloudSync.ts` — offline-first push/pull (idempotent events, tombstones,
  profile snapshot, delta cursor). Auto-runs on sign-in + debounced on local changes.
- `App.tsx` — gates the whole app behind sign-in (paid model), then onboarding.
- `WidgetsScreen` → **COMPTE** section: email, sign out, delete account.
- `backend/functions/delete-account/index.ts` — Edge Function (deployed), removes
  the caller's user; profiles/events cascade-delete.

Config keys live in `app.config.js` `extra` (URL + publishable key). Deps added:
`@supabase/supabase-js`, `react-native-url-polyfill`, `expo-apple-authentication`.

### ⚙️ What YOU must configure once (dashboard — not in code)

1. **Sign in with Apple** — follow the "Auth" section above (Services ID + `.p8`
   → Supabase → Auth → Providers → Apple). Only works in a **native build**
   (not Expo Go).
2. **Email testing** — by default Supabase requires email confirmation. For fast
   testing either use Apple, or Dashboard → Auth → Providers → Email → turn
   **"Confirm email" off** (turn it back on for production, or rely on Apple).

### 🔍 Verify in Expo Go (email path, no build)

`npx expo start` → the app opens on the **account screen**. Create an account with
email/password (needs "Confirm email" off, per above) → onboarding → tabs. Log a
few drinks, then check `analytics.overview` / `public.events` in the SQL editor:
your rows appear. The Apple button only shows in a native iOS build.

## Security posture

- RLS on every table; policies are `auth.uid() = user_id` for select/insert/
  update/delete. Verified: an authenticated user sees only their own rows.
- Trigger helper functions are not RPC-callable (execute revoked from anon/
  authenticated); `search_path` pinned. Supabase security advisor: **0 issues**.
- Alcohol data is sensitive. When you ship, declare data collection accurately in
  the App Store / Play Console privacy labels (health-adjacent), and keep the
  service_role key server-side only.
