// Types for the one `react-dom/client` entry point the gallery mounts through.
//
// Declared here rather than by adding `@types/react-dom` to devDependencies:
// this is a dev-only fixture that ships in no tarball, and the repository's
// dependency graph is an audited surface (`H19`) that should not grow a package
// for a fixture's benefit. `react-dom` itself is already a devDependency, so
// only the types are missing.
declare module "react-dom/client" {
  import type { ReactNode } from "react";

  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}
