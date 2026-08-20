// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { useCategoryTree, type UseCategoryTree } from "../src/runtime/hooks/useMediaCategories.js";
import type { CategoryNode, CategoryPublic, CategoryTree } from "../src/runtime/schemas.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OWNER_ID = "22222222-2222-4222-8222-222222222222";

function makeNode(id: number, name: string, children: CategoryNode[] = []): CategoryNode {
  return {
    id,
    owner_id: OWNER_ID,
    tenant_id: null,
    name,
    slug: name,
    parent_id: null,
    object_count: 0,
    total_object_count: 0,
    children
  };
}

function makePublic(id: number, name: string, parentId: number | null): CategoryPublic {
  return { id, owner_id: OWNER_ID, tenant_id: null, name, slug: name, parent_id: parentId };
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
    unmount: () => act(() => root.unmount())
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
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

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useCategoryTree", () => {
  it("parses a nested tree, including a 3-level branch", async () => {
    const grandchild = makeNode(3, "2026");
    const child = makeNode(2, "invoices", [grandchild]);
    const root = makeNode(1, "documents", [child]);
    const tree: CategoryTree = { data: [root], count: 3 };
    apiMocks.getCategoryTree.mockResolvedValueOnce(tree);
    let latest: UseCategoryTree | undefined;

    function Probe() {
      latest = useCategoryTree();
      return null;
    }

    const view = render(
      <QueryClientProvider client={createClient()}>
        <Probe />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(latest?.loading).toBe(false);
      expect(latest?.tree).toEqual([root]);
      expect(latest?.tree[0]?.children[0]?.children[0]?.name).toBe("2026");
      expect(latest?.count).toBe(3);
      expect(latest?.error).toBeNull();
    });
    view.unmount();
  });

  it("calls create/update/delete with parent_id and invalidates the tree query key exactly", async () => {
    const client = createClient();
    const before: CategoryTree = { data: [makeNode(1, "documents")], count: 1 };
    const afterCreate: CategoryTree = {
      data: [makeNode(1, "documents", [makeNode(2, "invoices")])],
      count: 2
    };
    apiMocks.getCategoryTree.mockResolvedValueOnce(before).mockResolvedValueOnce(afterCreate);
    apiMocks.createCategory.mockResolvedValueOnce(makePublic(2, "invoices", 1));
    apiMocks.updateCategory.mockResolvedValueOnce(makePublic(2, "invoices-renamed", 1));
    apiMocks.deleteCategory.mockResolvedValueOnce(undefined);
    let latest: UseCategoryTree | undefined;

    function Probe() {
      latest = useCategoryTree();
      return null;
    }

    const view = render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(latest?.tree).toEqual([makeNode(1, "documents")]);
    });

    await act(async () => {
      await latest?.create({ name: "invoices", parent_id: 1 });
    });
    await waitFor(() => {
      expect(apiMocks.createCategory.mock.calls[0]?.[0]).toEqual({ name: "invoices", parent_id: 1 });
      expect(latest?.createMutation.status).toBe("success");
      // The tree query key was invalidated exactly, so the exact same probe
      // observes the refetched, updated tree without a manual `reload()`.
      expect(apiMocks.getCategoryTree).toHaveBeenCalledTimes(2);
      expect(latest?.tree).toEqual(afterCreate.data);
    });

    await act(async () => {
      await latest?.update(2, { name: "invoices-renamed", parent_id: 1 });
    });
    await waitFor(() => {
      expect(apiMocks.updateCategory).toHaveBeenCalledWith(2, { name: "invoices-renamed", parent_id: 1 });
      expect(latest?.updateMutation.status).toBe("success");
    });

    await act(async () => {
      await latest?.remove(2);
    });
    await waitFor(() => {
      expect(apiMocks.deleteCategory).toHaveBeenCalledWith(2);
      expect(latest?.removeMutation.status).toBe("success");
    });
    view.unmount();
  });
});
