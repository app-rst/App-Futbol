/**
 * Costo por jugador = costo de la cancha ÷ cantidad de titulares, redondeado
 * hacia arriba al peso para que la cancha quede cubierta. Solo se muestra.
 */
export function costPerPlayer(fieldCost: number, starters: number): number | null {
  if (!Number.isFinite(fieldCost) || fieldCost < 0) return null;
  if (!Number.isInteger(starters) || starters <= 0) return null;
  // En centavos para evitar errores de punto flotante (ej. 0.1 + 0.2).
  const cents = Math.round(fieldCost * 100);
  return Math.ceil(cents / (starters * 100));
}

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 25000 → "$ 25.000" */
export function formatARS(amount: number): string {
  return ars.format(amount);
}

/** Interpreta montos escritos a la argentina: "50.000", "50000", "1.234,50". */
export function parseARS(input: string): number | null {
  const s = input.replace(/[$\s]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}
