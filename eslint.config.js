import antfu from '@antfu/eslint-config'

export default antfu({
  svelte: true,
  unocss: true,
  rules: {
    'no-console': 'warn',
    'curly': ['warn', 'multi-or-nest', 'consistent'],
    'antfu/curly': 'off',
    'antfu/no-top-level-await': 'off',
    'style/jsx-one-expression-per-line': ['warn', { allow: 'single-line' }],
  },
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/core/**',
  ],
})
