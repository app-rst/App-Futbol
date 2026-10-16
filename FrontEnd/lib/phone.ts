/**
 * Normaliza un celular argentino a E.164 (+549 + área + número, 10 dígitos).
 * Acepta las formas habituales: "11 1234-5678", "011 15 1234 5678",
 * "+54 9 11 1234 5678", "351 15 123 4567". Devuelve null si no es válido.
 */
export function normalizeArPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  // Sacar el "15" que va después del código de área (de 2, 3 o 4 dígitos).
  if (d.length === 12) {
    for (const len of [2, 3, 4]) {
      if (d.slice(len, len + 2) === "15") {
        d = d.slice(0, len) + d.slice(len + 2);
        break;
      }
    }
  }
  if (!/^[1-9]\d{9}$/.test(d)) return null;
  return `+549${d}`;
}

/** "+5491112345678" → "+54 9 11 1234-5678". */
export function formatArPhone(e164: string): string {
  const n = e164.replace(/^\+549/, "");
  if (n.length !== 10) return e164;
  // AMBA (11) tiene área de 2 dígitos; para el resto se muestra con 3.
  const area = n.startsWith("11") ? 2 : 3;
  const local = n.slice(area);
  return `+54 9 ${n.slice(0, area)} ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
}

/** Link para abrir un chat de WhatsApp con ese número. */
export function whatsappLink(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}
