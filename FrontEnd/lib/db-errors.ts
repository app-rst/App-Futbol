import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Las funciones de Postgres levantan errores con mensajes ya pensados para el
 * usuario (en castellano) usando estos códigos. El resto se muestra genérico.
 */
const USER_FACING_CODES = new Set(["P0001", "P0002", "42501"]);

export function dbErrorMessage(error: PostgrestError | null | undefined, fallback = "Ocurrió un error. Volvé a intentar."): string {
  if (!error) return fallback;
  if (USER_FACING_CODES.has(error.code) && error.message && !error.message.startsWith("permission denied")) {
    return error.message;
  }
  console.error("db error", error);
  return fallback;
}

/** ¿Es un "no existe"? (para responder 404 en vez de un error). */
export function isNotFound(error: PostgrestError | null | undefined): boolean {
  return error?.code === "P0002";
}
