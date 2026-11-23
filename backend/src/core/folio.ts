// Folios definitivos por sucursal (Docs/09 §5): "C-000123", o "000123" sin prefijo.
// Los usan pedidos (ORDER) y recibos (BILL); viven en core para no cruzar módulos.
import type { Prisma } from '../generated/prisma/client.js';

export async function nextFolio(
  tx: Prisma.TransactionClient,
  branchId: string,
  docType: 'ORDER' | 'BILL',
): Promise<string> {
  const [row] = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO folio_sequences (branch_id, doc_type, last_value)
    VALUES (${branchId}::uuid, ${docType}, 1)
    ON CONFLICT (branch_id, doc_type)
    DO UPDATE SET last_value = folio_sequences.last_value + 1
    RETURNING last_value`;
  const branch = await tx.branch.findUniqueOrThrow({
    where: { id: branchId },
    select: { folioPrefix: true },
  });
  const number = String(row!.last_value).padStart(6, '0');
  return branch.folioPrefix ? `${branch.folioPrefix}-${number}` : number;
}
