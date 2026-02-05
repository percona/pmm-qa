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

const ignoreList = ['launchable-prepare.js'];

export default defineConfig([
  // Global ignores
  {
    ignores: ignoreList,
  },

  // Base JS + TS recommended
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // Playwright recommended + extra rules
  {
    ...playwright.configs['flat/recommended'],
    settings: {
      playwright: {
        globalAliases: {
          test: ['pmmTest', 'data'],
        },
      },
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-commented-out-tests': 'error',
      'playwright/no-duplicate-hooks': 'error',
      'playwright/prefer-locator': 'error',
      'playwright/no-standalone-expect': 'off',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-to-have-count': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/valid-test-tags': 'off',
      'playwright/consistent-spacing-between-blocks': 'error',
      'playwright/no-unused-locators': 'error',
    },
  },

  // Language + stylistic preferences
  {
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.builtin,
    },
    plugins: {
      '@stylistic': stylistic,
      '@eslint-community/eslint-comments': eslintComments,
      unicorn,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript quality
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: ['signature', 'field', 'constructor', 'method', 'private-method'],
          },
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],

      // Stylistic
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/linebreak-style': 'off',
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/function-paren-newline': 'off',
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/array-bracket-newline': ['error', { multiline: true }],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', named: 'never', asyncArrow: 'always' },
      ],
      '@stylistic/lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: 'method', next: '*' },
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'never', prev: 'field', next: 'field' },
          ],
        },
      ],
      '@stylistic/line-comment-position': ['error'],

      // Statement padding for readability
      'padding-line-between-statements': [
        'error',
        { blankLine: 'never', prev: 'let', next: 'let' },
        { blankLine: 'never', prev: 'const', next: 'let' },
        { blankLine: 'never', prev: 'let', next: 'const' },
        { blankLine: 'never', prev: 'const', next: 'const' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'never', prev: 'if', next: 'if' },
        { blankLine: 'never', prev: 'case', next: 'case' },
        { blankLine: 'never', prev: 'case', next: 'default' },
        { blankLine: 'never', prev: '*', next: 'break' },
        { blankLine: 'always', prev: '*', next: 'expression' },
        { blankLine: 'always', prev: 'expression', next: '*' },
        { blankLine: 'any', prev: 'expression', next: 'expression' },
        { blankLine: 'never', prev: 'expression', next: 'break' },
      ],
      // Unicorn helpful rules (tuned for TS code)
      'unicorn/filename-case': ['error', { case: 'camelCase' }],
      'unicorn/numeric-separators-style': [
        'error',
        {
          onlyIfContainsSeparator: false,
          number: { minimumDigits: 0, groupLength: 3 },
        },
      ],
      'unicorn/no-array-reverse': 'off',
      'unicorn/no-await-expression-member': 'off',

      // Comments best practices
      '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: ['eslint-enable'] }],
      '@eslint-community/eslint-comments/no-use': [
        'error',
        { allow: ['eslint-disable-next-line', 'eslint-disable', 'eslint-enable'] },
      ],

      // General
      curly: ['error', 'multi-line'],
      'func-style': ['error', 'declaration', { allowArrowFunctions: false }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'IfStatement[alternate] > :not(BlockStatement).consequent',
          message: "If statements with an 'else' block must use curly braces for the 'if' part.",
        },
        {
          selector: 'IfStatement[alternate] > :not(BlockStatement):not(IfStatement).alternate',
          message: 'Else blocks must use curly braces.',
        },
        {
          selector: "PropertyDefinition[value.type='ArrowFunctionExpression']",
          message: 'Use traditional method syntax instead of arrow functions for class members.',
        },
        {
          selector: 'VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
          message: 'Use function declarations instead of arrow functions.',
        },
      ],
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],
    },
  },

  // Rules specific to page files
  {
    files: ['**/*.page.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration[id.name!="BasePage"]:not([superClass.name="BasePage"])',
          message: 'All pages must extend BasePage.',
        },
      ],
    },
  },

  // Rules specific to test files
  {
    files: ['**/*.test.ts'],
    rules: {
      'playwright/no-standalone-expect': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'assertSuccess',
            'verifyMetricsPresent',
            'verifyAllPanelsHaveData',
            'verifyPanelValues',
            'verifyServiceAgentsStatus',
            'verifyQueryAnalyticsHaveData',
            'verifyTotalQueryCount',
          ],
        },
      ],
    },
  },
]);
