/**
 * Crea (o actualiza) la cuenta del administrador del sistema.
 *
 *   npm run admin:create      (lee las variables de BackEnd/.env)
 *
 * - Si el usuario no existe: lo crea con el email ya confirmado.
 * - Si existe: le actualiza la contraseña y lo desbloquea.
 * - En ambos casos lo marca como admin del sistema. Se puede correr varias veces.
 */
import { createClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✗ Falta ${name} en BackEnd/.env (ver .env.example)`);
    process.exit(1);
  }
  return value;
}

const url = env('SUPABASE_URL');
const secretKey = env('SUPABASE_SECRET_KEY');
const email = env('SYSTEM_ADMIN_EMAIL').toLowerCase();
const password = env('SYSTEM_ADMIN_PASSWORD');

if (secretKey.startsWith('sb_publishable_')) {
  console.error('✗ SUPABASE_SECRET_KEY tiene la publishable key. Usá la secret key (sb_secret_...).');
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(target: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  let userId = await findUserIdByEmail(email);

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      ban_duration: 'none',
    });
    if (error) throw error;
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
      throw new Error('No existe la tabla system_admins: aplicá las migraciones primero (npm run db:push).');
    }
    throw error;
  }

  console.log(`✓ ${email} es administrador del sistema.`);
}

main().catch((e: unknown) => {
  console.error('✗ Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
