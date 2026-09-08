module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        // Object literal properties are exempt from the camelCase requirement:
        // this extension builds objects that ARE external wire formats -- HTTP
        // header bags ('Content-Type', 'Authorization') and the on-disk session
        // JSON ('session_id', 'created_at', 'agent_name'). Those keys are fixed
        // by the format, so renaming them to satisfy the linter would break
        // interoperability. Every other identifier still has to be camelCase.
        // These three entries are the rule's own defaults, restated because
        // listing options replaces them wholesale rather than merging. The
        // leading/trailing underscore allowances matter: private members are
        // written `_watcher`, `_getNonce` throughout this extension.
        '@typescript-eslint/naming-convention': [
            'warn',
            {
                selector: 'default',
                format: ['camelCase'],
                leadingUnderscore: 'allow',
                trailingUnderscore: 'allow',
            },
            { selector: 'import', format: ['camelCase', 'PascalCase'] },
            {
                selector: 'variable',
                format: ['camelCase', 'UPPER_CASE'],
                leadingUnderscore: 'allow',
                trailingUnderscore: 'allow',
            },
            { selector: 'typeLike', format: ['PascalCase'] },
            // The exemption this config exists for.
            { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
        ],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
        '@typescript-eslint/semi': 'warn',
        'curly': 'warn',
        'eqeqeq': 'warn',
        'no-throw-literal': 'warn',
        'semi': 'off',
    },
};
