import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: ['node_modules/**', 'dist/**', '.next/**', 'scripts/**'],
  },
  {
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Ban the string-interpolated raw SQL helpers — they are an injection
      // footgun. Use the tagged-template $queryRaw / $executeRaw instead.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name=/RawUnsafe$/]",
          message: 'Use the tagged-template prisma.$queryRaw / $executeRaw, not the *RawUnsafe variants.',
        },
      ],
    },
  },
  {
    // Fail CI on any source function with 15 or more branches; split it
    // instead. Tests are left out.
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    ignores: ['tests/**'],
    rules: {
      complexity: ['error', { max: 14 }],
    },
  }
)
