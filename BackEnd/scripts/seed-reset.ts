/**
 * Borra los datos de prueba de DESARROLLO: los partidos "[Prueba] …", los
 * partidos que organizan los usuarios de prueba y esos usuarios. Por la
 * cascada se van sus inscripciones. Tus datos reales no se tocan.
 *
 *   npm run seed:reset
 */
import { assertDevelopment, SEED_EMAIL_DOMAIN, SEED_LOCATION_PREFIX } from './lib/seed-data.ts';
import { loadEnv } from './lib/env.ts';
import { adminClient, listAllUsers } from './lib/supabase-admin.ts';

const env = loadEnv('development');
assertDevelopment(env);
const admin = adminClient(env);

async function main() {
  console.log(`\n▶ Ambiente: ${env.label} (proyecto ${env.projectRef})\n`);

  // Solo usuarios marcados como de prueba Y con el dominio de prueba.
  const seedUsers = (await listAllUsers(admin)).filter(
    (u) => u.user_metadata?.seed === true && u.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`),
  );
  const ids = seedUsers.map((u) => u.id);

  const byLocation = await admin.from('matches').delete().like('location', `${SEED_LOCATION_PREFIX}%`).select('id');
  if (byLocation.error) throw byLocation.error;
  let deletedMatches = byLocation.data.length;

  if (ids.length > 0) {
    const byAdmin = await admin.from('matches').delete().in('admin_id', ids).select('id');
    if (byAdmin.error) throw byAdmin.error;
    deletedMatches += byAdmin.data.length;
  }

  for (const u of seedUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw error;
  }

  console.log(`✓ Borrados ${deletedMatches} partidos de prueba y ${seedUsers.length} usuarios de prueba.`);
}

main().catch((e: unknown) => {
  console.error('✗ Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
