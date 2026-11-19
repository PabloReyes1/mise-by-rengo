// Lint de todo el repositorio (Docs/19-estructura-del-proyecto.md §6).
// Las reglas de importación entre módulos las revisa dependency-cruiser (§8), no ESLint.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Un color hex (#abc, #aabbcc, #aabbccdd) dentro de un texto
const HEX_COLOR = '/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])/';
const HEX_MESSAGE =
  'Sin colores hex en los módulos: usa los tokens de frontend/src/styles (Docs/18-sistema-de-diseno.md).';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'Docs/**',
      '.claude/**',
      'backend/prisma/migrations/**',
      'backend/src/generated/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Archivos de configuración de la raíz que no pertenecen a ningún paquete
          allowDefaultProject: ['*.js', '*.cjs', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Archivos JavaScript de configuración: sin reglas que necesitan tipos
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    files: ['backend/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  // Pruebas: res.json() y los datos de prueba son `any`; el código de producción sigue estricto
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Doc 18: los colores solo se usan por token, nunca hex sueltos
  {
    files: ['frontend/src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${HEX_COLOR}]`, message: HEX_MESSAGE },
        { selector: `TemplateElement[value.raw=${HEX_COLOR}]`, message: HEX_MESSAGE },
      ],
    },
  },

  // Va al final: apaga las reglas de estilo que ya resuelve Prettier
  prettier,
);
