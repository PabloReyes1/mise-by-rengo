// Nombre de una ocupación para títulos: "Mesa 5 + 6" o "Para llevar: Luis".
import type { FloorTable, Occupancy } from '@mise/shared/contracts/floor';

export function occupancyTitle(occ: Occupancy, tables: FloorTable[]): string {
  const table = tables.find((t) => t.id === occ.tableId);
  if (table) return `Mesa ${[table.name, ...occ.mergedTables.map((t) => t.name)].join(' + ')}`;
  return `Para llevar${occ.customerName ? `: ${occ.customerName}` : ''}`;
}
