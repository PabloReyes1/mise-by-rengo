// Reglas de importación entre módulos (Docs/19-estructura-del-proyecto.md §8).
// Se revisan con `pnpm check:boundaries` y el CI falla si alguna se rompe.
// Para una excepción: primero se documenta en Docs/19 §8 con su motivo; no se desactiva aquí sin eso.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'backend-solo-index-de-otro-modulo',
      comment:
        'Un módulo del backend no importa archivos internos de otro módulo; solo lo que exporta su index.ts (Docs/19 §3).',
      severity: 'error',
      from: { path: '^backend/src/modules/([^/]+)/' },
      to: {
        path: '^backend/src/modules/[^/]+/',
        pathNot: ['^backend/src/modules/$1/', '^backend/src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'frontend-modulos-independientes',
      comment:
        'Un módulo del frontend no importa nada de otro módulo; lo común se sube a core/ (Docs/19 §4).',
      severity: 'error',
      from: { path: '^frontend/src/modules/([^/]+)/' },
      to: {
        path: '^frontend/src/modules/[^/]+/',
        pathNot: '^frontend/src/modules/$1/',
      },
    },
    {
      name: 'shared-no-importa-backend-ni-frontend',
      comment: 'shared/ no importa nada de backend/ ni de frontend/ (Docs/19 §5).',
      severity: 'error',
      from: { path: '^shared/' },
      to: { path: '^(backend|frontend)/' },
    },
    {
      name: 'backend-no-importa-frontend',
      comment:
        'backend/ y frontend/ no se importan entre sí; lo que comparten va en shared/ (Docs/19 §1).',
      severity: 'error',
      from: { path: '^backend/' },
      to: { path: '^frontend/' },
    },
    {
      name: 'frontend-no-importa-backend',
      comment:
        'backend/ y frontend/ no se importan entre sí; lo que comparten va en shared/ (Docs/19 §1).',
      severity: 'error',
      from: { path: '^frontend/' },
      to: { path: '^backend/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|coverage)/' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
