import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Strict: no explicit any — enforce proper typing
      "@typescript-eslint/no-explicit-any": "error",
      // Strict: unused vars are errors, but allow _ prefix for intentional skips
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Strict: prefer @ts-expect-error over @ts-ignore
      "@typescript-eslint/ban-ts-comment": "error",
      // Strict: no require() imports
      "@typescript-eslint/no-require-imports": "error",
      // Strict: prefer const
      "prefer-const": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
