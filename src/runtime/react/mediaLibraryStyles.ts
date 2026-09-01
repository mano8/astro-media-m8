/**
 * The Tailwind token classes and inline styles the runtime media views are
 * built from.
 *
 * This package hand-rolls its own classes rather than importing `astro-ui-m8`
 * components into `src/runtime` (`D11`), and every class here has a
 * framework-neutral twin in `src/scaffold/styles/media.css` for consumers that
 * map their own theme instead of loading Tailwind.
 */
import type { CSSProperties } from "react";

export const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
export const titleRowClassName = "fa-media-title-row flex w-full flex-wrap items-center justify-between gap-3";
export const filterRowClassName = "fa-media-filter-row flex w-full flex-col gap-3 md:flex-row md:items-center";
export const viewSwitcherClassName =
  "fa-media-view-switcher inline-flex shrink-0 rounded-lg border border-input bg-transparent p-0.5";
export const viewButtonClassName =
  "fa-media-view-button min-h-7 rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background";
export const previewClassName =
  "fa-media-preview block aspect-square h-14 w-14 rounded-md border border-border bg-muted object-cover text-xs font-medium text-muted-foreground";
export const previewPlaceholderClassName = `${previewClassName} grid place-items-center px-1 text-center`;
export const gridClassName = "fa-media-cards fa-media-cards--grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
export const masonryClassName = "fa-media-cards fa-media-cards--masonry columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4";
export const cardClassName =
  "fa-media-card mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-card text-card-foreground";
export const cardPreviewClassName = "h-auto w-full rounded-none border-0";
export const cardBodyClassName = "fa-media-card-body grid gap-2 p-3";
export const cardTitleClassName = "m-0 truncate text-sm font-medium leading-5";
export const cardMetaClassName = "fa-media-card-meta flex flex-wrap items-center gap-2 text-xs text-muted-foreground";
export const itemActionsClassName = "fa-media-item-actions flex flex-wrap items-center gap-2";
export const actionLinkClassName = "fa-media-action-link inline-flex min-h-8 items-center rounded-lg border px-3 py-1 text-sm font-medium";
export const listPreviewStyle: CSSProperties = {
  aspectRatio: "1 / 1",
  borderRadius: "0.375rem",
  height: "clamp(4rem, 12vw, 8rem)",
  maxHeight: "8rem",
  maxWidth: "8rem",
  objectFit: "cover",
  width: "clamp(4rem, 12vw, 8rem)"
};
// One column on narrow viewports, two panes from `lg` up — not `md`. At `md`
// (48rem) a category pane and a six-column table shared 768px and both were
// cramped; the split now waits for 64rem, so the stacked layout carries the
// tablet range where it reads better.
//
// `items-stretch` at both widths, where the row used to be `md:items-start`.
// That is what makes the pane share the results column's height instead of
// hugging its own content and leaving a short box beside a long table.
export const treeLayoutClassName =
  "fa-media-tree-layout flex w-full flex-col items-stretch gap-4 lg:flex-row lg:items-stretch";
// Width is `clamp(16rem, 24vw, 26rem)` rather than a flat `w-64`: 16rem was the
// same pane on a 13" laptop and a 27" monitor, and it was too narrow for a
// nested tree on both. It now scales with the viewport between a readable floor
// and a cap that keeps the results column dominant.
//
// Height is bounded but no longer tight. Stretched by the row, it takes the
// results column's height; the `max-h` only bites when the tree itself is the
// taller of the two, and then the pane scrolls at the cap instead of growing
// the page. `min-h-0` is required for that scroll to work at all — without it
// a stretched flex item refuses to shrink below its content.
//
// `overflow-auto`, not `overflow-y-auto`: a nested branch is wider than the
// pane, so a deep tree used to be clipped with no way to reach the rest of it.
// The horizontal bar is `auto`, so it appears only when the widest row actually
// exceeds the pane. It only has anything to scroll because the list sizes to
// `min-w-max` and the row labels no longer truncate.
export const treePaneClassName =
  "fa-media-tree-pane max-h-[45vh] min-h-0 w-full shrink-0 overflow-auto rounded-lg border border-border bg-card p-3 text-card-foreground lg:max-h-[calc(100vh-13rem)] lg:w-[clamp(16rem,24vw,26rem)]";
export const treeResultsClassName = "fa-media-tree-results min-h-0 min-w-0 flex-1";
// The import dropzone used to borrow `treePaneClassName` outright for its card
// look, which quietly handed it the tree pane's width and scroll behaviour too
// — so sizing the pane for a category tree would have sized a file dropzone
// with it. It carries the shared card styling on its own class instead.
export const transferDropzoneClassName =
  "fa-media-transfer-dropzone w-full rounded-lg border border-border bg-card p-3 text-card-foreground";
// The row is not focusable any more — its `<li role="treeitem">` parent holds
// the tab stop — so the focus ring is drawn here off the parent's
// `:focus-visible`, keeping it around the row instead of around the whole
// subtree the `<li>` wraps.
export const treeNodeRowClassName =
  "fa-media-tree-select flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-normal text-foreground transition-colors hover:bg-muted [li:focus-visible>&]:ring-3 [li:focus-visible>&]:ring-ring/50";
export const treeToggleClassName =
  "fa-media-tree-toggle inline-flex w-5 shrink-0 cursor-pointer items-center justify-center text-xs leading-none text-muted-foreground";
export const treeToggleSpacerClassName = "fa-media-tree-toggle-spacer inline-block w-5 shrink-0";
export const activeViewButtonStyle: CSSProperties = {
  background: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  borderColor: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  color: "var(--fa-media-active-fg, var(--background, Canvas))"
};
export const selectedTreeNodeStyle: CSSProperties = {
  background: "var(--fa-media-tree-selected-bg, var(--muted, Highlight))",
  color: "var(--fa-media-tree-selected-fg, var(--foreground, HighlightText))",
  fontWeight: 600
};
export const buttonClassName =
  "fa-media-button inline-flex min-h-8 items-center rounded-lg border border-input px-3 py-1 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";
export const toolbarActionsClassName = "fa-media-toolbar-actions flex flex-wrap items-center justify-end gap-2";
export const labelInlineClassName = "fa-media-label-inline flex items-center gap-2 text-sm";
export const transferPanelClassName =
  "fa-media-transfer-panel grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-2";
export const transferSectionClassName = "fa-media-transfer-section grid gap-2 content-start";
export const transferTableWrapClassName = "fa-media-transfer-table-wrap max-h-64 overflow-y-auto rounded-md border border-border";
export const transferTableClassName = "fa-media-transfer-table w-full border-collapse text-xs";

