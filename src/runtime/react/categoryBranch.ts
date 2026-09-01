/**
 * The browse-pane selection and its translation into list params, shared by
 * `MediaLibrary` and the tree pane it mounts.
 */
import type { MediaLibraryLabels } from "./mediaLibraryLabels.js";
import type { ObjectListParams } from "../schemas.js";

/**
 * What the browse pane has selected. The two pseudo-nodes are part of the
 * selection rather than a separate toggle because they are mutually exclusive
 * with a branch: "all" clears `category_id`/`include_descendants`/
 * `uncategorized`, "uncategorized" sets only `uncategorized`, and a category
 * sets `category_id` + `include_descendants`. Modelling them as three
 * independent booleans would let the UI reach states the API rejects.
 */
export type CategoryBranchSelection =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: number };

/**
 * The one place a selection becomes list params. Every key is written on every
 * selection — `undefined` where it does not apply — so switching branches
 * clears the previous branch's params instead of leaving a stale
 * `category_id` next to a fresh `uncategorized`.
 *
 * A branch selection is always descendant-inclusive: the node badge shows
 * `total_object_count`, so a branch that lists fewer objects than its own badge
 * promises would read as a bug.
 */
export function branchListParams(selection: CategoryBranchSelection): Pick<
  ObjectListParams,
  "category_id" | "include_descendants" | "uncategorized"
> {
  return {
    category_id: selection.kind === "category" ? selection.id : undefined,
    include_descendants: selection.kind === "category" ? true : undefined,
    uncategorized: selection.kind === "uncategorized" ? true : undefined
  };
}

/** A concise, visible description of the branch whose filters will be exported. */
export function exportBranchLabel(selection: CategoryBranchSelection, labels: MediaLibraryLabels["tree"]): string {
  switch (selection.kind) {
    case "all":
      return labels.allMediaScope;
    case "uncategorized":
      return labels.uncategorizedScope;
    case "category":
      return labels.selectedScope(selection.id);
  }
}

/** Keep the pane in step with a caller-supplied `initial` branch filter. */
export function initialBranchSelection(params: ObjectListParams): CategoryBranchSelection {
  if (params.category_id != null) return { kind: "category", id: params.category_id };
  if (params.uncategorized) return { kind: "uncategorized" };
  return { kind: "all" };
}

