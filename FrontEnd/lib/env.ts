function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return value;
}

// Acceso estático a process.env para que Next las incluya en el bundle del cliente.
export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
