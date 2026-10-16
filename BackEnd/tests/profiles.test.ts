import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, asUser, createEmptyDb, createTestDb, createUser, type Db } from './helpers/db';

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  phone: string | null;
};

async function profileOf(db: Db, id: string): Promise<Profile> {
  const r = await db.query<Profile>('select * from public.profiles where id = $1', [id]);
  return r.rows[0];
}

describe('profiles', () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  describe('alta automática (trigger)', () => {
    it('registro con email: copia los datos del formulario', async () => {
      const id = await createUser(db, {
        first_name: ' Lionel ',
        last_name: 'Messi',
        nickname: 'Leo',
        phone: '+5491112345678',
      });
      expect(await profileOf(db, id)).toMatchObject({
        first_name: 'Lionel',
        last_name: 'Messi',
        nickname: 'Leo',
        phone: '+5491112345678',
      });
    });

    it('registro con Google: toma given_name/family_name y deja el celular vacío', async () => {
      const r = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data)
         values ('g@test.com', '{"given_name":"Diego","family_name":"Maradona","full_name":"Diego Maradona"}')
         returning id`,
      );
      const p = await profileOf(db, r.rows[0].id);
      expect(p).toMatchObject({ first_name: 'Diego', last_name: 'Maradona', nickname: null, phone: null });
    });

    it('Google solo con full_name: separa nombre y apellido', async () => {
      const r = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data)
         values ('g2@test.com', '{"full_name":"Juan Román Riquelme"}') returning id`,
      );
      expect(await profileOf(db, r.rows[0].id)).toMatchObject({ first_name: 'Juan', last_name: 'Román Riquelme' });
    });

    it('un celular inválido no rompe el registro: queda vacío', async () => {
      const id = await createUser(db, { phone: '1234' });
      expect((await profileOf(db, id)).phone).toBeNull();
    });
  });

  describe('RLS y permisos', () => {
    it('cada usuario lee solo su propio perfil', async () => {
      const a = await createUser(db);
      const b = await createUser(db);
      const rows = await asUser(db, a, async (tx) => (await tx.query<Profile>('select * from public.profiles')).rows);
      expect(rows.map((r) => r.id)).toEqual([a]);
      const other = await asUser(db, a, async (tx) =>
        (await tx.query('select * from public.profiles where id = $1', [b])).rows,
      );
      expect(other).toEqual([]);
    });

    it('anon no puede leer perfiles', async () => {
      await createUser(db);
      await expect(asUser(db, null, (tx) => tx.query('select * from public.profiles'))).rejects.toThrow(
        /permission denied/,
      );
    });

    it('el usuario edita su perfil y updated_at se actualiza', async () => {
      const a = await createUser(db);
      const before = await profileOf(db, a);
      await asUser(db, a, (tx) =>
        tx.query(`update public.profiles set nickname = '  Pipa ', phone = '+5493511234567' where id = $1`, [a]),
      );
      const after = await profileOf(db, a);
      expect(after).toMatchObject({ nickname: 'Pipa', phone: '+5493511234567' });
      expect((after as unknown as { updated_at: Date }).updated_at.getTime()).toBeGreaterThanOrEqual(
        (before as unknown as { updated_at: Date }).updated_at.getTime(),
      );
    });

    it('apodo vacío se guarda como null (es opcional)', async () => {
      const a = await createUser(db);
      await asUser(db, a, (tx) => tx.query(`update public.profiles set nickname = '' where id = $1`, [a]));
      expect((await profileOf(db, a)).nickname).toBeNull();
    });

    it('no puede editar el perfil de otro', async () => {
      const a = await createUser(db);
      const b = await createUser(db, { nickname: 'Original' });
      const res = await asUser(db, a, (tx) =>
        tx.query(`update public.profiles set nickname = 'Hackeado' where id = $1`, [b]),
      );
      expect(res.affectedRows).toBe(0);
      expect((await profileOf(db, b)).nickname).toBe('Original');
    });

    it('no puede cambiar columnas no editables (id)', async () => {
      const a = await createUser(db);
      await expect(
        asUser(db, a, (tx) => tx.query(`update public.profiles set id = gen_random_uuid() where id = $1`, [a])),
      ).rejects.toThrow(/permission denied/);
    });

    it('no puede insertar ni borrar perfiles', async () => {
      const a = await createUser(db);
      await expect(
        asUser(db, a, (tx) => tx.query(`insert into public.profiles (id) values (gen_random_uuid())`)),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, a, (tx) => tx.query(`delete from public.profiles where id = $1`, [a])),
      ).rejects.toThrow(/permission denied/);
    });

    it('rechaza celulares con formato inválido', async () => {
      const a = await createUser(db);
      await expect(
        asUser(db, a, (tx) => tx.query(`update public.profiles set phone = '1155556666' where id = $1`, [a])),
      ).rejects.toThrow(/profiles_phone_format/);
    });

    it('no expone is_profile_complete a los usuarios', async () => {
      const a = await createUser(db);
      await expect(
        asUser(db, a, (tx) => tx.query('select public.is_profile_complete($1)', [a])),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe('backfill (cuentas creadas antes de aplicar las migraciones)', () => {
    it('crea el perfil desde los metadatos del registro', async () => {
      const raw = await createEmptyDb();
      // Usuario registrado cuando todavía no existía public.profiles ni el trigger.
      const id = await createUser(raw, {
        first_name: 'Rodrigo',
        last_name: 'Pérez',
        nickname: 'Rodri',
        phone: '+5491187654321',
      });
      await applyMigrations(raw);
      expect(await profileOf(raw, id)).toMatchObject({
        first_name: 'Rodrigo',
        last_name: 'Pérez',
        nickname: 'Rodri',
        phone: '+5491187654321',
      });
    });

    it('es idempotente y no pisa perfiles existentes', async () => {
      const raw = await createEmptyDb();
      const early = await createUser(raw, { nickname: 'Viejo' });
      await applyMigrations(raw);
      await raw.query(`update public.profiles set nickname = 'Editado' where id = $1`, [early]);
      const later = await createUser(raw, { nickname: 'Nuevo' });

      // Volver a correr la sentencia del backfill no cambia nada.
      await raw.query(`
        insert into public.profiles (id, first_name, last_name, nickname, phone)
        select u.id, d.first_name, d.last_name, d.nickname, d.phone
        from auth.users u cross join lateral public.profile_from_metadata(u.raw_user_meta_data) d
        where not exists (select 1 from public.profiles p where p.id = u.id)`);

      expect((await profileOf(raw, early)).nickname).toBe('Editado');
      expect((await profileOf(raw, later)).nickname).toBe('Nuevo');
      const count = await raw.query<{ n: number }>('select count(*)::int n from public.profiles');
      expect(count.rows[0].n).toBe(2);
    });
  });

  it('is_profile_complete: nombre, apellido y celular obligatorios; apodo opcional', async () => {
    const complete = await createUser(db, { nickname: null });
    const noPhone = await createUser(db, { phone: null });
    const r = await db.query<{ a: boolean; b: boolean; c: boolean }>(
      'select public.is_profile_complete($1) a, public.is_profile_complete($2) b, public.is_profile_complete(gen_random_uuid()) c',
      [complete, noPhone],
    );
    expect(r.rows[0]).toEqual({ a: true, b: false, c: false });
  });
});
