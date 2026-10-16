import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const AUTH_STUB = join(import.meta.dirname, 'auth-stub.sql');

export type Db = PGlite;
export type Tx = Transaction;

let template: PGlite | undefined;

const migrationFiles = () => readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

/** Aplica, en orden, las migraciones cuyo nombre cumple `filter`. */
export async function applyMigrations(db: Db, filter: (file: string) => boolean = () => true): Promise<void> {
  for (const file of migrationFiles().filter(filter)) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (e) {
      throw new Error(`Falló la migración ${file}: ${(e as Error).message}`);
    }
  }
}

/** DB en memoria solo con el stub de auth (sin migraciones). */
export async function createEmptyDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(readFileSync(AUTH_STUB, 'utf8'));
  return db;
}

/** DB en memoria con el stub de auth + todas las migraciones aplicadas en orden. */
export async function createTestDb(): Promise<Db> {
  if (!template) {
    template = await createEmptyDb();
    await applyMigrations(template);
  }
  // Clonar la plantilla es mucho más rápido que re-aplicar las migraciones.
  return (await template.clone()) as PGlite;
}

type NewUser = {
  email?: string;
  first_name?: string;
  last_name?: string;
  nickname?: string | null;
  phone?: string | null;
};

let userCounter = 0;

/** Crea un usuario en auth.users (dispara los triggers igual que Supabase). */
export async function createUser(db: Db, data: NewUser = {}): Promise<string> {
  userCounter += 1;
  const meta = {
    first_name: data.first_name ?? `Nombre${userCounter}`,
    last_name: data.last_name ?? `Apellido${userCounter}`,
    nickname: data.nickname === undefined ? `Apodo${userCounter}` : data.nickname,
    phone: data.phone === undefined ? `+54911${String(10000000 + userCounter)}` : data.phone,
  };
  const res = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [data.email ?? `user${userCounter}@test.com`, JSON.stringify(meta)],
  );
  return res.rows[0].id;
}

/**
 * Ejecuta `fn` como lo haría un request de PostgREST: rol `authenticated`
 * (o `anon` si userId es null) y el JWT en request.jwt.claims.
 * Todo corre en una transacción, así que RLS y los grants aplican de verdad.
 */
export async function asUser<T>(db: Db, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const role = userId ? 'authenticated' : 'anon';
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/** Llama una función RPC como `userId` y devuelve las filas. */
export async function rpc<T = Record<string, unknown>>(
  db: Db,
  userId: string | null,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  const names = Object.keys(args);
  const params = names.map((n, i) => `${n} => $${i + 1}`).join(', ');
  return asUser(db, userId, async (tx) => {
    const res = await tx.query<T>(`select * from public.${fn}(${params})`, Object.values(args));
    return res.rows;
  });
}
