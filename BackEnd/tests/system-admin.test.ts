import { beforeEach, describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser, rpc, type Db } from './helpers/db';

type ListedUser = {
  id: string;
  email: string;
  first_name: string;
  phone: string | null;
  is_blocked: boolean;
  is_system_admin: boolean;
};

/** Promueve con permisos de superusuario (equivale a usar la secret key). */
async function makeSystemAdmin(db: Db, userId: string) {
  await db.query('insert into public.system_admins (user_id) values ($1)', [userId]);
}

async function bannedUntil(db: Db, userId: string): Promise<Date | null> {
  const r = await db.query<{ banned_until: Date | null }>('select banned_until from auth.users where id = $1', [userId]);
  return r.rows[0].banned_until;
}

describe('administradores del sistema', () => {
  let db: Db;
  let admin: string;
  let user: string;

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db, { email: 'admin@admin.com', first_name: 'Admin', phone: null });
    user = await createUser(db, { email: 'pepe@test.com', first_name: 'Pepe', phone: '+5491111111111' });
    await makeSystemAdmin(db, admin);
  });

  describe('rol', () => {
    it('is_system_admin y my_account_flags reflejan el rol del usuario actual', async () => {
      expect(await rpc(db, admin, 'my_account_flags')).toEqual([{ is_system_admin: true, is_blocked: false }]);
      expect(await rpc(db, user, 'my_account_flags')).toEqual([{ is_system_admin: false, is_blocked: false }]);
    });

    it('nadie puede auto-promoverse ni leer system_admins desde la app', async () => {
      await expect(
        asUser(db, user, (tx) => tx.query('insert into public.system_admins (user_id) values ($1)', [user])),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(db, admin, (tx) => tx.query('select * from public.system_admins'))).rejects.toThrow(
        /permission denied/,
      );
    });

    it('anon no puede consultar el rol', async () => {
      await expect(rpc(db, null, 'is_system_admin')).rejects.toThrow(/permission denied/);
    });
  });

  describe('admin_list_users', () => {
    it('un usuario común no puede listar usuarios', async () => {
      await expect(rpc(db, user, 'admin_list_users')).rejects.toThrow(/administrador del sistema/);
    });

    it('el admin ve email y celular de todos', async () => {
      const rows = await rpc<ListedUser>(db, admin, 'admin_list_users');
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.id === user)).toMatchObject({
        email: 'pepe@test.com',
        phone: '+5491111111111',
        is_blocked: false,
        is_system_admin: false,
      });
      expect(rows.find((r) => r.id === admin)?.is_system_admin).toBe(true);
    });

    it('busca por nombre, email o celular', async () => {
      const byName = await rpc<ListedUser>(db, admin, 'admin_list_users', { p_search: 'pep' });
      expect(byName.map((r) => r.id)).toEqual([user]);
      const byEmail = await rpc<ListedUser>(db, admin, 'admin_list_users', { p_search: 'admin.com' });
      expect(byEmail.map((r) => r.id)).toEqual([admin]);
      const byPhone = await rpc<ListedUser>(db, admin, 'admin_list_users', { p_search: '11 1111' });
      expect(byPhone.map((r) => r.id)).toEqual([user]);
    });
  });

  describe('admin_set_user_blocked', () => {
    it('bloquea y desbloquea, y queda registrado en el log', async () => {
      await rpc(db, admin, 'admin_set_user_blocked', { p_user_id: user, p_blocked: true });
      expect((await bannedUntil(db, user))!.getTime()).toBeGreaterThan(Date.now() + 50 * 365 * 24 * 3600 * 1000);
      expect(await rpc(db, user, 'my_account_flags')).toEqual([{ is_system_admin: false, is_blocked: true }]);

      await rpc(db, admin, 'admin_set_user_blocked', { p_user_id: user, p_blocked: false });
      expect(await bannedUntil(db, user)).toBeNull();

      const log = await asUser(db, admin, async (tx) =>
        (await tx.query<{ action: string; target_user_id: string; admin_id: string }>(
          'select action, target_user_id, admin_id from public.admin_audit_log order by id',
        )).rows,
      );
      expect(log).toEqual([
        { action: 'user.block', target_user_id: user, admin_id: admin },
        { action: 'user.unblock', target_user_id: user, admin_id: admin },
      ]);
    });

    it('un usuario común no puede bloquear ni leer el log', async () => {
      const other = await createUser(db);
      await expect(
        rpc(db, user, 'admin_set_user_blocked', { p_user_id: other, p_blocked: true }),
      ).rejects.toThrow(/administrador del sistema/);
      expect(await bannedUntil(db, other)).toBeNull();
      const log = await asUser(db, user, async (tx) => (await tx.query('select * from public.admin_audit_log')).rows);
      expect(log).toEqual([]);
    });

    it('no se puede bloquear a sí mismo ni a otro admin del sistema', async () => {
      await expect(
        rpc(db, admin, 'admin_set_user_blocked', { p_user_id: admin, p_blocked: true }),
      ).rejects.toThrow(/propia cuenta/);
      const admin2 = await createUser(db);
      await makeSystemAdmin(db, admin2);
      await expect(
        rpc(db, admin, 'admin_set_user_blocked', { p_user_id: admin2, p_blocked: true }),
      ).rejects.toThrow(/administrador del sistema/);
    });

    it('falla con un usuario inexistente', async () => {
      await expect(
        rpc(db, admin, 'admin_set_user_blocked', {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_blocked: true,
        }),
      ).rejects.toThrow(/no existe/);
    });

    it('is_blocked es interno: no se puede llamar desde la app', async () => {
      await expect(
        asUser(db, user, (tx) => tx.query('select public.is_blocked($1)', [admin])),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
