import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Apostrophes and quotes in JSX text — disabled globally.
      // Next.js treats these as errors; we suppress them here and fix the
      // source files directly as belt-and-suspenders.
      "react/no-unescaped-entities": "off",

      // Missing useEffect / useMemo deps — leave as warn, not error.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
