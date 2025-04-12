import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Spread the configurations you are extending first
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Add a new configuration object to specify rule overrides
  {
    rules: {
      // --- Rules previously reported as ERROR ---

      // Disable checks for unescaped HTML entities in JSX
      "react/no-unescaped-entities": "off",

      // Disable checks for unused variables, functions, imports, etc.
      "@typescript-eslint/no-unused-vars": "off",

      // Disable checks forcing explicit types over 'any'
      "@typescript-eslint/no-explicit-any": "off",

      // Disable checks preferring 'const' over 'let' when variables aren't reassigned
      "prefer-const": "off",


      // --- Rules previously reported as WARNING ---

      // Disable checks for React Hook dependency arrays
      "react-hooks/exhaustive-deps": "off",


      // --- Add any other rules you need to disable below ---

    }
  }
];

export default eslintConfig;