// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryNode, MediaObjectPublic } from "../src/runtime/schemas.js";

const apiMocks = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  getDownloadUrl: vi.fn(),
  resolveShare: vi.fn(),
  listPresets: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
  listVariants: vi.fn(),
  generateVariants: vi.fn(),
  getVariantJob: vi.fn(),
  deleteVariant: vi.fn(),
  waitForVariantJob: vi.fn(),
  initiateUpload: vi.fn(),
  completeUpload: vi.fn(),
  abortUpload: vi.fn(),
  createController: vi.fn()
}));

// Every api module the components reach is mocked, which keeps `client.ts`
// (and its `export * from "./api/index.js"` fan-out) out of the graph entirely.
vi.mock("../src/runtime/api/uploads.js", () => ({
  initiateUpload: apiMocks.initiateUpload,
  completeUpload: apiMocks.completeUpload,
  abortUpload: apiMocks.abortUpload
}));

vi.mock("../src/runtime/api/categories.js", () => ({
  getCategoryTree: apiMocks.getCategoryTree,
  createCategory: apiMocks.createCategory,
  updateCategory: apiMocks.updateCategory,
  deleteCategory: apiMocks.deleteCategory
}));

vi.mock("../src/runtime/api/objects.js", () => ({
  getObject: apiMocks.getObject,
  updateObject: apiMocks.updateObject,
  deleteObject: apiMocks.deleteObject,
  getDownloadUrl: apiMocks.getDownloadUrl
}));

vi.mock("../src/runtime/api/shares.js", () => ({ resolveShare: apiMocks.resolveShare }));
vi.mock("../src/runtime/api/presets.js", () => ({
  listPresets: apiMocks.listPresets,
  createPreset: apiMocks.createPreset,
  updatePreset: apiMocks.updatePreset,
  deletePreset: apiMocks.deletePreset
}));
vi.mock("../src/runtime/api/variants.js", () => ({
  listVariants: apiMocks.listVariants,
  generateVariants: apiMocks.generateVariants,
  getVariantJob: apiMocks.getVariantJob,
  deleteVariant: apiMocks.deleteVariant,
  waitForVariantJob: apiMocks.waitForVariantJob
}));

// Keep `UploadError` real — `MediaUploadDropzone` narrows on it — and replace
// only the controller factory, so the assertion sits on the input the picker
// hands the upload layer.
vi.mock("../src/runtime/upload/uploadController.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/runtime/upload/uploadController.js")>();
  return { ...actual, createMediaUploadController: apiMocks.createController };
});

import {
  CategoryMultiSelectView,
  collectCategoryPaths,
  isSameCategorySelection
} from "../src/runtime/react/CategoryMultiSelect.js";
import { MediaUploadDropzone } from "../src/runtime/react/MediaUploadDropzone.js";
import { ObjectDetail } from "../src/runtime/react/ObjectDetail.js";
import { ApiError } from "../src/runtime/errors.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-21T00:00:00Z";

function makeNode(id: number, name: string, children: CategoryNode[] = []): CategoryNode {
  return {
    id,
    owner_id: OWNER_ID,
    tenant_id: null,
    name,
    slug: name.toLowerCase(),
    parent_id: null,
    object_count: 0,
    total_object_count: children.length,
    children
  };
}

/** Invoices > 2026 > Q1, plus a flat sibling. */
function sampleTree(): CategoryNode[] {
  return [makeNode(1, "Invoices", [makeNode(2, "2026", [makeNode(3, "Q1")])]), makeNode(4, "Contracts")];
}

function mediaObject(overrides: Partial<MediaObjectPublic> = {}): MediaObjectPublic {
  return {
    id: OBJECT_ID,
    tenant_id: null,
    owner_user_id: OWNER_ID,
    category: "document",
    visibility: "private",
    storage_bucket: "media",
    object_key: "objects/x",
    original_filename: "contract.pdf",
    mime_type: "application/pdf",
    extension: "pdf",
    size_bytes: 12,
    sha256: null,
    etag: null,
    storage_class: "standard",
    status: "ready",
    scan_status: "clean",
    moderation_status: "approved",
    categories: [],
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides
  };
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  return {
    container,
    rerender: (next: ReactNode) => act(() => root.render(<>{next}</>)),
    unmount: () => act(() => root.unmount())
  };
}

function withClient(element: ReactNode) {
  return <QueryClientProvider client={createClient()}>{element}</QueryClientProvider>;
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });
    }
  }
  throw lastError;
}

function click(element: Element | null | undefined) {
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function checkboxFor(container: Element, label: string): HTMLInputElement {
  const match = [...container.querySelectorAll<HTMLLabelElement>("label")].find((node) =>
    node.querySelector(".fa-media-category-name")?.textContent === label
  );
  if (!match) throw new Error(`No category row labelled ${label}`);
  return match.querySelector("input[type=checkbox]") as HTMLInputElement;
}

function toggle(container: Element, label: string) {
  const input = checkboxFor(container, label);
  act(() => {
    input.click();
  });
}

function chipTexts(container: Element): string[] {
  return [...container.querySelectorAll(".fa-media-category-chip > span")].map(
    (node) => node.textContent ?? ""
  );
}

function buttonWithText(container: Element, text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find((node) => node.textContent?.trim() === text);
  if (!match) throw new Error(`No button labelled ${text}`);
  return match;
}

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.getCategoryTree.mockResolvedValue({ data: sampleTree(), count: 4 });
  apiMocks.getObject.mockResolvedValue(mediaObject());
  apiMocks.listPresets.mockResolvedValue([]);
  apiMocks.listVariants.mockResolvedValue({ items: [], count: 0 });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("collectCategoryPaths / isSameCategorySelection", () => {
  it("builds slash-joined paths for every depth", () => {
    const paths = collectCategoryPaths(sampleTree());
    expect(paths.get(1)?.path).toBe("Invoices");
    expect(paths.get(2)?.path).toBe("Invoices / 2026");
    expect(paths.get(3)?.path).toBe("Invoices / 2026 / Q1");
    expect(paths.get(4)?.path).toBe("Contracts");
  });

  it("compares selections as sets, not as ordered arrays", () => {
    expect(isSameCategorySelection([1, 2], [2, 1])).toBe(true);
    expect(isSameCategorySelection([1, 2], [1])).toBe(false);
    expect(isSameCategorySelection([1, 2], [1, 3])).toBe(false);
  });
});

describe("CategoryMultiSelectView", () => {
  it("renders the nested tree and emits category_ids arrays without cascading", () => {
    const onChange = vi.fn();
    const view = render(
      <CategoryMultiSelectView value={[]} onChange={onChange} tree={sampleTree()} />
    );

    // Every level is rendered, each subtree in its own nested list.
    expect(view.container.querySelectorAll("input[type=checkbox]")).toHaveLength(4);
    expect(view.container.querySelectorAll("ul.fa-media-category-children")).toHaveLength(2);
    expect(checkboxFor(view.container, "Q1").closest("li")?.getAttribute("aria-level")).toBe("3");

    toggle(view.container, "Invoices");
    expect(onChange).toHaveBeenLastCalledWith([1]);
    // A parent selection never files the descendants too.
    expect(onChange).toHaveBeenCalledTimes(1);

    view.rerender(<CategoryMultiSelectView value={[1]} onChange={onChange} tree={sampleTree()} />);
    toggle(view.container, "Q1");
    expect(onChange).toHaveBeenLastCalledWith([1, 3]);

    view.rerender(<CategoryMultiSelectView value={[1, 3]} onChange={onChange} tree={sampleTree()} />);
    toggle(view.container, "Invoices");
    expect(onChange).toHaveBeenLastCalledWith([3]);
    view.unmount();
  });

  it("reflects prior assignments as checked rows and removable chips", () => {
    const onChange = vi.fn();
    const view = render(
      <CategoryMultiSelectView value={[3, 4]} onChange={onChange} tree={sampleTree()} />
    );

    expect(checkboxFor(view.container, "Q1").checked).toBe(true);
    expect(checkboxFor(view.container, "Contracts").checked).toBe(true);
    expect(checkboxFor(view.container, "Invoices").checked).toBe(false);
    expect(chipTexts(view.container)).toEqual(["Invoices / 2026 / Q1", "Contracts"]);
    // The unselected ancestors of a selected node are marked, not checked.
    expect(view.container.querySelectorAll(".fa-media-category-marker")).toHaveLength(2);

    click(view.container.querySelector('[aria-label="Remove Contracts"]'));
    expect(onChange).toHaveBeenLastCalledWith([3]);

    click(buttonWithText(view.container, "Clear all"));
    expect(onChange).toHaveBeenLastCalledWith([]);
    view.unmount();
  });

  it("labels a selected id the tree does not carry from the fallback labels", () => {
    const view = render(
      <CategoryMultiSelectView
        value={[9, 12]}
        onChange={vi.fn()}
        tree={sampleTree()}
        fallbackLabels={new Map([[9, "Archived / 2019"]])}
      />
    );
    expect(chipTexts(view.container)).toEqual(["Archived / 2019", "#12"]);
    view.unmount();
  });

  it("collapses and expands a branch", () => {
    const view = render(<CategoryMultiSelectView value={[]} onChange={vi.fn()} tree={sampleTree()} />);
    const toggleButton = view.container.querySelector('[aria-label="Collapse Invoices"]');
    click(toggleButton);
    expect(view.container.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    click(view.container.querySelector('[aria-label="Expand Invoices"]'));
    expect(view.container.querySelectorAll("input[type=checkbox]")).toHaveLength(4);
    view.unmount();
  });

  it("shows loading, empty and error states instead of a blank box", () => {
    const loadingView = render(
      <CategoryMultiSelectView value={[]} onChange={vi.fn()} tree={[]} loading />
    );
    expect(loadingView.container.textContent).toContain("Loading categories…");
    loadingView.unmount();

    const emptyView = render(
      <CategoryMultiSelectView value={[]} onChange={vi.fn()} tree={[]} emptyHint="Nothing filed yet." />
    );
    expect(emptyView.container.textContent).toContain("Nothing filed yet.");
    expect(emptyView.container.textContent).toContain("No user categories selected.");
    emptyView.unmount();

    const errorView = render(
      <CategoryMultiSelectView
        value={[]}
        onChange={vi.fn()}
        tree={[]}
        error={new ApiError(403, "Categories are not available for this account")}
      />
    );
    expect(errorView.container.querySelector("[role=alert]")?.textContent).toBe(
      "Categories are not available for this account"
    );
    errorView.unmount();
  });
});

describe("MediaUploadDropzone user categories", () => {
  it("passes the picked category_ids to the upload controller, and omits an empty pick", async () => {
    const started = vi.fn().mockResolvedValue(mediaObject());
    apiMocks.createController.mockImplementation(() => ({
      on: () => () => undefined,
      start: started,
      abort: () => undefined
    }));

    const view = render(withClient(<MediaUploadDropzone />));
    await waitFor(() => expect(checkboxFor(view.container, "Invoices")).toBeTruthy());

    const file = new File(["data"], "photo.png", { type: "image/png" });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });

    // No user category picked: the field is omitted rather than sent as `[]`.
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(apiMocks.createController).toHaveBeenCalledTimes(1));
    expect(apiMocks.createController.mock.calls[0][0].categoryIds).toBeUndefined();

    toggle(view.container, "Q1");
    toggle(view.container, "Contracts");
    await waitFor(() => expect(checkboxFor(view.container, "Q1").checked).toBe(true));
    expect(chipTexts(view.container)).toEqual(["Invoices / 2026 / Q1", "Contracts"]);

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(apiMocks.createController).toHaveBeenCalledTimes(2));
    expect(apiMocks.createController.mock.calls[1][0]).toMatchObject({
      category: "asset",
      visibility: "private",
      categoryIds: [3, 4]
    });
    view.unmount();
  });

  it("can be rendered without the picker", async () => {
    const view = render(withClient(<MediaUploadDropzone showUserCategories={false} />));
    await waitFor(() => expect(view.container.querySelector('input[type="file"]')).toBeTruthy());
    expect(view.container.querySelector(".fa-media-category-picker")).toBeNull();
    expect(apiMocks.getCategoryTree).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe("ObjectDetail re-filing", () => {
  it("reflects prior assignments and PATCHes the whole set", async () => {
    apiMocks.getObject.mockResolvedValue(
      mediaObject({ categories: [{ id: 1, name: "Invoices", path: "Invoices" }] })
    );
    apiMocks.updateObject.mockImplementation(async (_id: string, patch: { category_ids?: number[] }) =>
      mediaObject({
        categories: (patch.category_ids ?? []).map((id) => ({ id, name: `c${id}`, path: `c${id}` }))
      })
    );

    const view = render(withClient(<ObjectDetail objectId={OBJECT_ID} />));
    await waitFor(() => expect(checkboxFor(view.container, "Invoices")).toBeTruthy());

    // Edit mode reflects the served filing before any interaction.
    expect(checkboxFor(view.container, "Invoices").checked).toBe(true);
    expect(chipTexts(view.container)).toEqual(["Invoices"]);
    expect(buttonWithText(view.container, "Save categories").disabled).toBe(true);

    toggle(view.container, "Q1");
    await waitFor(() => expect(buttonWithText(view.container, "Save categories").disabled).toBe(false));

    click(buttonWithText(view.container, "Save categories"));
    await waitFor(() => expect(apiMocks.updateObject).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateObject).toHaveBeenCalledWith(OBJECT_ID, { category_ids: [1, 3] });
    await waitFor(() => expect(buttonWithText(view.container, "Save categories").disabled).toBe(true));
    view.unmount();
  });

  it("unfiles an object with an empty array and can reset an untouched draft", async () => {
    apiMocks.getObject.mockResolvedValue(
      mediaObject({ categories: [{ id: 4, name: "Contracts", path: "Contracts" }] })
    );
    apiMocks.updateObject.mockResolvedValue(mediaObject({ categories: [] }));

    const view = render(withClient(<ObjectDetail objectId={OBJECT_ID} />));
    await waitFor(() => expect(checkboxFor(view.container, "Contracts").checked).toBe(true));

    click(buttonWithText(view.container, "Clear all"));
    await waitFor(() => expect(checkboxFor(view.container, "Contracts").checked).toBe(false));

    click(buttonWithText(view.container, "Reset"));
    await waitFor(() => expect(checkboxFor(view.container, "Contracts").checked).toBe(true));
    expect(apiMocks.updateObject).not.toHaveBeenCalled();

    click(buttonWithText(view.container, "Clear all"));
    await waitFor(() => expect(buttonWithText(view.container, "Save categories").disabled).toBe(false));
    click(buttonWithText(view.container, "Save categories"));
    await waitFor(() => expect(apiMocks.updateObject).toHaveBeenCalledWith(OBJECT_ID, { category_ids: [] }));
    view.unmount();
  });

  it("surfaces the assignment refusals as their own copy", async () => {
    apiMocks.getObject.mockResolvedValue(mediaObject({ categories: [] }));
    apiMocks.updateObject.mockRejectedValue(new ApiError(403, "Category 3 is not yours"));

    const view = render(withClient(<ObjectDetail objectId={OBJECT_ID} />));
    await waitFor(() => expect(checkboxFor(view.container, "Q1")).toBeTruthy());

    toggle(view.container, "Q1");
    await waitFor(() => expect(buttonWithText(view.container, "Save categories").disabled).toBe(false));
    click(buttonWithText(view.container, "Save categories"));

    await waitFor(() =>
      expect(
        [...view.container.querySelectorAll("[role=alert]")].map((node) => node.textContent)
      ).toContain("One of the selected categories is not yours to use.")
    );
    // The draft survives the refusal so the user can retry or reset.
    expect(checkboxFor(view.container, "Q1").checked).toBe(true);
    view.unmount();
  });
});
