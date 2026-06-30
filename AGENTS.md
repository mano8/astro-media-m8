# astro-media-m8

## Authority

Read the workspace root `AGENTS.md` first. This repo follows the workspace
TypeScript/client policy; use workspace `.Codex/` plus this repo's `AGENTS.md`.

## Role

Optional Astro media plugin for `fa-ui-m8` and other M8 Astro apps. It depends on
the auth plugin contract because `media-service-m8` accepts `fa-auth-m8` tokens.

Owns the media frontend contract: schemas, API wrappers, upload helpers, auth
adapter, React provider/hooks, route helpers, compatibility checks, neutral
default UI, and shadcn registry skins usable by `fa-ui-m8`.

## Boundaries

- Require `@mano8/astro-auth-m8` as the auth peer for official M8 usage.
- Couple to auth through `MediaAuthAdapter` / `fa-auth-astro` provider only.
- Talk to `media-service-m8` over HTTP only; never import service code.
- Model public backend responses only; never expose secret/session fields.
- Keep `package.json` `mediaServiceM8`, schemas, and compatibility checks aligned.
- Export public modules through explicit `package.json` subpaths.
- Registry skins use pure shadcn/Tailwind patterns where possible and import live
  logic from this package's `/react` and `/hooks` exports.
- The media admin landing view should be a dashboard; destructive maintenance
  actions belong behind focused confirmation panels.
- Consumers own secrets, env, i18n labels, and final composition.

## Commands

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run test:unit`



