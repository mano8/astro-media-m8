// @vitest-environment jsdom
//
// `A-C3`: the island-root error boundary.
//
// The `island-error-boundary` gate in `scripts/verify-fleet-gates.mjs` proves
// every island root is *wrapped*; these tests prove the wrapper does something —
// that a render throw is caught rather than propagated, that the caught message
// never reaches the DOM, and that both recovery paths work.
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaErrorBoundary } from "../src/runtime/react/MediaErrorBoundary.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs every caught render throw regardless of what the boundary does.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const mounted: Array<() => void> = [];

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.();
  consoleError.mockRestore();
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

function Boom({ throws, message = "render exploded" }: { throws: boolean; message?: string }) {
  if (throws) throw new Error(message);
  return <p>healthy child</p>;
}

describe("MediaErrorBoundary", () => {
  it("renders children while nothing throws", () => {
    const container = render(
      <MediaErrorBoundary>
        <Boom throws={false} />
      </MediaErrorBoundary>
    );

    expect(container.textContent).toContain("healthy child");
    expect(container.querySelector("[data-media-error-boundary]")).toBeNull();
  });

  it("catches a render throw and renders the plugin error surface", () => {
    const container = render(
      <MediaErrorBoundary>
        <Boom throws />
      </MediaErrorBoundary>
    );

    expect(container.querySelector('[data-media-error-boundary="fallback"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain("This view stopped responding");
    expect(container.textContent).not.toContain("healthy child");
  });

  it("never renders the caught message, which may carry request detail", () => {
    const container = render(
      <MediaErrorBoundary>
        <Boom throws message="failed for token=super-secret-value" />
      </MediaErrorBoundary>
    );

    expect(container.textContent).not.toContain("super-secret-value");
  });

  it("reports through onError and normalizes a non-Error throw", () => {
    const onError = vi.fn();

    function ThrowString(): React.ReactNode {
      throw "thrown as a string";
    }
    function ThrowObject(): React.ReactNode {
      throw { code: 500 };
    }

    render(
      <MediaErrorBoundary onError={onError}>
        <ThrowString />
      </MediaErrorBoundary>
    );
    render(
      <MediaErrorBoundary onError={onError}>
        <ThrowObject />
      </MediaErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(2);
    const [stringError, stringInfo] = onError.mock.calls[0] as [
      Error,
      { componentStack: string }
    ];
    const [objectError] = onError.mock.calls[1] as [Error];
    expect(stringError).toBeInstanceOf(Error);
    expect(stringError.message).toBe("thrown as a string");
    expect(typeof stringInfo.componentStack).toBe("string");
    expect(objectError.message).toBe("The view failed to render.");
  });

  it("accepts host label overrides and keeps unspecified defaults", () => {
    const container = render(
      <MediaErrorBoundary labels={{ title: "Biblioteca no disponible", retry: "Reintentar" }}>
        <Boom throws />
      </MediaErrorBoundary>
    );

    expect(container.textContent).toContain("Biblioteca no disponible");
    expect(container.textContent).toContain("Reintentar");
    expect(container.textContent).toContain(
      "The page hit an unexpected error and could not finish rendering."
    );
  });

  it("renders a custom fallback with the error and a working reset", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <MediaErrorBoundary
          fallback={({ error, reset }) => (
            <button
              type="button"
              onClick={() => {
                setThrows(false);
                reset();
              }}
            >
              custom: {error.message}
            </button>
          )}
        >
          <Boom throws={throws} message="custom path" />
        </MediaErrorBoundary>
      );
    }

    const container = render(<Harness />);
    expect(container.textContent).toContain("custom: custom path");

    click(container, "custom: custom path");
    expect(container.textContent).toContain("healthy child");
  });

  it("recovers through the default retry button", () => {
    function Harness() {
      const [throws, setThrows] = React.useState(true);
      return (
        <>
          <button type="button" onClick={() => setThrows(false)}>
            fix the child
          </button>
          <MediaErrorBoundary>
            <Boom throws={throws} />
          </MediaErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    click(container, "fix the child");
    click(container, "Reload this view");
    expect(container.textContent).toContain("healthy child");
  });

  it("clears on a resetKeys change and holds while the keys are equal", () => {
    function Harness() {
      const [objectId, setObjectId] = React.useState("o1");
      return (
        <>
          <button type="button" onClick={() => setObjectId("o2")}>
            switch object
          </button>
          <button type="button" onClick={() => setObjectId("o1")}>
            same object
          </button>
          <MediaErrorBoundary resetKeys={[objectId]}>
            <Boom throws={objectId === "o1"} />
          </MediaErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    expect(container.textContent).toContain("This view stopped responding");

    click(container, "same object");
    expect(container.textContent).toContain("This view stopped responding");

    click(container, "switch object");
    expect(container.textContent).toContain("healthy child");
  });

  it("holds the fallback across a re-render when no resetKeys are given", () => {
    function Harness() {
      const [tick, setTick] = React.useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick(tick + 1)}>
            re-render
          </button>
          <MediaErrorBoundary>
            <Boom throws />
          </MediaErrorBoundary>
        </>
      );
    }

    const container = render(<Harness />);
    click(container, "re-render");
    expect(container.textContent).toContain("This view stopped responding");
  });
});
