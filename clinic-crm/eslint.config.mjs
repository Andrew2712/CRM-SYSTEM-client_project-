import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // ── Ignore generated / build output — never lint these ───────────────────
  // .next/ is webpack-compiled output; linting it produces false positives
  // (e.g. no-assign-module-variable) that are not fixable in source.
  // node_modules is excluded by ESLint by default but listed here explicitly.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
    ],
  },

  ...compat.extends("next/core-web-vitals"),

  {
    rules: {
      // Apostrophes and quotes in JSX text — off globally.
      "react/no-unescaped-entities": "off",

      // Missing useEffect / useMemo deps — warn, not error.
      "react-hooks/exhaustive-deps": "warn",

      // require() calls in test files are intentional (ts-jest / dynamic
      // imports). Downgrade from error → off so the inline eslint-disable
      // comments in __tests__ are not needed, and the "rule not found"
      // error goes away for projects that don't have @typescript-eslint
      // installed as a direct dependency.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
