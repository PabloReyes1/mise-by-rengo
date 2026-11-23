// Configuración de pm2 para todos los clientes (Docs/13-operacion.md §2.3).
// Se instala una sola vez en /opt/mise/ecosystem.config.cjs.
// No se edita al dar de alta un cliente: arma la lista de apps leyendo
// /opt/mise/clients/registry.csv (una app por cliente que no esté dado de baja).
//
// Uso:
//   pm2 start /opt/mise/ecosystem.config.cjs --only mise-lafonda   (un cliente)
//   pm2 start /opt/mise/ecosystem.config.cjs                       (todos)
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MISE_ROOT = process.env.MISE_ROOT || '/opt/mise';
const REGISTRY = path.join(MISE_ROOT, 'clients', 'registry.csv');

// Estados con proceso corriendo. SUSPENDIDO también corre: la API responde 402 (Docs/13 §3).
const ESTADOS_CON_PROCESO = new Set(['ALTA', 'ACTIVO', 'SUSPENDIDO']);

/** Lee registry.csv: nombre,puerto,dominio,base,estado,plan,modulos,fecha_alta */
function leerClientes() {
  if (!fs.existsSync(REGISTRY)) return [];
  const [encabezado, ...filas] = fs.readFileSync(REGISTRY, 'utf8').trim().split('\n');
  const columnas = encabezado.split(',');
  return filas
    .filter((fila) => fila.trim() !== '')
    .map((fila) => {
      const valores = fila.split(',');
      return Object.fromEntries(columnas.map((c, i) => [c.trim(), (valores[i] || '').trim()]));
    });
}

function app(cliente) {
  const dir = path.join(MISE_ROOT, 'clients', cliente.nombre);
  return {
    name: `mise-${cliente.nombre.toLowerCase()}`,
    script: path.join(MISE_ROOT, 'app', 'backend', 'dist', 'server.js'),
    // El backend lee .env desde process.cwd() (Docs/06 §3.2)
    cwd: dir,
    exec_mode: 'fork',
    instances: 1,
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=256',
    // Cierre ordenado: deja de aceptar, termina peticiones, cierra sockets y Prisma
    kill_timeout: 10000,
    exp_backoff_restart_delay: 200,
    out_file: path.join(dir, 'logs', 'out.log'),
    error_file: path.join(dir, 'logs', 'error.log'),
    merge_logs: true,
    time: true,
    env: { NODE_ENV: 'production' },
  };
}

module.exports = {
  apps: leerClientes()
    .filter((c) => ESTADOS_CON_PROCESO.has(c.estado))
    .map(app),
};
