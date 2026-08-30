# Changelog

All notable changes to `@mano8/astro-media-m8` are documented here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The major version tracks the supported `media-service-m8` **service-version
line**, not just this package's own surface: a backend repoint is always a
major. Note that this is the *service* version, not the contract version — the
compatibility helper admits several contracts (`1.0` and `1.1`) against one
service line, so the contract can move without moving the major.

## [Unreleased]

## [2.0.0] - 2026-08-30 · media-service 2.x repoint, auth generation jump

**Major bump, for two independent breaking reasons.**

1. **The supported `media-service-m8` moves from 1.x to 2.x.**
   `MEDIA_SERVICE_M8_MIN_SERVICE_VERSION` goes `1.0.0` → `2.0.0` and the
   exclusive maximum `2.0.0` → `3.0.0`, so a pre-tier `1.x` service is
   deliberately **no longer admitted**: it cannot serve the role-tier
   authorization behaviour this plugin's guards assume. A consumer pointing at a
   1.x service is refused at preflight, which is a breaking change to what this
   package works against.
2. **The required `@mano8/astro-auth-m8` peer crosses a generation**, `^1.5.0` →
   `^2.4.1`. The old range excluded every 2.x auth release, so consumers pairing
   this plugin with a 1.x auth must upgrade auth first.

No export of this package is removed or renamed; both breaking changes are to
what it requires around it.

**This section is a fold of two never-published versions.** `1.2.0` and `2.0.0`
were both numbered in source without ever being tagged — `origin`'s newest tag
is `v1.1.1` — so under the fleet's one-bump-per-unpublished-release rule they
are one release, and the number is the major the work actually earns. `1.2.0`
had been numbered a **minor** while carrying reason 1 above, which is what made
folding it the correct call rather than a tidying one.

### Added

- **Every React island root is wrapped in an error boundary** (`A-C3`). A throw
  inside `LibraryView`, `ObjectDetailView`, `UploadView`, `PresetsView` or
  `AdminMediaView` now renders the canonical `astro-ui-m8` error state instead
  of tearing down the island and leaving a blank region on the host page.
- **Dev-only `/_preview` gallery** (`A-C2`). `npm run preview:dev` mounts every
  shipped island against an in-memory stand-in for `media-service-m8`: only
  `fetch` is replaced, so the views, hooks, API wrappers and Zod schemas
  exercised are the shipped ones. `npm run preview:build` typechecks and builds
  the fixture, and CI runs both. The gallery is a development fixture and is not
  part of the published tarball.

- **Category CRUD starter page.** Starter mode now ships `/media/categories`,
  backed by the existing tenant-scoped `CategoryManager`, so consumers can
  mount category creation, rename, reparent and delete as a real page.

### Changed

- **Required auth peer raised to `@mano8/astro-auth-m8` `^2.2.0`**, in both
  `peerDependencies` and `devDependencies`. The previous `^1.5.0` range excluded
  every 2.x auth release, so this package declared it needed an auth generation
  the fleet had already left behind; the conflict was only ever suppressed by
  installing with `--legacy-peer-deps`. Consumers pairing this plugin with a 1.x
  auth must upgrade auth first. `@mano8/astro-ui-m8` stays at `^1.5.0`.
- **Category-tree responses are depth-bounded.** The Zod tree schema accepts up
  to 10 levels, matching the service default, and rejects deeper untrusted
  responses before recursive UI rendering.
- **Contract `media-service-m8@1.1`** (`P2 U12`). The compatibility helper,
  package metadata and documentation now agree on the additive media UX
  contract. The contract axis itself is additive — the client admits both
  `1.0` and `1.1` — so it is **not** what makes this release a major; the
  service-version gate above is.

- **The fleet gate exempts one authorization specifier** (remediation `W7.7`,
  decision 4). `scripts/verify-fleet-gates.mjs` is carried byte-identically by
  all four plugins, so a fleet-wide rule change lands in all four or in none.
  `no-cross-plugin-import` now permits exactly
  `@mano8/astro-auth-m8/authorization` — the pure, framework-neutral mirror of
  `auth_sdk_m8/authorization.py` — so a plugin can meet `RBAC-06`, one role
  hierarchy, by importing it rather than re-implementing it. Every other
  subpath of the auth peer stays refused. A new `authorization-purity` gate
  makes that exemption conditional: in a package that uses it, it walks the
  module's import closure and fails on React, on any bare dependency other than
  `zod`, or on any read of a runtime global. This package imports no
  authorization module today, so the second gate is inert here and nothing in
  its behaviour, surface or dependencies changes; it carries the rule so the
  fleet stays one rule.

- **Upload is a library action.** `MediaLibrary` now places an `Upload media`
  action at the right of its top toolbar and opens the upload form as an
  accessible modal. The dialog includes the existing nested user-category
  selector, closes on Escape/backdrop/completion and refreshes the library
  after a successful upload. The legacy `/media/upload` starter route opens
  this same library dialog for direct-link compatibility.
- **The required auth peer is raised to `@mano8/astro-auth-m8` `^2.4.1`** in
  both `peerDependencies` and `devDependencies`. Two separate reasons stack, and
  the floor is the higher of them. `2.3.0` coordinates the two token-refresh
  paths behind one single-flight guard; below it, a page mounting both paths
  against one expired token can issue two rotations, which `fa-auth-m8` reads as
  token reuse and answers by revoking every session for the account. This plugin
  reaches that path through `installFaAuthBrowserAdapter`, so it is behaviour
  this package depends on rather than one it merely tolerates. `2.4.0` then
  makes `@mano8/astro-auth-m8/authorization` a **supported** cross-plugin import
  surface rather than an internal module siblings happen to be able to reach —
  the guarantee the fleet's widened `no-cross-plugin-import` gate (`C12`) and
  its `authorization-purity` companion are written against. This package carries
  both gates, so it takes the floor that makes them meaningful even though its
  own adapter does not yet import the module. The previous `^2.2.0` range
  already resolved these on a fresh install; the floor states the requirement.
  The floor landed as `^2.4.0` and was repointed to `^2.4.1` once that
  tooling-alignment release was published; the lockfile resolves
  `astro-auth-m8-2.4.1.tgz`.

- **`@mano8/astro-ui-m8` is repointed `^1.5.0` → `^1.5.1`**, the published
  tooling-alignment release, so the manifest no longer names a range ahead of
  the registry. The lockfile resolves `astro-ui-m8-1.5.1.tgz`.
