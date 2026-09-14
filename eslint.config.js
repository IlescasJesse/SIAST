import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// Config plana única para el monorepo — cubre los 6 workspaces sin duplicar
// reglas por paquete. Sin linting type-aware (mantiene el lint rápido); el
// tipado real ya lo cubre `tsc --noEmit` en apps/api.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.vite/**",
      "packages/database/prisma/migrations/**",
      "packages/database/generated/**",
      // Tooling de Claude Code (hooks/workflows), no es parte del código de SIAST.
      ".claude/**",
    ],
  },

  js.configs.recommended,

  // Scripts sueltos de Node (kill-ports.js, scripts de packages/database) —
  // no forman parte de ningún workspace TS/React, pero corren con `node`.
  {
    files: ["scripts/**/*.{js,mjs}", "packages/*/scripts/**/*.{js,mjs}", "apps/*/vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },

  // apps/api, packages/shared, packages/ui, packages/database — TypeScript
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [
      "apps/api/**/*.ts",
      "packages/*/src/**/*.{ts,tsx}",
      "packages/*/prisma/**/*.ts",
      "packages/*/scripts/**/*.ts",
    ],
  })),
  {
    files: [
      "apps/api/**/*.ts",
      "packages/*/src/**/*.{ts,tsx}",
      "packages/*/prisma/**/*.ts",
      "packages/*/scripts/**/*.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      // Deuda técnica conocida (JWT payloads, tipos de terceros sin @types) —
      // se deja como warning en vez de bloquear el lint; no se tipa a ciegas.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // apps/web — React
  {
    files: ["apps/web/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Vite + React 18 nuevo JSX transform
      "react/prop-types": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // apps/modelado-3d — JS plano en navegador (Three.js)
  {
    files: ["apps/modelado-3d/src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
