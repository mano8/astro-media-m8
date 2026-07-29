import eslint from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";
import security from "eslint-plugin-security";

const sourceFiles = ["src/**/*.{ts,tsx}"];

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "registry/r/**",
      "fixtures/**"
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
    ...security.configs.recommended
  },
  {
    files: ["src/**/*.tsx"],
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
