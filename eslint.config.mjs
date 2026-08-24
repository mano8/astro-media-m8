import eslint from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";
import security from "eslint-plugin-security";

// Registry skins are linted with the runtime: they are published source, and
// scoping ESLint to `src/**` left them unread by any gate (`C12`).
const sourceFiles = ["src/**/*.{ts,tsx}", "registry/blocks/**/*.{ts,tsx}"];

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "registry/r/**",
      "fixtures/**",
      ".tmp/**"
    ]
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs["flat/recommended"],
  {
    files: sourceFiles,
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: sourceFiles,
    ...security.configs.recommended,
    rules: {
      ...security.configs.recommended.rules,
      // This generic heuristic does not model a `Math.min`-clamped array index
      // or a Zod-enum-constrained lookup key, both of which the skins use;
      // security rules remain enabled otherwise (mirrors astro-auth-m8's
      // eslint.config.mjs, which carries the same exception for its own
      // bounded-index patterns).
      "security/detect-object-injection": "off"
    }
  },
  {
    // Build and gate scripts are Node ESM. Without their own globals block the
    // shared `recommended` rules report every `console`/`process`/`URL` as
    // undefined, which is what kept `eslint .` from being runnable here (`C12`).
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    }
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ["src/**/*.tsx", "registry/blocks/**/*.tsx"],
    ...eslintReact.configs.recommended,
    rules: {
      ...eslintReact.configs.recommended.rules,
      // The published plugin supports React 18 as well as React 19.
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-use-context": "off",
      // Async auth resolution must update context state after the adapter settles.
      "@eslint-react/set-state-in-effect": "off"
    }
  }
];
