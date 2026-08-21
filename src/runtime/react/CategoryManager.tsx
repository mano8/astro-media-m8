import { useMemo, useState } from "react";
import { useCategoryTree } from "../hooks/useMediaCategories.js";
import { ApiError, messageFromDetail } from "../errors.js";
import { collectCategoryPaths } from "./CategoryMultiSelect.js";
import type { CategoryNode } from "../schemas.js";

const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const labelClassName =
  "fa-media-label flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

/**
 * Copy for the refusals the category CRUD surface can answer (`U4`): an
 * unknown/foreign parent, or a structural conflict — a cycle, a cross-tenant
 * parent, a taken sibling name, or a delete blocked by existing children. The
 * 409 case always surfaces the server's own message: those four conflicts
 * each read as a distinct, already-human sentence
 * ("Category has child categories; reparent or delete them first.", "That
 * name is taken among its siblings.", …), and re-wording them here would
 * drift from whichever one the server actually raised.
 */
function describeCategoryError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That parent category no longer exists. Refresh and try again.";
    if (error.status === 403) return "That parent category is not yours to use.";
    if (error.status === 409) {
      return messageFromDetail(error.detail) ?? "That change conflicts with the existing category tree.";
    }
    return messageFromDetail(error.detail) ?? error.message;
  }
  return error instanceof Error ? error.message : "Failed to save the category";
}

type ParentOption = { id: number | null; label: string };

/** Every category as a flattened `{id, path}` option, plus a root option. */
function parentOptions(tree: readonly CategoryNode[]): ParentOption[] {
  const paths = collectCategoryPaths(tree);
  const options: ParentOption[] = [{ id: null, label: "— Root —" }];
  for (const option of paths.values()) {
    options.push({ id: option.id, label: option.path });
  }
  return options;
}

function findNode(nodes: readonly CategoryNode[], id: number): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

type RowProps = {
  node: CategoryNode;
  depth: number;
  options: readonly ParentOption[];
  onRename: (id: number, name: string) => Promise<void>;
  onReparent: (id: number, parentId: number | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAddChild: (parentId: number) => void;
};

/**
 * One category row plus its subtree. Rename, reparent and delete are each a
 * plain form action — no drag-and-drop (decided 2026-08-18) — so a cycle,
 * cross-tenant parent, taken-sibling-name or has-children refusal is just the
 * mutation's promise rejecting; the server stays the single source of truth
 * for every structural guard, this row only surfaces what it says.
 */
function CategoryManagerRow({ node, depth, options, onRename, onReparent, onDelete, onAddChild }: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(node.name);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function saveRename() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === node.name) {
      setRenaming(false);
      setDraftName(node.name);
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await onRename(node.id, trimmed);
      setRenaming(false);
    } catch (error) {
      setRowError(describeCategoryError(error));
    } finally {
      setBusy(false);
    }
  }

  async function reparentTo(value: string) {
    const parentId = value === "" ? null : Number(value);
    if (parentId === node.parent_id) return;
    setBusy(true);
    setRowError(null);
    try {
      await onReparent(node.id, parentId);
    } catch (error) {
      setRowError(describeCategoryError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setRowError(null);
    try {
      await onDelete(node.id);
    } catch (error) {
      setRowError(describeCategoryError(error));
    } finally {
      setBusy(false);
    }
  }

  // A node cannot be its own parent — the one cycle worth foreclosing
  // client-side. Every deeper cycle (reparenting under a descendant) is left
  // to the server's 409, surfaced above.
  const reparentOptions = options.filter((option) => option.id !== node.id);
  const parentSelectId = `fa-media-category-manager-parent-${node.id}`;
  const nameInputId = `fa-media-category-manager-name-${node.id}`;

  return (
    <li className="fa-media-category-manager-node" aria-level={depth}>
      <div className="fa-media-category-manager-row">
        {renaming ? (
          <>
            <label className="fa-media-category-manager-sr-label" htmlFor={nameInputId}>
              {`Rename ${node.name}`}
            </label>
            <input
              id={nameInputId}
              className={inputClassName}
              value={draftName}
              disabled={busy}
              onChange={(event) => setDraftName(event.currentTarget.value)}
            />
            <button type="button" disabled={busy} onClick={() => void saveRename()}>
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRenaming(false);
                setDraftName(node.name);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="fa-media-category-manager-name">{node.name}</span>
            <span className="fa-media-badge fa-media-category-count">{node.total_object_count}</span>
            <button type="button" disabled={busy} onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button type="button" disabled={busy} onClick={() => onAddChild(node.id)}>
              Add child
            </button>
            <label className="fa-media-category-manager-reparent-label" htmlFor={parentSelectId}>
              Parent
              <select
                id={parentSelectId}
                className={inputClassName}
                disabled={busy}
                value={node.parent_id ?? ""}
                onChange={(event) => void reparentTo(event.currentTarget.value)}
              >
                {reparentOptions.map((option) => (
                  <option key={option.id ?? "root"} value={option.id ?? ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void handleDelete()}>
              Delete
            </button>
          </>
        )}
      </div>
      {rowError ? (
        <p role="alert" className="fa-media-category-manager-error">
          {rowError}
        </p>
      ) : null}
      {node.children.length > 0 ? (
        <ul className="fa-media-category-manager-children">
          {node.children.map((child) => (
            <CategoryManagerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              options={options}
              onRename={onRename}
              onReparent={onReparent}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Create/rename/reparent/delete over the caller's user category tree
 * (`useCategoryTree`). Reparenting and deleting are plain form actions, not
 * drag-and-drop, per the 2026-08-18 decision — this keeps the manager
 * Sonnet-scale and sidesteps the a11y/touch surface a draggable tree would
 * need. This component owns CRUD only; browsing/filtering the tree is `U7`'s
 * job on `MediaLibrary`.
 */
export function CategoryManager() {
  const { tree, count, loading, error, create, update, remove } = useCategoryTree();
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const options = useMemo(() => parentOptions(tree), [tree]);

  async function rename(id: number, name: string) {
    const node = findNode(tree, id);
    await update(id, { name, parent_id: node?.parent_id ?? null });
  }

  async function reparent(id: number, parentId: number | null) {
    const node = findNode(tree, id);
    await update(id, { name: node?.name ?? "", parent_id: parentId });
  }

  async function submitCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      await create({ name: trimmed, parent_id: newParentId === "" ? null : Number(newParentId) });
      setNewName("");
      setNewParentId("");
    } catch (error) {
      setCreateError(describeCategoryError(error));
    } finally {
      setCreateBusy(false);
    }
  }

  // "Add child" on a row just pre-selects that row as the create form's
  // parent — one form, not a second inline one per node.
  function addChildTo(parentId: number) {
    setNewParentId(String(parentId));
    setCreateError(null);
  }

  const loadErrorMessage = error
    ? error instanceof ApiError
      ? (messageFromDetail(error.detail) ?? "Failed to load categories")
      : error instanceof Error
        ? error.message
        : "Failed to load categories"
    : null;

  return (
    <section className="not-content fa-media-panel">
      <h2>Categories</h2>
      {loadErrorMessage ? <p role="alert">{loadErrorMessage}</p> : null}

      {!loading && !loadErrorMessage && tree.length === 0 ? (
        <p className="fa-media-category-hint">No user categories yet. Create one below.</p>
      ) : null}

      {tree.length > 0 ? (
        <ul className="fa-media-category-manager-tree">
          {tree.map((node) => (
            <CategoryManagerRow
              key={node.id}
              node={node}
              depth={1}
              options={options}
              onRename={rename}
              onReparent={reparent}
              onDelete={remove}
              onAddChild={addChildTo}
            />
          ))}
        </ul>
      ) : null}

      <fieldset className="fa-media-category-manager-create">
        <legend>{`New category (${count} total)`}</legend>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-category-manager-new-name">
            Name
          </label>
          <input
            id="fa-media-category-manager-new-name"
            className={inputClassName}
            value={newName}
            disabled={createBusy}
            onChange={(event) => setNewName(event.currentTarget.value)}
          />
        </div>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-category-manager-new-parent">
            Parent
          </label>
          <select
            id="fa-media-category-manager-new-parent"
            className={inputClassName}
            value={newParentId}
            disabled={createBusy}
            onChange={(event) => setNewParentId(event.currentTarget.value)}
          >
            {options.map((option) => (
              <option key={option.id ?? "root"} value={option.id ?? ""}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" disabled={createBusy || !newName.trim()} onClick={() => void submitCreate()}>
          {createBusy ? "Creating…" : "Add category"}
        </button>
        {createError ? <p role="alert">{createError}</p> : null}
      </fieldset>
    </section>
  );
}
