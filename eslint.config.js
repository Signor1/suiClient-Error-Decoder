import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jest from "eslint-plugin-jest";

export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["dist/**", "coverage/**", "*.d.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null, // Set to './tsconfig.json' if using project-based rules
        sourceType: "module",
        ecmaVersion: 2020,
      },
      globals: {
        ...js.configs.recommended.languageOptions?.globals,
      },
    },
    plugins: {
      "@typescript-eslint": ts,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": "warn",
    },
  },
  // Jest-specific configuration for test files
  {
    files: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null,
        sourceType: "module",
        ecmaVersion: 2020,
      },
      globals: {
        ...js.configs.recommended.languageOptions?.globals,
        // Jest globals
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        beforeAll: "readonly",
        afterEach: "readonly",
        afterAll: "readonly",
        jest: "readonly",
        // Node.js globals for test environment
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      jest,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,
      ...jest.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": "warn",
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
    },
  },
];
