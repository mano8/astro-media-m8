import { useCallback, useMemo, useState } from "react";
import { useCategoryTree } from "../hooks/useMediaCategories.js";
import { ApiError, messageFromDetail } from "../errors.js";
import type { CategoryNode } from "../schemas.js";

const labelClassName =
  "fa-media-label flex items-center gap-2 text-sm leading-none font-medium select-none";

/**
 * A resolved selection entry: the category id plus the slash-joined name path
 * used as chip copy (`"Invoices / 2026"`), mirroring the server's
 * `MediaObjectCategoryRef.path`.
 */
export type CategoryPathOption = {
  id: number;
  name: string;
  path: string;
};

/**
 * Flatten a nested tree into an id -> `{name, path}` map. Kept as a `Map` (not
 * a plain object) so a lookup never becomes computed member access on a
 * server-supplied key — `eslint-plugin-security`'s object-injection rule is on
 * here, and a `Map` is the right structure for a numeric key anyway.
 */
export function collectCategoryPaths(
  nodes: readonly CategoryNode[],
  prefix = "",
  into: Map<number, CategoryPathOption> = new Map()
): Map<number, CategoryPathOption> {
  for (const node of nodes) {
    const path = prefix ? `${prefix} / ${node.name}` : node.name;
    into.set(node.id, { id: node.id, name: node.name, path });
    collectCategoryPaths(node.children, path, into);
  }
  return into;
}

/**
 * Compare two `category_ids` selections as sets, so a caller can tell "the user
 * changed the filing" from "the user toggled one off and back on". Exported
 * because `ObjectDetail` needs exactly this to drive its dirty state, and
 * because `PATCH` set semantics (`U4`) make order meaningless on the wire.
 */
export function isSameCategorySelection(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const seen = new Set(right);
  return left.every((id) => seen.has(id));
}

function hasSelectedDescendant(nodes: readonly CategoryNode[], selected: ReadonlySet<number>): boolean {
  return nodes.some((node) => selected.has(node.id) || hasSelectedDescendant(node.children, selected));
}

type BranchProps = {
  node: CategoryNode;
  depth: number;
  idPrefix: string;
  selected: ReadonlySet<number>;
  collapsed: ReadonlySet<number>;
  disabled: boolean;
  onToggleSelected: (id: number) => void;
  onToggleCollapsed: (id: number) => void;
};

/**
 * One tree row plus its subtree.
 *
 * The picker is a **form control**, not the navigation tree `U6`/`U7` own, so
 * it is built from native checkboxes inside nested lists rather than
 * `role="tree"` + roving tabindex: a native checkbox already carries focus,
 * keyboard toggling and checked-state announcements, and layering a
 * single-selection tree pattern over it would take those away. Nesting and
 * depth stay conveyable through plain nested `<ul>`s plus `aria-level` — the
 * list role is left implicit on purpose, since an explicit `role="group"` on
 * the `<ul>` would cost its `<li>` children the `listitem` role that
 * `aria-level` is defined against.
 *
 * Selection does **not** cascade to children. The server stores an explicit set
 * of assignments (`U4` set semantics), so checking "Invoices" must not silently
 * file the object into "Invoices / 2026"; a collapsed-or-not branch holding a
 * selected descendant is marked with a dot instead.
 */
function CategoryBranch({
  node,
  depth,
  idPrefix,
  selected,
  collapsed,
  disabled,
  onToggleSelected,
  onToggleCollapsed
}: BranchProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const groupId = `${idPrefix}-group-${node.id}`;
  const descendantSelected =
    hasChildren && !selected.has(node.id) && hasSelectedDescendant(node.children, selected);

  return (
    <li className="fa-media-category-node" aria-level={depth}>
      <div className="fa-media-category-row">
        {hasChildren ? (
          <button
            type="button"
            className="fa-media-category-toggle"
            aria-expanded={!isCollapsed}
            aria-controls={groupId}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.name}`}
            onClick={() => onToggleCollapsed(node.id)}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="fa-media-category-toggle-spacer" aria-hidden="true" />
        )}
        <label className={labelClassName} htmlFor={`${idPrefix}-node-${node.id}`}>
          <input
            id={`${idPrefix}-node-${node.id}`}
            type="checkbox"
            checked={selected.has(node.id)}
            disabled={disabled}
            onChange={() => onToggleSelected(node.id)}
          />
          <span className="fa-media-category-name">{node.name}</span>
          {descendantSelected ? (
            <span className="fa-media-category-marker" title="A category below this one is selected">
              {"•"}
            </span>
          ) : null}
          <span className="fa-media-badge fa-media-category-count">{node.total_object_count}</span>
        </label>
      </div>
      {hasChildren && !isCollapsed ? (
        <ul id={groupId} className="fa-media-category-children">
          {node.children.map((child) => (
            <CategoryBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              idPrefix={idPrefix}
              selected={selected}
              collapsed={collapsed}
              disabled={disabled}
              onToggleSelected={onToggleSelected}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export type CategoryMultiSelectViewProps = {
  /** The currently selected user-category ids — the `category_ids` payload. */
  value: readonly number[];
  onChange: (next: number[]) => void;
  tree: readonly CategoryNode[];
  loading?: boolean;
  error?: unknown;
  disabled?: boolean;
  /** Fieldset legend; the picker is optional everywhere it is used today. */
  legend?: string;
  /** Copy shown when the caller has no user categories yet. */
  emptyHint?: string;
  /**
   * Labels for ids that are selected but absent from the tree — e.g. an object
   * filed into a category the tree request has not resolved yet. Keeps a chip
   * from degrading to a bare id.
   */
  fallbackLabels?: ReadonlyMap<number, string>;
  /** Prefix for the generated element ids; must be unique per mounted picker. */
  idPrefix?: string;
};

/**
 * Presentational multi-select nested category picker: a checkbox tree plus a
 * chip list of the current selection. Fully controlled — it holds no selection
 * state of its own, only expand/collapse.
 */
export function CategoryMultiSelectView({
  value,
  onChange,
  tree,
  loading = false,
  error = null,
  disabled = false,
  legend = "User categories (optional)",
  emptyHint = "No user categories yet. Create one from the category manager to file media here.",
  fallbackLabels,
  idPrefix = "fa-media-categories"
}: CategoryMultiSelectViewProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set<number>());
  const selected = useMemo(() => new Set(value), [value]);
  const paths = useMemo(() => collectCategoryPaths(tree), [tree]);

  const toggleSelected = useCallback(
    (id: number) => {
      onChange(value.includes(id) ? value.filter((current) => current !== id) : [...value, id]);
    },
    [onChange, value]
  );

  const toggleCollapsed = useCallback((id: number) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const chips: CategoryPathOption[] = value.map((id) => {
    const known = paths.get(id);
    if (known) return known;
    const fallback = fallbackLabels?.get(id) ?? `#${id}`;
    return { id, name: fallback, path: fallback };
  });

  const errorMessage = error
    ? (error instanceof ApiError ? messageFromDetail(error.detail) : null) ??
      (error instanceof Error ? error.message : "Failed to load categories")
    : null;

  return (
    <fieldset className="fa-media-category-picker">
      <legend>{legend}</legend>

      {errorMessage ? (
        <p role="alert" className="fa-media-category-error">
          {errorMessage}
        </p>
      ) : null}

      {loading && tree.length === 0 ? (
        <p className="fa-media-category-hint">Loading categories…</p>
      ) : null}

      {!loading && !errorMessage && tree.length === 0 ? (
        <p className="fa-media-category-hint">{emptyHint}</p>
      ) : null}

      {tree.length > 0 ? (
        <ul className="fa-media-category-tree">
          {tree.map((node) => (
            <CategoryBranch
              key={node.id}
              node={node}
              depth={1}
              idPrefix={idPrefix}
              selected={selected}
              collapsed={collapsed}
              disabled={disabled}
              onToggleSelected={toggleSelected}
              onToggleCollapsed={toggleCollapsed}
            />
          ))}
        </ul>
      ) : null}

      <div className="fa-media-category-selection">
        {chips.length ? (
          <>
            <ul className="fa-media-category-chips" aria-label="Selected categories">
              {chips.map((chip) => (
                <li key={chip.id} className="fa-media-badge fa-media-category-chip">
                  <span>{chip.path}</span>
                  <button
                    type="button"
                    className="fa-media-category-chip-remove"
                    aria-label={`Remove ${chip.path}`}
                    disabled={disabled}
                    onClick={() => toggleSelected(chip.id)}
                  >
                    {"×"}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="fa-media-category-clear"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          </>
        ) : (
          <p className="fa-media-category-hint">No user categories selected.</p>
        )}
      </div>
    </fieldset>
  );
}

export type CategoryMultiSelectProps = Omit<
  CategoryMultiSelectViewProps,
  "tree" | "loading" | "error"
>;

/**
 * The picker wired to `useCategoryTree()`. Use this on a page; use
 * `CategoryMultiSelectView` when the tree is already in hand (or under test).
 */
export function CategoryMultiSelect(props: CategoryMultiSelectProps) {
  const { tree, loading, error } = useCategoryTree();
  return <CategoryMultiSelectView {...props} tree={tree} loading={loading} error={error} />;
}
