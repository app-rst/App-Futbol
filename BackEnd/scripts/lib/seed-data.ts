import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { confirmTyped, fail, type Env } from './env.ts';

/** Prefijo del lugar de los partidos de prueba (así se reconocen y se borran). */
export const SEED_LOCATION_PREFIX = '[Prueba] ';

export const SEED_EMAIL_DOMAIN = 'dev.fulbito.test';

export function seedEmail(index: number): string {
  return `jugador${String(index + 1).padStart(2, '0')}@${SEED_EMAIL_DOMAIN}`;
}

export const SEED_PLAYERS = [
  { first_name: 'Diego', last_name: 'Prueba', nickname: 'Pelusa' },
  { first_name: 'Juan Román', last_name: 'Prueba', nickname: 'Torre' },
  { first_name: 'Martín', last_name: 'Prueba', nickname: 'Titán' },
  { first_name: 'Gabriel', last_name: 'Prueba', nickname: 'Batigol' },
  { first_name: 'Carlos', last_name: 'Prueba', nickname: 'Apache' },
  { first_name: 'Ariel', last_name: 'Prueba', nickname: 'Burrito' },
  { first_name: 'Juan Sebastián', last_name: 'Prueba', nickname: 'Brujita' },
  { first_name: 'Javier', last_name: 'Prueba', nickname: 'Jefecito' },
  { first_name: 'Ángel', last_name: 'Prueba', nickname: 'Fideo' },
  { first_name: 'Sergio', last_name: 'Prueba', nickname: 'Kun' },
  { first_name: 'Emiliano', last_name: 'Prueba', nickname: 'Dibu' },
  { first_name: 'Rodrigo', last_name: 'Prueba', nickname: 'Motorcito' },
  { first_name: 'Julián', last_name: 'Prueba', nickname: 'Araña' },
  { first_name: 'Alexis', last_name: 'Prueba', nickname: 'Colo' },
  { first_name: 'Enzo', last_name: 'Prueba', nickname: 'Enzito' },
] as const;

/**
 * ¿Se pueden crear/borrar datos de prueba en este ambiente?
 * - Desarrollo: sí, sin preguntar (pero se niega si el proyecto es el mismo
 *   que el de .env.production, por si se copió mal un archivo).
 * - Producción (cuando la app usa un único proyecto): solo escribiendo
 *   PRUEBAS. Los partidos de prueba solo los ven sus participantes, así que
 *   tus amigos no los ven; los usuarios de prueba sí figuran en el panel admin.
 */
export async function assertSeedAllowed(env: Env, action: string): Promise<void> {
  if (env.name === 'development') {
    const prodFile = join(import.meta.dirname, '..', '..', '.env.production');
    if (existsSync(prodFile)) {
      const prodRef = /^SUPABASE_PROJECT_REF=(.+)$/m.exec(readFileSync(prodFile, 'utf8'))?.[1]?.trim();
      if (prodRef && prodRef === env.projectRef) {
        fail('El proyecto de desarrollo es el mismo que el de producción. No toco nada.');
      }
    }
    return;
  }
  await confirmTyped('PRUEBAS', `⚠️  Vas a ${action} en PRODUCCIÓN (la base que usan tus amigos).`);
}
