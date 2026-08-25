# Changelog

All notable changes to `@mano8/astro-media-m8` are documented here.

## [Unreleased]

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
