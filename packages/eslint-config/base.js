// Shared ESLint base for non-Next workspaces (packages/*, apps/api).
// apps/web keeps its own Next.js eslint config (next/core-web-vitals).
// This is intentionally minimal for the restructure brief; tighten later.
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  env: { node: true, es2022: true },
  ignorePatterns: ["dist/**", "node_modules/**"],
  rules: {},
};
