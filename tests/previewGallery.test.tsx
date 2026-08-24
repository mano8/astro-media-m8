// @vitest-environment jsdom
//
// `A-C2`: the dev-only `/_preview` gallery.
//
// `npm run preview:build` proves the gallery *compiles*. That is exactly the
// kind of green light this plan keeps finding pointed at the wrong thing — the
// shared package's own gallery compiled for months while every `table-page`
// sibling import was unresolved, because nothing ever ran it. So this suite
// mounts the gallery and asserts it renders real rows: the views, hooks, api
// wrappers and Zod schemas are the shipped ones, and only `fetch` is replaced.
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installServiceStub } from "../fixtures/preview/src/service-stub.js";
import { PreviewApp } from "../fixtures/preview/src/preview-app.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let restoreFetch: typeof globalThis.fetch;
const mounted: Array<() => void> = [];

beforeEach(() => {
  restoreFetch = installServiceStub();
});

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.();
  globalThis.fetch = restoreFetch;
});

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  mounted.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

function click(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text)
  );
  if (!button) throw new Error(`No button matching ${text}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

describe("preview gallery", () => {
  it("renders the library island against the stub service", async () => {
    const container = render(<PreviewApp />);

    // A filename only appears if the whole path worked: the view mounted, the
    // hook ran, the api wrapper built a request, the stub answered it, and the
    // Zod schema accepted the answer. A shape the schema rejects fails here.
    await waitFor(() => {
      expect(container.textContent).toContain("sample-1.png");
    });
  });

  it("catches a throw in the boundary panel rather than blanking the gallery", async () => {
    const container = render(<PreviewApp />);

    click(container, "Error boundary");
    click(container, "Break the probe");

    await waitFor(() => {
      expect(container.querySelector('[data-media-error-boundary="fallback"]')).not.toBeNull();
    });
    // The gallery shell itself survives, which is the property the boundary
    // exists to give an island's host page.
    expect(container.textContent).toContain("astro-media-m8 /_preview");
  });
});

describe("gallery service stub", () => {
  it("answers the list filters the library view sends", async () => {
    const read = async (query: string) => {
      const response = await fetch(`/media-api/objects?${query}`);
      return (await response.json()) as { items: { category: string }[]; count: number };
    };

    const all = await read("limit=100");
    expect(all.count).toBe(64);

    const documents = await read("category=document&limit=100");
    expect(documents.count).toBeLessThan(all.count);
    expect(documents.items.every((item) => item.category === "document")).toBe(true);

    // A blank parameter means absent, not "match the empty string".
    const blank = await read("category=&visibility=&status=&limit=100");
    expect(blank.count).toBe(all.count);
  });

  it("404s an unstubbed path instead of hanging", async () => {
    const response = await fetch("/media-api/not-a-real-route");
    expect(response.status).toBe(404);
  });
});
