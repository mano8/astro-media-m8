// Augments ImportMeta for Vite/Astro consumers where import.meta.env is injected at build time.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
