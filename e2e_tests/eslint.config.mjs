import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import typescriptParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import playwright from 'eslint-plugin-playwright';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier';
import perfectionist from 'eslint-plugin-perfectionist';

const ignoreList = ['**/*.js'];

export default defineConfig([
  // ---------------------------------------------------------------------------
  // Global Ignores
  // ---------------------------------------------------------------------------
  {
    ignores: ignoreList,
  },

  // ---------------------------------------------------------------------------
  // Base Configurations (JS, TS, Stylistic)
  // ---------------------------------------------------------------------------
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // ---------------------------------------------------------------------------
  // Playwright Configuration
  // ---------------------------------------------------------------------------
  {
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/consistent-spacing-between-blocks': 'error',
      'playwright/expect-expect': 'off',
      'playwright/no-commented-out-tests': 'error',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-duplicate-hooks': 'error',
      'playwright/no-standalone-expect': 'off',
      'playwright/no-unused-locators': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-locator': 'error',
      'playwright/prefer-to-have-count': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/valid-test-tags': 'off',
    },
    settings: {
      playwright: {
        globalAliases: {
          test: ['pmmTest', 'data'],
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Main Configuration (Core, Plugins & Logic)
  // ---------------------------------------------------------------------------
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.builtin,
      parser: typescriptParser,
      sourceType: 'module',
    },
    plugins: {
      '@eslint-community/eslint-comments': eslintComments,
      '@stylistic': stylistic,
      perfectionist,
      prettier: prettierPlugin,
      unicorn,
    },
    rules: {
      // -----------------------------------------------------------------------
      // Plugin: ESLint Comments
      // -----------------------------------------------------------------------
      '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
      '@eslint-community/eslint-comments/no-use': [
        'error',
        { allow: ['eslint-disable-next-line', 'eslint-disable', 'eslint-enable'] },
      ],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: ['eslint-enable'] }],
      // -----------------------------------------------------------------------
      // Plugin: Stylistic
      // -----------------------------------------------------------------------
      '@stylistic/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/function-paren-newline': 'off',
      '@stylistic/line-comment-position': ['error'],
      '@stylistic/linebreak-style': 'off',
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'never', next: 'let', prev: 'let' },
        { blankLine: 'never', next: 'let', prev: 'const' },
        { blankLine: 'never', next: 'const', prev: 'let' },
        { blankLine: 'never', next: 'const', prev: 'const' },
        { blankLine: 'always', next: 'return', prev: '*' },
        { blankLine: 'always', next: 'block', prev: '*' },
        { blankLine: 'always', next: '*', prev: 'block' },
        { blankLine: 'always', next: '*', prev: 'block-like' },
        { blankLine: 'always', next: 'block-like', prev: '*' },
        { blankLine: 'never', next: 'if', prev: 'if' },
        { blankLine: 'never', next: 'case', prev: 'case' },
        { blankLine: 'never', next: 'default', prev: 'case' },
        { blankLine: 'never', next: 'break', prev: '*' },
        { blankLine: 'always', next: 'expression', prev: '*' },
        { blankLine: 'always', next: '*', prev: 'expression' },
        { blankLine: 'any', next: 'expression', prev: 'expression' },
        { blankLine: 'never', next: 'break', prev: 'expression' },
      ],
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', asyncArrow: 'always', named: 'never' },
      ],
      // -----------------------------------------------------------------------
      // Plugin: TypeScript ESLint
      // -----------------------------------------------------------------------
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: ['signature', 'field', 'constructor', 'method', 'private-method'],
          },
        },
      ],
      '@typescript-eslint/no-empty-function': 'error',
      // -----------------------------------------------------------------------
      // Core ESLint Rules (Native Rules)
      // -----------------------------------------------------------------------
      'arrow-body-style': ['error', 'as-needed'],
      curly: ['error', 'multi-line'],
      'func-style': ['error', 'expression'],
      'no-restricted-syntax': [
        'error',
        {
          message: "If statements with an 'else' block must use curly braces for the 'if' part.",
          selector: 'IfStatement[alternate] > :not(BlockStatement).consequent',
        },
        {
          message: 'Else blocks must use curly braces.',
          selector: 'IfStatement[alternate] > :not(BlockStatement):not(IfStatement).alternate',
        },
        {
          message: 'Use arrow functions instead of function declarations.',
          selector: 'FunctionDeclaration',
        },
        {
          message: 'Use arrow functions instead of function expressions.',
          selector: "FunctionExpression:not([parent.type='MethodDefinition'])",
        },
        {
          message: 'Use arrow functions for class members instead of traditional methods.',
          selector: "MethodDefinition[kind!='constructor']",
        },
      ],
      // -----------------------------------------------------------------------
      // Plugin: Perfectionist (Sorting)
      // -----------------------------------------------------------------------
      'perfectionist/sort-classes': [
        'error',
        {
          customGroups: [
            {
              elementNamePattern: 'url',
              groupName: 'url-property',
            },
          ],
          groups: [
            'index-signature',
            'url-property',
            { newlinesBetween: 0 },
            {
              group: 'readonly-property',
              newlinesInside: 0,
            },
            { newlinesBetween: 0 },
            {
              group: 'property',
              newlinesInside: 0,
            },
            { newlinesBetween: 1 },
            'constructor',
            { newlinesBetween: 1 },
            'readonly-function-property',
            { newlinesBetween: 1 },
            {
              group: 'function-property',
              newlinesInside: 1,
            },
            'method',
            { newlinesBetween: 1 },
            {
              group: ['private-function-property', 'private-method'],
              newlinesInside: 1,
            },
            'unknown',
          ],
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-objects': [
        'error',
        {
          newlinesBetween: 0,
          order: 'asc',
          partitionByNewLine: false,
          styledComponents: false,
          type: 'natural',
        },
      ],
      'prefer-arrow-callback': 'error',
      // -----------------------------------------------------------------------
      // Plugin: Prettier
      // -----------------------------------------------------------------------
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],
      // -----------------------------------------------------------------------
      // Plugin: Unicorn
      // -----------------------------------------------------------------------
      'unicorn/filename-case': ['error', { case: 'camelCase' }],
      'unicorn/no-array-reverse': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/no-unnecessary-await': 'error',
      'unicorn/numeric-separators-style': [
        'error',
        {
          number: { groupLength: 3, minimumDigits: 0 },
          onlyIfContainsSeparator: false,
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Page Objects Overrides
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.page.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          message: 'All pages must extend BasePage.',
          selector: 'ClassDeclaration[id.name!="BasePage"]:not([superClass.name="BasePage"])',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Test Files Overrides
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.test.ts'],
    rules: {
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionPatterns: ['^assert.*', '^verify.*'],
        },
      ],
      'playwright/no-skipped-test': 'error',
      'playwright/no-standalone-expect': 'error',
    },
  },
]);
