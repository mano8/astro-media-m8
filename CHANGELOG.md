# Changelog

All notable changes to `@mano8/astro-media-m8` are documented here.

## [Unreleased]

### Added

- **Category CRUD starter page.** Starter mode now ships `/media/categories`,
  backed by the existing tenant-scoped `CategoryManager`, so consumers can
  mount category creation, rename, reparent and delete as a real page.

### Changed

- **Upload is a library action.** `MediaLibrary` now places an `Upload media`
  action at the right of its top toolbar and opens the upload form as an
  accessible modal. The dialog includes the existing nested user-category
  selector, closes on Escape/backdrop/completion and refreshes the library
  after a successful upload. The legacy `/media/upload` starter route opens
  this same library dialog for direct-link compatibility.
- **The required auth peer is raised to `@mano8/astro-auth-m8` `^2.3.0`** in
  both `peerDependencies` and `devDependencies`. `2.3.0` coordinates the two
  token-refresh paths behind one single-flight guard; below it, a page mounting
  both paths against one expired token can issue two rotations, which
  `fa-auth-m8` reads as token reuse and answers by revoking every session for
  the account. This plugin reaches that path through
  `installFaAuthBrowserAdapter`, so it is behaviour this package depends on
  rather than one it merely tolerates. The previous `^2.2.0` range already
  resolved `2.3.0` on a fresh install; the floor states the requirement.

## [1.2.0] - 2026-08-25

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
  contract. The service-version gate remains `>=2.0.0 <3.0.0`: the pending
  `media-service-m8` 2.0.0 and this 1.2.0 release ship together, without an
  extra unpublished version bump.
