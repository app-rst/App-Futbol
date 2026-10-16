import type { AuthError } from "@supabase/supabase-js";

/** Traduce los errores de Supabase Auth a mensajes para el usuario. */
export function authErrorMessage(error: AuthError | null | undefined): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email.";
    case "weak_password":
      return "La contraseña es muy débil. Probá con una más larga.";
    case "same_password":
      return "La nueva contraseña tiene que ser distinta a la anterior.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
    case "user_banned":
      return "Tu cuenta está suspendida. Contactá a un administrador.";
    case "signup_disabled":
      return "El registro está deshabilitado.";
    default:
      return "Ocurrió un error. Volvé a intentar.";
  }
}
