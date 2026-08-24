import * as React from "react";

/**
 * Island-root error boundary for the media plugin (`A-C3`).
 *
 * Every media view is mounted as an Astro island. A render throw anywhere
 * inside one unmounts the entire island tree, so the route is left with a blank
 * region and a console trace — the same failure the plugin already handles
 * gracefully when a *request* fails, and handled not at all when a *render*
 * fails. This boundary closes that gap.
 *
 * A class on purpose: `getDerivedStateFromError`/`componentDidCatch` still have
 * no hook equivalent.
 *
 * The prop contract mirrors `@mano8/astro-ui-m8`'s canonical `error-boundary`
 * registry block deliberately, so the two can be collapsed onto one
 * implementation once that block is reachable from this package. It is not
 * reachable today: the block ships in an unpublished `astro-ui-m8`, and copied
 * registry items are consumer-side artifacts rather than package runtime.
 */
export interface MediaErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export interface MediaErrorBoundaryLabels {
  title: string;
  description: string;
  retry: string;
}

const DEFAULT_LABELS: MediaErrorBoundaryLabels = {
  title: "This view stopped responding",
  description: "The page hit an unexpected error and could not finish rendering.",
  retry: "Reload this view"
};

export interface MediaErrorBoundaryProps {
  children: React.ReactNode;
  /** Replaces the default surface. Receives the error and a `reset`. */
  fallback?: (props: MediaErrorBoundaryFallbackProps) => React.ReactNode;
  /** Reporting hook. The boundary never logs on its own. */
  onError?: (error: Error, info: { componentStack: string }) => void;
  /** Clears the boundary when any member changes, compared by `Object.is`. */
  resetKeys?: readonly unknown[];
  labels?: Partial<MediaErrorBoundaryLabels>;
}

interface MediaErrorBoundaryState {
  error: Error | null;
}

/** `throw "boom"` is legal, so normalize before handing anything on. */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  if (typeof thrown === "string") return new Error(thrown);
  return new Error("The view failed to render.");
}

function resetKeysChanged(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined
): boolean {
  if (previous === undefined || next === undefined) return false;
  if (previous.length !== next.length) return true;
  return previous.some((value, index) => !Object.is(value, next[index]));
}

export class MediaErrorBoundary extends React.Component<
  MediaErrorBoundaryProps,
  MediaErrorBoundaryState
> {
  override state: MediaErrorBoundaryState = { error: null };

  static getDerivedStateFromError(thrown: unknown): MediaErrorBoundaryState {
    return { error: toError(thrown) };
  }

  override componentDidCatch(thrown: unknown, info: React.ErrorInfo): void {
    this.props.onError?.(toError(thrown), {
      componentStack: info.componentStack ?? ""
    });
  }

  override componentDidUpdate(previous: MediaErrorBoundaryProps): void {
    if (this.state.error === null) return;
    if (!resetKeysChanged(previous.resetKeys, this.props.resetKeys)) return;
    this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    const labels = { ...DEFAULT_LABELS, ...this.props.labels };

    // The caught message is deliberately not rendered: a render throw carries
    // whatever the failing code put in it — an object key, a URL, a parse
    // fragment — and this is a user-facing surface. A host that wants the
    // detail reads it from `onError` or passes its own `fallback`.
    return (
      <section className="fa-media-panel" data-media-error-boundary="fallback">
        <h2>{labels.title}</h2>
        <p role="alert">{labels.description}</p>
        <button
          type="button"
          data-media-error-boundary-retry=""
          onClick={this.reset}
        >
          {labels.retry}
        </button>
      </section>
    );
  }
}
