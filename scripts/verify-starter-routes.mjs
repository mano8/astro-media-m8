import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "fixtures", "astro-starter");
const scopeDir = join(fixture, "node_modules", "@mano8");
const packageLink = join(scopeDir, "astro-media-m8");
const astroBin = join(root, "node_modules", "astro", "bin", "astro.mjs");
const distDir = join(fixture, "dist");
const expectedRoutes = [
  "media/index.html",
  "media/upload/index.html",
  "media/presets/index.html",
  "admin/media/index.html"
];

mkdirSync(scopeDir, { recursive: true });
if (existsSync(packageLink)) {
  rmSync(packageLink, { force: true, recursive: true });
}
rmSync(distDir, { force: true, recursive: true });
symlinkSync(root, packageLink, "junction");

try {
  const result = spawnSync(process.execPath, [astroBin, "build", "--root", fixture], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  for (const routePath of expectedRoutes) {
    const outputPath = join(distDir, routePath);
    if (!existsSync(outputPath)) {
      throw new Error(`Expected built route missing: ${routePath}`);
    }

    const html = readFileSync(outputPath, "utf8");
    if (!html.includes("<astro-island")) {
      throw new Error(`Built route did not render the expected Astro island markup: ${routePath}`);
    }
  }
} finally {
  rmSync(packageLink, { force: true, recursive: true });
}
