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
  }
)
