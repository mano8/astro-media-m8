import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const FIXTURE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(FIXTURE_ROOT, "..", "..");

// The gallery imports the plugin's own `src/**` directly rather than `dist/**`,
// so `preview:dev` reflects an edit without a rebuild. Vite resolves the
// NodeNext `.js` specifiers in that source to their `.ts` files.
export default defineConfig({
  appType: "spa",
  root: FIXTURE_ROOT,
  server: {
    port: 4175,
    fs: { allow: [REPO_ROOT] }
  },
  preview: { port: 4175 }
});
