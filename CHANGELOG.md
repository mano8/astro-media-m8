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

### Fixed

- **The tree view's category pane scrolls horizontally instead of clipping**
  (`U7`). The pane's width is fixed from `md` up (`md:w-64`) while a nested
  branch's is not, so a tree several levels deep ran off the pane edge with no
  way to reach the rest of it — every row was ellipsed at the same point and
  the indentation kept pushing the labels further right. Three changes make the
  pane show its content rather than hide it, and they only work together:
  `overflow-y-auto` becomes `overflow-auto`; the `role="tree"` list takes
  `min-w-max` so it states the width of its widest row; and
  `.fa-media-tree-name` drops `truncate` for plain `whitespace-nowrap`. A
  truncating label can never widen its list, so with the old rule the new
  horizontal bar would have had nothing to reveal. The bar is `auto`, so a
  shallow tree renders exactly as before. Carried in both the Tailwind token
  classes and the framework-neutral `media.css` fallback (`D11`).
- **The tree view's two panes are the same height, and the pane is no longer a
  fixed 16rem.** The row was `md:items-start`, so the category pane hugged its
  own content and sat as a short box beside a long results table; it is
  `items-stretch` at both widths now, so the pane takes the results column's
  height and the `max-h` only bites when the tree is the taller of the two —
  then it scrolls at the cap rather than growing the page. `min-h-0` is required
  for that scroll to engage at all, since a stretched flex item will not shrink
  below its content. The width moves from a flat `w-64` to
  `clamp(16rem, 24vw, 26rem)`: 16rem was the same pane on a 13" laptop and a 27"
  monitor and too narrow for a nested tree on both.
- **The tree pane is now complete under Tailwind alone.** The list reset and
  the child indent were the only tree geometry with no Tailwind twin — they
  existed solely in the scaffold stylesheet. A consumer that maps its own theme
  instead of loading that stylesheet (which is the documented way to use this
  package with a design system) therefore lost the indentation and the branch
  guide line entirely, and the tree read as a flat list. Both are stated as
  utilities on the elements now (`m-0 list-none p-0` on the tree list,
  `ml-1 border-l border-border pl-3` on each child group), with the scaffold
  rules kept unchanged for consumers without Tailwind.
- **The two-pane split waits for `lg`, not `md`.** At 48rem a category pane and
  a six-column table shared 768px and both were cramped, so the stacked layout
  now carries the tablet range where it reads better.
- **The results table scrolls instead of squashing.** Six columns have no
  readable narrow form, so the table sits in its own `overflow-x-auto` box with
  `min-w-[34rem]` — the `min-width` is what gives the bar something to reveal,
  since `width: 100%` alone can never exceed its wrapper. Applies to the list
  view as well as the tree view, since both render the same table.
- **The import dropzone stops borrowing the tree pane's class.** It reused
  `treePaneClassName` outright for its card look, which quietly handed it the
  pane's width and scroll behaviour too — so sizing the pane for a category tree
  would have resized a file dropzone with it. It carries
  `fa-media-transfer-dropzone` now, and with it a framework-neutral fallback it
  never had: `--active` was referenced by the runtime with no rule behind it
  (`D11`).
- **The child indent is trimmed** — `.fa-media-tree-children` `padding-left`
  `1.25rem` → `0.75rem` and `margin-left` `0.4rem` → `0.25rem`. Each level pays
  for indent *and* a `1.25rem` toggle column, so on a four-deep tree the indent
  was the largest single contributor to the width that pushed rows out of the
  pane. `0.75rem` still clears the toggle glyph, so the branch guide rule stays
  legible against the row it belongs to.

### Changed

- **`MediaLibrary.tsx` is split into modules, and the largest components are
  decomposed.** The file had grown to 1224 non-comment lines and carried the
  library, its tree pane, its transfer panel, the whole label contract and every
  Tailwind token class in one place; it is now `mediaLibraryLabels`,
  `mediaLibraryStyles`, `categoryBranch`, `MediaCategoryTreePane`,
  `MediaTransferPanel` and a 507-line `MediaLibrary`. The same pass extracts
  subcomponents and hooks from `CategoryMultiSelectView`, `CategoryManagerRow`,
  `CategoryManager`, `MediaObjectPreview` and the three library registry skins,
  and splits the two oversized tree-pane tests into focused cases. **No export,
  prop, class name or rendered markup changes** — `MediaLibraryLabels` is still
  exported from `MediaLibrary.js`, and all 237 tests pass unchanged apart from
  the ones deliberately split. It is a Codacy complexity gate the fleet keeps
  green, not a redesign.
- **The category tree pane opens with every branch collapsed.** It used to
  render the whole tree expanded, which on a deep hierarchy filled the pane
  with descendants before the user had chosen a branch and made the pane its
  widest at the moment it was least useful. The pane now tracks `expandedIds`
  rather than the inverted `collapsed` set — an empty set is the honest seed
  for "all shut", where the old set could only ever mean "all open" on first
  render because the ids it would have to hold are not known until the tree
  resolves. Nothing else about the pane's keyboard contract moves:
  ArrowRight/ArrowLeft still open and close, and `aria-expanded` still reports
  the real state. The `media-category-tree` registry skin drops its
  `defaultExpandedIds={collectExpandableIds(nodes)}` for the same reason, so
  the skin and the runtime pane stay non-divergent.
- **`UploadCompleteRequestSchema` carries `category_ids`.** The served
  `POST /media/v1/uploads/{id}/complete` has always accepted an optional
  `category_ids` that *replaces* the filing staged at initiate (`[]` completes
  the object filed into nothing), and this schema is `.strict()` — so a caller
  meaning to override the filing at complete time was rejected client-side
  before the request was ever made. Purely additive: omitting the key still
  means "keep what initiate staged", which is what this package's own upload
  controller relies on, so no existing caller changes.
- **The `media-service-m8` pairing is re-measured.**
  `MEDIA_SERVICE_M8_TESTED_SERVICE_VERSION` and `mediaServiceM8.testedServiceVersion`
  move `2.0.0` → `2.1.1` — the service this client was actually exercised
  against, whose OpenAPI every schema here was diffed against in the same pass.
  Written ahead of the `2.1.1` tag and recorded as such, the same ordering
  inversion the workspace matrix documents for the `2.1.0` image pins; it is
  safe here in a way a pin is not, because the constant resolves nothing and
  installs nothing.
  **Neither gate moves.** `MEDIA_SERVICE_M8_CONTRACT_VERSION` stays `1.1`
  because the *contract* did not move: the service fix populates a field that
  was already declared, already documented and already populated by the list and
  write paths, so no served shape changed. `media_service`'s own
  `CONTRACT_VERSION` is still `1.1` and `tests/test_meta.py` asserts it as a
  literal — advancing this client past it would make every preflight demand a
  contract the service does not serve. The service-version range likewise stays
  `>=2.0.0 <3.0.0`, which admits the whole 2.x line, so a host on the published
  `2.1.0` passes preflight unchanged. `REPOSITORY_CONTEXT.md` additionally carried
  `>=1.0.0 <2.0.0` for that range, wrong twice over — it is a *service*-version
  range, not a range of contract versions, and the value had been left behind by
  the 2.x repoint, so it excluded every service this package admits.
  `compatibility.ts` and the `mediaServiceM8` block have been right since that
  repoint; the doc line was the outlier and is corrected in place.
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
