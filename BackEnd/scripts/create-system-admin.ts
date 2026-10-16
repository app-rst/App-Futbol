/**
 * Crea (o actualiza) la cuenta del administrador del sistema en un ambiente.
 *
 *   npm run admin:create:dev    (lee BackEnd/.env.development)
 *   npm run admin:create:prod   (lee BackEnd/.env.production, pide confirmación)
 *
 * - Si el usuario no existe: lo crea con el email ya confirmado.
 * - Si existe: le actualiza la contraseña y lo desbloquea.
 * - En ambos casos lo marca como admin del sistema. Se puede correr varias veces.
 */
import { confirmTyped, loadEnv, parseEnvName } from './lib/env.ts';
import { adminClient, findUserByEmail } from './lib/supabase-admin.ts';

async function main() {
  const env = loadEnv(parseEnvName(process.argv[2]));
  const email = env.require('SYSTEM_ADMIN_EMAIL').toLowerCase();
  const password = env.require('SYSTEM_ADMIN_PASSWORD');

  console.log(`\n▶ Ambiente: ${env.label} (proyecto ${env.projectRef})\n`);
  if (env.name === 'production') {
    await confirmTyped('PRODUCCION', `⚠️  Vas a crear/actualizar el admin ${email} en PRODUCCIÓN.`);
  }

  const supabase = adminClient(env);
  const existing = await findUserByEmail(supabase, email);
  let userId: string;

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      ban_duration: 'none',
    });
    if (error) throw error;
    userId = existing.id;
    console.log(`• El usuario ${email} ya existía: contraseña actualizada.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // El trigger handle_new_user crea el perfil con estos datos.
      user_metadata: { first_name: 'Admin', last_name: 'Sistema', nickname: 'Admin' },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`• Usuario ${email} creado.`);
  }

  const { error } = await supabase.from('system_admins').upsert({ user_id: userId }, { onConflict: 'user_id' });
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw new Error('No existe la tabla system_admins: aplicá las migraciones primero (npm run db:push:<ambiente>).');
    }
    throw error;
  }

  console.log(`✓ ${email} es administrador del sistema en ${env.label}.`);
}

main().catch((e: unknown) => {
  console.error('✗ Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
