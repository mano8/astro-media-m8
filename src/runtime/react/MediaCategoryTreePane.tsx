/**
 * The tree view's left pane: the caller's nested user categories, their counts,
 * and the full `role="tree"` keyboard contract (`U7`).
 */
import { useId, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useCategoryTree } from "../hooks/useMediaCategories.js";
import {
  selectedTreeNodeStyle,
  treeNodeRowClassName,
  treePaneClassName,
  treeToggleClassName,
  treeToggleSpacerClassName
} from "./mediaLibraryStyles.js";
import type { CategoryBranchSelection } from "./categoryBranch.js";
import type { MediaLibraryLabels } from "./mediaLibraryLabels.js";
import type { CategoryNode } from "../schemas.js";

/**
 * Stable pane key for a selection. It addresses the rows for keyboard
 * navigation and seeds each row's generated `aria` ids, so it is derived from
 * the selection rather than taken from the server node.
 */
function branchKey(selection: CategoryBranchSelection): string {
  return selection.kind === "category" ? `category-${selection.id}` : selection.kind;
}

/**
 * "All media" / "Uncategorized": the two rows in the pane that are not a
 * server category. They are plain level-1 treeitems with no count badge — the
 * server node counts are per-category, and inventing a total here would be a
 * second, unverifiable source for a number the tree already owns.
 */
const PSEUDO_ROWS: ReadonlyArray<{ selection: CategoryBranchSelection }> = [
  { selection: { kind: "all" } },
  { selection: { kind: "uncategorized" } }
];

/**
 * One entry of the pane's depth-first list of *visible* rows, in the order the
 * arrow keys walk them: the two pseudo-rows first, then the server tree with a
 * collapsed branch's children omitted. Keyboard navigation reads this flat
 * list while the markup stays nested — the same split `astro-ui-m8`'s
 * `tree-view` block uses.
 */
interface TreePaneRow {
  key: string;
  selection: CategoryBranchSelection;
  level: number;
  parentKey: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

function collectBranchRows(
  nodes: readonly CategoryNode[],
  expandedIds: ReadonlySet<number>,
  level: number,
  parentKey: string | null,
  out: TreePaneRow[]
): void {
  for (const node of nodes) {
    const key = `category-${node.id}`;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && expandedIds.has(node.id);
    out.push({
      key,
      selection: { kind: "category", id: node.id },
      level,
      parentKey,
      hasChildren,
      expanded
    });
    if (expanded) collectBranchRows(node.children, expandedIds, level + 1, key, out);
  }
}

function flattenPaneRows(tree: readonly CategoryNode[], expandedIds: ReadonlySet<number>): TreePaneRow[] {
  const rows: TreePaneRow[] = PSEUDO_ROWS.map(({ selection }) => ({
    key: branchKey(selection),
    selection,
    level: 1,
    parentKey: null,
    hasChildren: false,
    expanded: false
  }));
  collectBranchRows(tree, expandedIds, 1, null, rows);
  return rows;
}

/**
 * Everything a row needs from the pane, passed as one object so the
 * `role`/`aria-*`/roving-tabindex wiring lives in exactly one component
 * (`MediaCategoryTreeItem`) and the recursive branch renderer only forwards it.
 */
interface TreePaneController {
  baseId: string;
  labels: MediaLibraryLabels["tree"];
  selection: CategoryBranchSelection;
  activeKey: string | null;
  expandedIds: ReadonlySet<number>;
  registerItem: (key: string, element: HTMLLIElement | null) => void;
  select: (selection: CategoryBranchSelection) => void;
  toggle: (id: number) => void;
  onItemKeyDown: (event: ReactKeyboardEvent<HTMLLIElement>, key: string) => void;
  onItemFocus: (event: ReactFocusEvent<HTMLLIElement>, key: string) => void;
  onItemPointerDown: (key: string) => void;
}

/**
 * One `role="treeitem"` row — a pseudo-row or a category — plus, when it is an
 * expanded branch, the `role="group"` holding its children.
 *
 * The `<li>` carries the tab stop, not the row inside it: a treeitem must not
 * hold its own focusable descendants, so the row that used to be a `<button>`
 * is a non-focusable `<span>` and the pane's keyboard contract covers what the
 * button did. The focus ring is drawn on that row rather than on the `<li>` so
 * it does not wrap the whole subtree.
 */
function MediaCategoryTreeItem({
  controller,
  selection,
  label,
  level,
  count,
  countTitle,
  hasChildren,
  expanded,
  children
}: {
  controller: TreePaneController;
  selection: CategoryBranchSelection;
  label: string;
  level: number;
  count?: number;
  countTitle?: string;
  hasChildren: boolean;
  expanded: boolean;
  children?: ReactNode;
}) {
  const key = branchKey(selection);
  const isSelected = branchKey(controller.selection) === key;
  const labelId = `${controller.baseId}-${key}-label`;
  const countId = `${controller.baseId}-${key}-count`;
  const modifier = selection.kind === "category" ? "" : ` fa-media-tree-node--${selection.kind}`;
  // Read out of the union once, into a `const`, so the toggle handler keeps a
  // narrowing that a closure over the parameter itself would lose.
  const categoryId = selection.kind === "category" ? selection.id : null;

  return (
    <li
      ref={(element) => {
        controller.registerItem(key, element);
      }}
      className={`fa-media-tree-node${modifier} rounded-md outline-none`}
      role="treeitem"
      tabIndex={controller.activeKey === key ? 0 : -1}
      aria-level={level}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? expanded : undefined}
      // Named explicitly over the label (+ count) so a nested `role="group"`
      // never leaks into name-from-content.
      aria-labelledby={count === undefined ? labelId : `${labelId} ${countId}`}
      onKeyDown={(event) => controller.onItemKeyDown(event, key)}
      onFocus={(event) => controller.onItemFocus(event, key)}
    >
      <span
        className={treeNodeRowClassName}
        style={isSelected ? selectedTreeNodeStyle : undefined}
        onPointerDown={() => controller.onItemPointerDown(key)}
        onClick={() => controller.select(selection)}
      >
        {hasChildren && categoryId !== null ? (
          <span
            className={treeToggleClassName}
            aria-hidden="true"
            title={expanded ? controller.labels.collapse(label) : controller.labels.expand(label)}
            onClick={(event) => {
              event.stopPropagation();
              controller.toggle(categoryId);
            }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className={treeToggleSpacerClassName} aria-hidden="true" />
        )}
        <span id={labelId} className="fa-media-tree-name whitespace-nowrap">
          {label}
        </span>
        {count === undefined ? null : (
          <span id={countId} className="fa-media-badge fa-media-category-count ml-auto shrink-0" title={countTitle}>
            {count}
          </span>
        )}
      </span>
      {hasChildren && expanded ? (
        <ul role="group" className="fa-media-tree-children m-0 ml-1 list-none border-l border-border p-0 pl-3">
          {children}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * One category row plus its subtree in the browse pane.
 *
 * Counts come straight from the server node: the badge shows
 * `total_object_count` (this branch including everything under it) and names
 * both numbers in its `title`, since a parent whose own `object_count` is 0
 * still browses to a non-empty branch.
 */
function MediaCategoryBranch({
  node,
  depth,
  controller
}: {
  node: CategoryNode;
  depth: number;
  controller: TreePaneController;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && controller.expandedIds.has(node.id);

  return (
    <MediaCategoryTreeItem
      controller={controller}
      selection={{ kind: "category", id: node.id }}
      label={node.name}
      level={depth}
      count={node.total_object_count}
      countTitle={controller.labels.countTitle(node.object_count, node.total_object_count, node.name)}
      hasChildren={hasChildren}
      expanded={expanded}
    >
      {expanded
        ? node.children.map((child) => (
            <MediaCategoryBranch key={child.id} node={child} depth={depth + 1} controller={controller} />
          ))
        : null}
    </MediaCategoryTreeItem>
  );
}

/**
 * The left pane of the tree view: the caller's nested user categories with
 * their counts.
 *
 * `useCategoryTree()` lives **here** rather than in `MediaLibrary` so the
 * category request is only issued once the user actually opens the tree view —
 * the list/grid/masonry views must not pay for a fetch they never render.
 *
 * The a11y contract matches `astro-ui-m8`'s `tree-view` registry block so the
 * runtime pane and the registry skin do not diverge: `role="tree"` /
 * `role="group"` / `role="treeitem"`, `aria-level`, `aria-selected`,
 * `aria-expanded` on parents, a roving tabindex holding exactly one tab stop,
 * and ArrowUp/ArrowDown/Home/End/ArrowRight/ArrowLeft/Enter/Space.
 */
export function MediaCategoryTreePane({
  selection,
  onSelect,
  labels
}: {
  selection: CategoryBranchSelection;
  onSelect: (selection: CategoryBranchSelection) => void;
  labels: MediaLibraryLabels["tree"];
}) {
  const { tree, loading, error } = useCategoryTree();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  // Expanded ids, not collapsed ones: the pane opens with every branch shut,
  // so a deep tree presents its roots rather than its whole depth at once and
  // the pane starts at the width it can actually show. An empty set is the
  // honest seed for that — the inverted `collapsed` set this replaced could
  // only mean "all open" on first render, because the ids it would have to
  // hold are not known until the tree resolves.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const itemsRef = useRef(new Map<string, HTMLLIElement>());
  const rows = useMemo(() => flattenPaneRows(tree, expandedIds), [tree, expandedIds]);

  // Roving tabindex: exactly one treeitem is tabbable — the last focused row
  // while it stays visible, else the selected row, else the first row.
  const selectedKey = branchKey(selection);
  const isVisible = (key: string | null): key is string =>
    key !== null && rows.some((row) => row.key === key);
  let activeKey: string | null = rows[0]?.key ?? null;
  if (isVisible(focusedKey)) activeKey = focusedKey;
  else if (isVisible(selectedKey)) activeKey = selectedKey;

  function registerItem(key: string, element: HTMLLIElement | null) {
    if (element === null) itemsRef.current.delete(key);
    else itemsRef.current.set(key, element);
  }

  function focusItem(key: string) {
    setFocusedKey(key);
    itemsRef.current.get(key)?.focus();
  }

  // `.at()` rather than an index read, and a negative guard because `.at(-1)`
  // wraps to the end of the list — ArrowUp on the first row must stay put, not
  // jump to the last one.
  function focusAt(index: number) {
    if (index < 0) return;
    const row = rows.at(index);
    if (row !== undefined) focusItem(row.key);
  }

  function setExpansion(id: number, expand: boolean) {
    setExpandedIds((previous) => {
      if (previous.has(id) === expand) return previous;
      const next = new Set(previous);
      if (expand) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // ArrowRight opens a closed branch, then steps into it; a leaf is a no-op.
  function expandOrEnter(row: TreePaneRow, index: number): boolean {
    if (!row.hasChildren || row.selection.kind !== "category") return false;
    if (row.expanded) focusAt(index + 1);
    else setExpansion(row.selection.id, true);
    return true;
  }

  // ArrowLeft closes an open branch, else steps out to the parent.
  function collapseOrLeave(row: TreePaneRow): boolean {
    if (row.hasChildren && row.expanded && row.selection.kind === "category") {
      setExpansion(row.selection.id, false);
      return true;
    }
    if (row.parentKey === null) return false;
    focusItem(row.parentKey);
    return true;
  }

  function applyKey(key: string, row: TreePaneRow, index: number): boolean {
    switch (key) {
      case "ArrowDown":
        focusAt(index + 1);
        return true;
      case "ArrowUp":
        focusAt(index - 1);
        return true;
      case "Home":
        focusAt(0);
        return true;
      case "End":
        focusAt(rows.length - 1);
        return true;
      case "ArrowRight":
        return expandOrEnter(row, index);
      case "ArrowLeft":
        return collapseOrLeave(row);
      case "Enter":
      case " ":
        onSelect(row.selection);
        return true;
      default:
        return false;
    }
  }

  const controller: TreePaneController = {
    baseId,
    labels,
    selection,
    activeKey,
    expandedIds,
    registerItem,
    select: onSelect,
    toggle: (id) => setExpansion(id, !expandedIds.has(id)),
    onItemKeyDown: (event, key) => {
      // Only the treeitem that actually holds focus reacts; the event bubbles
      // through every ancestor treeitem on its way out.
      if (event.target !== event.currentTarget) return;
      const index = rows.findIndex((row) => row.key === key);
      const row = rows.at(index);
      if (index === -1 || row === undefined) return;
      if (applyKey(event.key, row, index)) event.preventDefault();
    },
    onItemFocus: (event, key) => {
      if (event.target === event.currentTarget) setFocusedKey(key);
    },
    // A pointer press moves the roving tabindex with it, so a later Tab leaves
    // the pane from the row the user last touched.
    onItemPointerDown: (key) => focusItem(key)
  };

  return (
    <aside className={treePaneClassName} aria-label={labels.regionLabel}>
      <h3 id={headingId}>{labels.title}</h3>
      {error ? (
        <p role="alert" className="fa-media-tree-error">
          {labels.loadError}
        </p>
      ) : null}
      {loading && tree.length === 0 ? <p className="fa-media-category-hint">{labels.loading}</p> : null}
      {!loading && !error && tree.length === 0 ? (
        <p className="fa-media-category-hint">
          {labels.empty}
        </p>
      ) : null}
      <ul role="tree" aria-labelledby={headingId} className="fa-media-tree-nodes m-0 min-w-max list-none p-0">
        {PSEUDO_ROWS.map((row) => (
          <MediaCategoryTreeItem
            key={branchKey(row.selection)}
            controller={controller}
            selection={row.selection}
            label={row.selection.kind === "all" ? labels.allMedia : labels.uncategorized}
            level={1}
            hasChildren={false}
            expanded={false}
          />
        ))}
        {tree.map((node) => (
          <MediaCategoryBranch key={node.id} node={node} depth={1} controller={controller} />
        ))}
      </ul>
    </aside>
  );
}

