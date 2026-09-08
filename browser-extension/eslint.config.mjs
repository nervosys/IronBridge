import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

// The extension is plain JavaScript loaded directly by the browser -- there is
// no bundler and no TypeScript step -- so ESLint is the only static check that
// runs over this package. Keep it strict enough to catch the mistakes that
// class of code is prone to: typos in identifiers, unreachable branches, and
// accidental globals.
export default defineConfig([
  globalIgnores(['node_modules', 'dist', 'build']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      // An unused argument is usually a signature being kept deliberately
      // (message listeners, event handlers); an unused *variable* is not.
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    // The background script runs as an MV3 service worker, not in a page.
    files: ['background/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.webextensions,
      },
    },
  },
])
