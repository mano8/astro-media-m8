// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { MediaProvider, MediaQueryProvider, useMediaContext } from "../src/runtime/react/index.js";
import { getMediaConfig, resetMediaConfig } from "../src/runtime/config.js";

function flush() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
    rerender: (nextElement: ReactNode) =>
      act(() => {
        root.render(<>{nextElement}</>);
      }),
    unmount: () => act(() => root.unmount())
  };
}

function QueryClientProbe({ expose }: { expose: (client: QueryClient) => void }) {
  const client = useQueryClient();
  expose(client);
  return null;
}

beforeEach(() => {
  resetMediaConfig();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("MediaQueryProvider", () => {
  it("creates one stable query client and supports injected or parent-owned clients", async () => {
    const seenClients: QueryClient[] = [];
    const customClient = new QueryClient();
    const parentClient = new QueryClient();

    function StableProbe() {
      const [, setTick] = React.useState(0);
      const client = useQueryClient();
      seenClients.push(client);
      return <button onClick={() => setTick((value) => value + 1)}>rerender</button>;
    }

    let providedClient: QueryClient | undefined;
    let inheritedClient: QueryClient | undefined;

    const stableView = render(
      <MediaQueryProvider>
        <StableProbe />
      </MediaQueryProvider>
    );
    await flush();
    act(() => {
      stableView.container.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(seenClients).toHaveLength(2);
    expect(seenClients[0]).toBe(seenClients[1]);
    stableView.unmount();

    const customView = render(
      <MediaQueryProvider client={customClient}>
        <QueryClientProbe
          expose={(client) => {
            providedClient = client;
          }}
        />
      </MediaQueryProvider>
    );
    await flush();
    expect(providedClient).toBe(customClient);
    customView.unmount();

    const nestedView = render(
      <QueryClientProvider client={parentClient}>
        <MediaQueryProvider client={customClient}>
          <QueryClientProbe
            expose={(client) => {
              inheritedClient = client;
            }}
          />
        </MediaQueryProvider>
      </QueryClientProvider>
    );
    await flush();
    expect(inheritedClient).toBe(parentClient);
    nestedView.unmount();
  });
});

describe("MediaProvider", () => {
  it("applies runtime config before children render", () => {
    let apiBaseDuringChildRender = "";

    function ConfigProbe() {
      apiBaseDuringChildRender = getMediaConfig().apiBase;
      return null;
    }

    const view = render(
      <MediaProvider config={{ apiBase: "/media-api" }}>
        <ConfigProbe />
      </MediaProvider>
    );

    expect(apiBaseDuringChildRender).toBe("/media-api");
    view.unmount();
  });

  it("exposes synchronous adapter users before effects run", () => {
    let context: ReturnType<typeof useMediaContext> | undefined;
    const user = { is_superuser: true };

    function Probe() {
      context = useMediaContext();
      return <span>{context.loading ? "loading" : String(context.isSuperuser)}</span>;
    }

    const adapter = {
      getAccessToken: () => "token",
      getUser: () => user,
      isSuperuser: (value: unknown) => Boolean((value as { is_superuser?: boolean } | null)?.is_superuser)
    };

    const view = render(
      <MediaQueryProvider>
        <MediaProvider adapter={adapter}>
          <Probe />
        </MediaProvider>
      </MediaQueryProvider>
    );

    expect(context?.loading).toBe(false);
    expect(context?.user).toBe(user);
    expect(context?.isSuperuser).toBe(true);
    expect(view.container.textContent).toBe("true");
    view.unmount();
  });

  it("exposes changed synchronous adapter users during rerender", () => {
    let context: ReturnType<typeof useMediaContext> | undefined;
    let currentUser: { is_superuser?: boolean } | null = null;

    function Probe() {
      context = useMediaContext();
      return <span>{context.loading ? "loading" : String(context.isSuperuser)}</span>;
    }

    const adapter = {
      getAccessToken: () => "token",
      getUser: () => currentUser,
      isSuperuser: (value: unknown) => Boolean((value as { is_superuser?: boolean } | null)?.is_superuser)
    };

    const tree = () => (
      <MediaQueryProvider>
        <MediaProvider adapter={adapter}>
          <Probe />
        </MediaProvider>
      </MediaQueryProvider>
    );
    const view = render(tree());

    expect(context?.loading).toBe(false);
    expect(context?.user).toBeNull();
    expect(context?.isSuperuser).toBe(false);

    currentUser = { is_superuser: true };
    view.rerender(tree());

    expect(context?.loading).toBe(false);
    expect(context?.user).toBe(currentUser);
    expect(context?.isSuperuser).toBe(true);
    expect(view.container.textContent).toBe("true");
    view.unmount();
  });

  it("loads adapter-backed auth state inside the query provider", async () => {
    let context: ReturnType<typeof useMediaContext> | undefined;

    function Probe() {
      context = useMediaContext();
      return <span>{context.loading ? "loading" : String(context.isSuperuser)}</span>;
    }

    const adapter = {
      getAccessToken: () => "token",
      getUser: async () => ({ is_superuser: true }),
      isSuperuser: (user: unknown) => Boolean((user as { is_superuser?: boolean } | null)?.is_superuser)
    };

    const view = render(
      <MediaQueryProvider>
        <MediaProvider adapter={adapter}>
          <Probe />
        </MediaProvider>
      </MediaQueryProvider>
    );

    await flush();
    expect(context?.loading).toBe(false);
    expect(context?.user).toEqual({ is_superuser: true });
    expect(context?.isSuperuser).toBe(true);
    expect(view.container.textContent).toBe("true");
    view.unmount();
  });
});
