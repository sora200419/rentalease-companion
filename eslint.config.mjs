import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Type-aware pass: catches uncaught promises. The codebase has had at least
  // one mock-drift bug from this class (see commit 455e5b5 — invitation-edit
  // test mock returned undefined instead of Promise) and many fire-and-forget
  // sites that call .catch(console.error). Surfacing as a warning here lets
  // editors flag them without breaking the build until the existing sites are
  // cleaned up; flip to "error" once the backlog is zero.
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude accidental local Codex artifact trees from project linting.
    "~/**",
    // Exclude non-production files (docs, plans, specs, tests, build artifacts).
    "deployment/**",
  ]),
]);

export default eslintConfig;
