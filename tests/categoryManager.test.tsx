// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryNode, CategoryPublic } from "../src/runtime/schemas.js";

const apiMocks = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn()
}));

vi.mock("../src/runtime/api/categories.js", () => ({
  getCategoryTree: apiMocks.getCategoryTree,
  createCategory: apiMocks.createCategory,
  updateCategory: apiMocks.updateCategory,
  deleteCategory: apiMocks.deleteCategory
}));

import { CategoryManager } from "../src/runtime/react/CategoryManager.js";
import { ApiError } from "../src/runtime/errors.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OWNER_ID = "22222222-2222-4222-8222-222222222222";

function makeNode(
  id: number,
  name: string,
  parentId: number | null = null,
  children: CategoryNode[] = []
): CategoryNode {
  return {
    id,
    owner_id: OWNER_ID,
    tenant_id: null,
    name,
    slug: name.toLowerCase(),
    parent_id: parentId,
    object_count: 0,
    total_object_count: children.length,
    children
  };
}

function makePublic(id: number, name: string, parentId: number | null): CategoryPublic {
  return { id, owner_id: OWNER_ID, tenant_id: null, name, slug: name.toLowerCase(), parent_id: parentId };
}

/** Invoices > 2026, plus a flat sibling. */
function sampleTree(): CategoryNode[] {
  return [makeNode(1, "Invoices", null, [makeNode(2, "2026", 1)]), makeNode(3, "Contracts")];
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

// Setting `.value` directly leaves React's controlled-input tracking behind
// its own value, so the subsequent `input` event is a no-op for state — the
// native setter has to be invoked instead, the standard workaround for a
// simulated keystroke on a React-controlled input.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value"
)?.set;

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function rowFor(container: Element, name: string): HTMLLIElement {
  const match = [...container.querySelectorAll<HTMLLIElement>(".fa-media-category-manager-node")].find(
    (node) => node.querySelector(".fa-media-category-manager-name")?.textContent === name
  );
  if (!match) throw new Error(`No category row named ${name}`);
  return match;
}

function buttonIn(scope: Element, label: string): HTMLButtonElement {
  const match = [...scope.querySelectorAll("button")].find((node) => node.textContent === label);
  if (!match) throw new Error(`No button labelled ${label}`);
  return match as HTMLButtonElement;
}

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CategoryManager", () => {
  it("renders the nested tree with counts and the create form", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: sampleTree(), count: 3 });
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "Invoices")).toBeTruthy();
      expect(rowFor(view.container, "2026")).toBeTruthy();
      expect(rowFor(view.container, "Contracts")).toBeTruthy();
      expect(view.container.querySelector("legend")?.textContent).toBe("New category (3 total)");
    });
    view.unmount();
  });

  it("renders a prompt instead of an empty tree when there are no categories yet", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: [], count: 0 });
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(view.container.textContent).toContain("No user categories yet. Create one below.");
    });
    view.unmount();
  });

  it("creates a root category from the form", async () => {
    apiMocks.getCategoryTree
      .mockResolvedValueOnce({ data: [], count: 0 })
      .mockResolvedValueOnce({ data: [makeNode(1, "Invoices")], count: 1 });
    apiMocks.createCategory.mockResolvedValueOnce(makePublic(1, "Invoices", null));
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(view.container.querySelector("#fa-media-category-manager-new-name")).toBeTruthy();
    });

    const nameInput = view.container.querySelector(
      "#fa-media-category-manager-new-name"
    ) as HTMLInputElement;
    typeInto(nameInput, "Invoices");
    click(buttonIn(view.container, "Add category"));

    await waitFor(() => {
      expect(apiMocks.createCategory.mock.calls[0]?.[0]).toEqual({ name: "Invoices", parent_id: null });
      expect(rowFor(view.container, "Invoices")).toBeTruthy();
    });
    view.unmount();
  });

  it("'Add child' pre-selects the row as the create form's parent", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: sampleTree(), count: 3 });
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "Invoices")).toBeTruthy();
    });

    const invoicesRow = rowFor(view.container, "Invoices");
    click(buttonIn(invoicesRow, "Add child"));

    const parentSelect = view.container.querySelector(
      "#fa-media-category-manager-new-parent"
    ) as HTMLSelectElement;
    await waitFor(() => {
      expect(parentSelect.value).toBe("1");
    });
    view.unmount();
  });

  it("renames a category, preserving its current parent", async () => {
    const tree = sampleTree();
    apiMocks.getCategoryTree
      .mockResolvedValueOnce({ data: tree, count: 3 })
      .mockResolvedValueOnce({
        data: [makeNode(1, "Invoices", null, [makeNode(2, "FY2026", 1)]), makeNode(3, "Contracts")],
        count: 3
      });
    apiMocks.updateCategory.mockResolvedValueOnce(makePublic(2, "FY2026", 1));
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "2026")).toBeTruthy();
    });

    const childRow = rowFor(view.container, "2026");
    click(buttonIn(childRow, "Rename"));
    const renameInput = childRow.querySelector("input") as HTMLInputElement;
    typeInto(renameInput, "FY2026");
    click(buttonIn(childRow, "Save"));

    await waitFor(() => {
      expect(apiMocks.updateCategory).toHaveBeenCalledWith(2, { name: "FY2026", parent_id: 1 });
      expect(rowFor(view.container, "FY2026")).toBeTruthy();
    });
    view.unmount();
  });

  it("reparents a category via the select, preserving its current name", async () => {
    apiMocks.getCategoryTree
      .mockResolvedValueOnce({ data: sampleTree(), count: 3 })
      .mockResolvedValueOnce({
        data: [makeNode(1, "Invoices"), makeNode(3, "Contracts", null, [makeNode(2, "2026", 3)])],
        count: 3
      });
    apiMocks.updateCategory.mockResolvedValueOnce(makePublic(2, "2026", 3));
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "2026")).toBeTruthy();
    });

    const childRow = rowFor(view.container, "2026");
    const parentSelect = childRow.querySelector("select") as HTMLSelectElement;
    act(() => {
      parentSelect.value = "3";
      parentSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(apiMocks.updateCategory).toHaveBeenCalledWith(2, { name: "2026", parent_id: 3 });
    });
    view.unmount();
  });

  it("a category's own row is excluded from its reparent options", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: sampleTree(), count: 3 });
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "Invoices")).toBeTruthy();
    });

    const invoicesRow = rowFor(view.container, "Invoices");
    const parentSelect = invoicesRow.querySelector("select") as HTMLSelectElement;
    const optionLabels = [...parentSelect.options].map((option) => option.textContent);
    expect(optionLabels).not.toContain("Invoices");
    expect(optionLabels).toContain("— Root —");
    expect(optionLabels).toContain("Contracts");
    view.unmount();
  });

  it("deletes a category", async () => {
    apiMocks.getCategoryTree
      .mockResolvedValueOnce({ data: sampleTree(), count: 3 })
      .mockResolvedValueOnce({ data: [makeNode(1, "Invoices", null, [makeNode(2, "2026", 1)])], count: 2 });
    apiMocks.deleteCategory.mockResolvedValueOnce(undefined);
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "Contracts")).toBeTruthy();
    });

    click(buttonIn(rowFor(view.container, "Contracts"), "Delete"));

    await waitFor(() => {
      expect(apiMocks.deleteCategory).toHaveBeenCalledWith(3);
      expect(() => rowFor(view.container, "Contracts")).toThrow();
    });
    view.unmount();
  });

  it("surfaces the server's 409 detail when deleting a category with children", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: sampleTree(), count: 3 });
    apiMocks.deleteCategory.mockRejectedValueOnce(
      new ApiError(409, { message: "Category has child categories; reparent or delete them first." })
    );
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(rowFor(view.container, "Invoices")).toBeTruthy();
    });

    click(buttonIn(rowFor(view.container, "Invoices"), "Delete"));

    await waitFor(() => {
      const alert = rowFor(view.container, "Invoices").querySelector('[role="alert"]');
      expect(alert?.textContent).toBe("Category has child categories; reparent or delete them first.");
    });
    // The row survives the refusal — it is still there to reparent/delete children from.
    expect(rowFor(view.container, "Invoices")).toBeTruthy();
    view.unmount();
  });

  it("maps a 404/403 parent refusal on create to friendly copy", async () => {
    apiMocks.getCategoryTree.mockResolvedValueOnce({ data: [], count: 0 });
    apiMocks.createCategory.mockRejectedValueOnce(new ApiError(403, "forbidden"));
    const view = render(withClient(<CategoryManager />));

    await waitFor(() => {
      expect(view.container.querySelector("#fa-media-category-manager-new-name")).toBeTruthy();
    });

    const nameInput = view.container.querySelector(
      "#fa-media-category-manager-new-name"
    ) as HTMLInputElement;
    typeInto(nameInput, "Invoices");
    click(buttonIn(view.container, "Add category"));

    await waitFor(() => {
      const alert = view.container.querySelector(".fa-media-category-manager-create [role='alert']");
      expect(alert?.textContent).toBe("That parent category is not yours to use.");
    });
    view.unmount();
  });
});
