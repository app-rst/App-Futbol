/**
 * Datos de prueba: 15 usuarios ficticios y 3 partidos "[Prueba] …".
 *
 *   npm run seed         crea usuarios y partidos de prueba
 *   npm run seed:reset   los borra (tus datos reales no se tocan)
 *
 * Usa el único BackEnd/.env.* configurado (o el ambiente que se pase:
 * `npm run seed -- dev`). En producción pide escribir PRUEBAS: los partidos
 * de prueba solo los ven sus participantes, así que tus amigos no los ven.
 *
 * Los partidos se arman iniciando sesión como los usuarios de prueba y
 * llamando a las mismas RPC que usa la app (create_match, join_match_by_code),
 * así respetan todas las reglas de negocio. Tu cuenta (SEED_OWNER_EMAIL) se
 * suma a los partidos para que te aparezcan en el inicio.
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSeedAllowed, SEED_LOCATION_PREFIX, SEED_PLAYERS, seedEmail } from './lib/seed-data.ts';
import { fail, loadEnv, resolveEnvName } from './lib/env.ts';
import { adminClient, findUserByEmail, listAllUsers } from './lib/supabase-admin.ts';

const HOUR = 3600_000;
const env = loadEnv(resolveEnvName(process.argv[2]));
console.log(`\n▶ Ambiente: ${env.label} (proyecto ${env.projectRef})\n`);
await assertSeedAllowed(env, 'crear usuarios y partidos de prueba');

const admin = adminClient(env);
const publishableKey = env.require('SUPABASE_PUBLISHABLE_KEY');
const password = env.require('SEED_PASSWORD');
const ownerEmail = env.get('SEED_OWNER_EMAIL');

/** Instante "dentro de `days` días a las `hour` hs de Argentina (UTC-3)". */
function artSlot(days: number, hour: number): Date {
  const d = new Date(Date.now() + days * 24 * HOUR);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour + 3, 0, 0));
}

async function ensureSeedUsers(): Promise<string[]> {
  const existing = new Map((await listAllUsers(admin)).map((u) => [u.email?.toLowerCase(), u.id]));
  const ids: string[] = [];
  let created = 0;
  for (const [i, p] of SEED_PLAYERS.entries()) {
    const email = seedEmail(i);
    const metadata = { ...p, phone: `+54911000000${String(i + 1).padStart(2, '0')}`, seed: true };
    const id = existing.get(email);
    if (id) {
      // Por si cambió SEED_PASSWORD desde la última vez.
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      ids.push(id);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw error;
      ids.push(data.user.id);
      created++;
    }
  }
  console.log(`• Usuarios de prueba: ${created} creados, ${ids.length - created} ya existían.`);
  return ids;
}

/** Cliente logueado como un usuario de prueba (las RPC corren con sus permisos). */
async function as(index: number): Promise<SupabaseClient> {
  const client = createClient(env.url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: seedEmail(index), password });
  if (error) throw new Error(`No pude iniciar sesión como ${seedEmail(index)}: ${error.message}`);
  return client;
}

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

async function createMatchAs(index: number, location: string, start: Date, starters = 10): Promise<{ id: string; code: string }> {
  const client = await as(index);
  const id = await rpc<string>(client, 'create_match', {
    p_location: `${SEED_LOCATION_PREFIX}${location}`,
    p_starts_at: start.toISOString(),
    p_ends_at: new Date(start.getTime() + HOUR).toISOString(),
    p_starters_count: starters,
    p_field_cost: 60000,
    p_signup_deadline: new Date(start.getTime() - 2 * HOUR).toISOString(),
  });
  const { data, error } = await admin.from('matches').select('invite_code').eq('id', id).single();
  if (error) throw error;
  return { id, code: data.invite_code };
}

async function joinAs(indexes: number[], code: string) {
  for (const i of indexes) await rpc(await as(i), 'join_match_by_code', { p_invite_code: code });
}

/** Suma a tu cuenta al partido (sin tu contraseña: directo con la secret key). */
async function addOwner(ownerId: string | null, matchId: string) {
  if (!ownerId) return;
  const { error } = await admin.from('match_players').insert({ match_id: matchId, user_id: ownerId });
  if (error) throw error;
}

async function main() {
  await ensureSeedUsers();

  const { count, error } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .like('location', `${SEED_LOCATION_PREFIX}%`);
  if (error) fail(`No pude leer los partidos: ${error.message}. ¿Aplicaste las migraciones?`);
  if ((count ?? 0) > 0) {
    console.log(`• Ya hay ${count} partidos de prueba: no creo más. Para regenerarlos: npm run seed:reset y después npm run seed.`);
    return;
  }

  const owner = ownerEmail ? await findUserByEmail(admin, ownerEmail) : null;
  if (ownerEmail && !owner) console.log(`! No encontré la cuenta ${ownerEmail}: los partidos no te van a aparecer en el inicio.`);
  const ownerId = owner?.id ?? null;

  // 1) Lleno con suplentes: 10 titulares (vos incluido) + 3 suplentes.
  const full = await createMatchAs(0, 'Lleno con suplentes', artSlot(3, 21));
  await joinAs([1, 2, 3, 4, 5, 6, 7, 8], full.code);
  await addOwner(ownerId, full.id);
  await joinAs([9, 10, 11], full.code);
  console.log('• Partido "Lleno con suplentes": 10/10 titulares + 3 suplentes.');

  // 2) Con lugares libres, con vos como admin (si no hay cuenta tuya, el admin es Jugador 13).
  const startFree = artSlot(5, 20);
  if (ownerId) {
    const code = randomBytes(6).toString('hex');
    const { data, error: insErr } = await admin
      .from('matches')
      .insert({
        admin_id: ownerId,
        created_by: ownerId,
        invite_code: code,
        location: `${SEED_LOCATION_PREFIX}Con lugares libres`,
        starts_at: startFree.toISOString(),
        ends_at: new Date(startFree.getTime() + HOUR).toISOString(),
        starters_count: 10,
        field_cost: 50000,
        signup_deadline: new Date(startFree.getTime() - 2 * HOUR).toISOString(),
      })
      .select('id')
      .single();
    if (insErr) throw insErr;
    await addOwner(ownerId, data.id);
    await joinAs([12, 13, 14, 0, 1], code);
  } else {
    const free = await createMatchAs(12, 'Con lugares libres', startFree);
    await joinAs([13, 14, 0, 1, 2], free.code);
  }
  console.log('• Partido "Con lugares libres": 6/10 titulares.');

  // 3) Terminado hace 2 horas, con equipos armados (para resultado y MVP).
  const past = await createMatchAs(0, 'Terminado hace 2 horas', artSlot(2, 19));
  await addOwner(ownerId, past.id);
  await joinAs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], past.code);
  const now = Date.now();
  const { error: upErr } = await admin
    .from('matches')
    .update({
      signup_deadline: new Date(now - 5 * HOUR).toISOString(),
      starts_at: new Date(now - 3 * HOUR).toISOString(),
      ends_at: new Date(now - 2 * HOUR).toISOString(),
    })
    .eq('id', past.id);
  if (upErr) throw upErr;
  const { data: players, error: plErr } = await admin
    .from('match_players')
    .select('user_id, seq')
    .eq('match_id', past.id)
    .order('seq')
    .limit(10);
  if (plErr) throw plErr;
  for (const [i, p] of players.entries()) {
    const { error: tErr } = await admin
      .from('match_players')
      .update({ team: i % 2 === 0 ? 'A' : 'B' })
      .eq('match_id', past.id)
      .eq('user_id', p.user_id);
    if (tErr) throw tErr;
  }
  const pastSubs = (ownerId ? 12 : 11) - 10;
  console.log(`• Partido "Terminado hace 2 horas": 10 titulares con equipos A/B + ${pastSubs} suplente${pastSubs === 1 ? '' : 's'}.`);

  console.log(`\n✓ Listo. Usuarios de prueba: jugador01…15@dev.fulbito.test (contraseña: SEED_PASSWORD en BackEnd/.env.${env.name}).`);
}

main().catch((e: unknown) => {
  console.error('✗ Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
