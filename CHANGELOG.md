# Changelog

All notable changes to `@mano8/astro-media-m8` are documented here.

## [Unreleased]

### Changed

- **Category-tree responses are depth-bounded.** The Zod tree schema accepts up
  to 10 levels, matching the service default, and rejects deeper untrusted
  responses before recursive UI rendering.
- **Contract `media-service-m8@1.1`** (`P2 U12`). The compatibility helper,
  package metadata and documentation now agree on the additive media UX
  contract. The service-version gate remains `>=2.0.0 <3.0.0`: the pending
  `media-service-m8` 2.0.0 and this package's pending 1.2.0 release continue
  to ship together, without an extra unpublished version bump.
