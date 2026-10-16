/**
 * Carga la configuración de un ambiente desde BackEnd/.env.<ambiente>.
 *
 *   dev  → .env.development   (proyecto de Supabase de pruebas)
 *   prod → .env.production    (proyecto que usan tus amigos)
 *
 * Valida que el archivo exista, que tenga las variables obligatorias y que su
 * APP_ENV coincida con el ambiente pedido, para que nunca se use la
 * configuración de un ambiente en otro.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type EnvName = 'development' | 'production';

const ALIASES: Record<string, EnvName> = {
  dev: 'development',
  development: 'development',
  prod: 'production',
  production: 'production',
};

export const LABEL: Record<EnvName, string> = {
  development: 'DESARROLLO',
  production: 'PRODUCCIÓN',
};

const ROOT = join(import.meta.dirname, '..', '..');

export type Env = {
  name: EnvName;
  label: string;
  projectRef: string;
  url: string;
  secretKey: string;
  get: (key: string) => string | undefined;
  require: (key: string) => string;
};

export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function parseEnvName(arg: string | undefined): EnvName {
  const name = arg ? ALIASES[arg.toLowerCase()] : undefined;
  if (!name) fail(`Indicá el ambiente: dev o prod (recibí "${arg ?? ''}").`);
  return name;
}

/**
 * Ambiente pedido por argumento o, si no se pasa, el único .env.<ambiente>
 * que exista (hoy la app usa un solo proyecto de Supabase).
 */
export function resolveEnvName(arg: string | undefined): EnvName {
  if (arg) return parseEnvName(arg);
  const present = (['development', 'production'] as const).filter((n) => existsSync(join(ROOT, `.env.${n}`)));
  if (present.length === 1) return present[0];
  if (present.length === 0) fail('No hay ningún BackEnd/.env.development ni .env.production (ver .env.example).');
  fail('Hay más de un ambiente configurado: indicá dev o prod (por ejemplo: npm run seed -- dev).');
}

export function loadEnv(name: EnvName): Env {
  const file = join(ROOT, `.env.${name}`);
  if (!existsSync(file)) {
    fail(
      `No existe BackEnd/.env.${name}. Copiá .env.example como .env.${name} y completalo` +
        (name === 'production' ? ' con los datos del proyecto de producción.' : '.'),
    );
  }
  process.loadEnvFile(file);

  const get = (key: string) => process.env[key]?.trim() || undefined;
  const require = (key: string) => get(key) ?? fail(`Falta ${key} en BackEnd/.env.${name} (ver .env.example).`);

  const appEnv = require('APP_ENV');
  if (appEnv !== name) {
    fail(`BackEnd/.env.${name} dice APP_ENV=${appEnv}. Tiene que decir APP_ENV=${name}.`);
  }

  const projectRef = require('SUPABASE_PROJECT_REF');
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    fail(`SUPABASE_PROJECT_REF no parece un ref válido de Supabase (20 letras/números) en BackEnd/.env.${name}.`);
  }
  const url = require('SUPABASE_URL');
  if (!url.includes(projectRef)) {
    fail(`SUPABASE_URL y SUPABASE_PROJECT_REF no coinciden en BackEnd/.env.${name}.`);
  }
  const secretKey = require('SUPABASE_SECRET_KEY');
  if (secretKey.startsWith('sb_publishable_')) {
    fail('SUPABASE_SECRET_KEY tiene la publishable key. Usá la secret key (sb_secret_...).');
  }

  return { name, label: LABEL[name], projectRef, url, secretKey, get, require };
}

/** Pide escribir una palabra para confirmar (operaciones en producción). */
export async function confirmTyped(word: string, prompt: string): Promise<void> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${prompt}\nEscribí ${word} para continuar: `)).trim();
  rl.close();
  if (answer !== word) fail('Cancelado.');
}
