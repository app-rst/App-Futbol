import { beforeEach, describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser, rpc, type Db } from './helpers/db';
import { addPlayers, createMatch, matchInput, shiftMatch, viewMatch } from './helpers/matches';

describe('partidos', () => {
  let db: Db;
  let admin: string;
  let player: string;
  let outsider: string;

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db, { nickname: 'Capitán', phone: '+5491100000001' });
    player = await createUser(db, { nickname: null, first_name: 'Juan', last_name: 'Secreto', phone: '+5491100000002' });
    outsider = await createUser(db);
  });

  describe('create_match', () => {
    it('crea el partido y el creador queda inscripto como titular #1', async () => {
      const id = await createMatch(db, admin);
      const view = await viewMatch(db, admin, { p_match_id: id });
      expect(view.match.location).toBe('Cancha Los Pibes');
      expect(view.match.invite_code).toMatch(/^[0-9a-f]{12}$/);
      expect(view.players_count).toBe(1);
      expect(view.roster[0]).toMatchObject({ user_id: admin, position: 1, is_starter: true, is_admin: true, is_me: true });
      expect(view.viewer).toMatchObject({ is_admin: true, is_participant: true, position: 1, is_starter: true });
    });

    it('cada partido tiene un código de invitación distinto', async () => {
      const a = await viewMatch(db, admin, { p_match_id: await createMatch(db, admin) });
      const b = await viewMatch(db, admin, { p_match_id: await createMatch(db, admin) });
      expect(a.match.invite_code).not.toBe(b.match.invite_code);
    });

    it.each([
      [{ p_starters_count: 9 }, /al menos 10 titulares/],
      [{ p_starters_count: 41 }, /Máximo 40/],
      [{ p_location: '   ' }, /lugar/],
      [{ p_field_cost: -1 }, /negativo/],
      [{ p_starts_at: new Date(Date.now() - 3600_000).toISOString() }, /futuras/],
    ])('valida los datos: %j', async (override, msg) => {
      await expect(rpc(db, admin, 'create_match', matchInput(override))).rejects.toThrow(msg);
    });

    it('rechaza fin antes del inicio y límite de inscripción después del inicio', async () => {
      const base = matchInput();
      await expect(rpc(db, admin, 'create_match', { ...base, p_ends_at: base.p_starts_at })).rejects.toThrow(
        /posterior a la de inicio/,
      );
      const late = new Date(new Date(base.p_starts_at).getTime() + 60_000).toISOString();
      await expect(rpc(db, admin, 'create_match', { ...base, p_signup_deadline: late })).rejects.toThrow(
        /antes del inicio/,
      );
    });

    it('exige perfil completo y cuenta no bloqueada', async () => {
      const noPhone = await createUser(db, { phone: null });
      await expect(createMatch(db, noPhone)).rejects.toThrow(/Completá tu perfil/);

      await db.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [outsider]);
      await expect(createMatch(db, outsider)).rejects.toThrow(/suspendida/);
    });

    it('anon no puede crear partidos', async () => {
      await expect(rpc(db, null, 'create_match', matchInput())).rejects.toThrow(/permission denied/);
    });

    it('duplicar: solo partidos que organizaste', async () => {
      const original = await createMatch(db, admin);
      const copy = await createMatch(db, admin, { p_duplicated_from: original });
      expect(copy).not.toBe(original);
      await expect(createMatch(db, outsider, { p_duplicated_from: original })).rejects.toThrow(/organizaste/);

      const tpl = await rpc<{ location: string }>(db, admin, 'get_match_template', { p_match_id: original });
      expect(tpl[0].location).toBe('Cancha Los Pibes');
      await expect(rpc(db, outsider, 'get_match_template', { p_match_id: original })).rejects.toThrow(/organizaste/);
    });
  });

  describe('acceso y privacidad', () => {
    it('por id solo lo ven participantes y admins del sistema; por código, cualquiera logueado', async () => {
      const id = await createMatch(db, admin);
      await expect(viewMatch(db, outsider, { p_match_id: id })).rejects.toThrow(/no existe/);

      const { match } = await viewMatch(db, admin, { p_match_id: id });
      const byCode = await viewMatch(db, outsider, { p_invite_code: match.invite_code.toUpperCase() });
      expect(byCode.match.id).toBe(id);
      expect(byCode.viewer).toMatchObject({ is_participant: false, is_admin: false, position: null });

      const sys = await createUser(db);
      await db.query('insert into public.system_admins (user_id) values ($1)', [sys]);
      expect((await viewMatch(db, sys, { p_match_id: id })).viewer.is_system_admin).toBe(true);
    });

    it('código inexistente → no existe', async () => {
      await expect(viewMatch(db, outsider, { p_invite_code: 'nope' })).rejects.toThrow(/no existe/);
    });

    it('los jugadores ven solo el nombre visible; el celular solo el admin del partido', async () => {
      const id = await createMatch(db, admin);
      await addPlayers(db, id, [player]);

      const asPlayer = await viewMatch(db, player, { p_match_id: id });
      expect(asPlayer.roster.map((r) => r.display_name)).toEqual(['Capitán', 'Juan']);
      expect(asPlayer.roster.every((r) => r.phone === null)).toBe(true);
      const json = JSON.stringify(asPlayer);
      expect(json).not.toContain('Secreto');
      expect(json).not.toContain('@test.com');

      const asAdmin = await viewMatch(db, admin, { p_match_id: id });
      expect(asAdmin.roster.map((r) => r.phone)).toEqual(['+5491100000001', '+5491100000002']);
    });

    it('lectura directa: solo los partidos propios; escritura directa prohibida', async () => {
      const id = await createMatch(db, admin);
      const seen = await asUser(db, outsider, async (tx) => (await tx.query('select id from public.matches')).rows);
      expect(seen).toEqual([]);
      const mine = await asUser(db, admin, async (tx) => (await tx.query('select id from public.matches')).rows);
      expect(mine).toEqual([{ id }]);

      await expect(
        asUser(db, admin, (tx) => tx.query(`update public.matches set location = 'x' where id = $1`, [id])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, outsider, (tx) =>
          tx.query('insert into public.match_players (match_id, user_id) values ($1, $2)', [id, outsider]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe('titulares y suplentes (rol derivado del orden de inscripción)', () => {
    it('los primeros N son titulares y el resto suplentes', async () => {
      const id = await createMatch(db, admin);
      const others = [];
      for (let i = 0; i < 11; i++) others.push(await createUser(db));
      await addPlayers(db, id, others);

      const view = await viewMatch(db, admin, { p_match_id: id });
      expect(view.players_count).toBe(12);
      expect(view.roster.filter((r) => r.is_starter)).toHaveLength(10);
      expect(view.roster.slice(10).map((r) => r.user_id)).toEqual(others.slice(9));
      expect(view.roster.slice(10).every((r) => !r.is_starter)).toBe(true);
    });
  });

  describe('update_match', () => {
    it('el admin edita los datos', async () => {
      const id = await createMatch(db, admin);
      await rpc(db, admin, 'update_match', { p_match_id: id, ...withoutDup(matchInput({ p_location: 'Otra cancha', p_field_cost: 60000 })) });
      const view = await viewMatch(db, admin, { p_match_id: id });
      expect(view.match).toMatchObject({ location: 'Otra cancha', field_cost: 60000 });
    });

    it('solo el admin, y solo antes del inicio', async () => {
      const id = await createMatch(db, admin);
      await addPlayers(db, id, [player]);
      await expect(
        rpc(db, player, 'update_match', { p_match_id: id, ...withoutDup(matchInput()) }),
      ).rejects.toThrow(/Solo el admin/);

      await shiftMatch(db, id, -0.5);
      await expect(
        rpc(db, admin, 'update_match', { p_match_id: id, ...withoutDup(matchInput()) }),
      ).rejects.toThrow(/ya empezó/);
    });

    it('al subir N, suplentes pasan a titulares; al bajarlo, los que quedan afuera pierden el equipo', async () => {
      const id = await createMatch(db, admin, { p_starters_count: 12 });
      const others = [];
      for (let i = 0; i < 12; i++) others.push(await createUser(db));
      await addPlayers(db, id, others); // 13 inscriptos, 12 titulares
      await db.query(`update public.match_players set team = 'A' where match_id = $1`, [id]);

      await rpc(db, admin, 'update_match', { p_match_id: id, ...withoutDup(matchInput({ p_starters_count: 10 })) });
      let view = await viewMatch(db, admin, { p_match_id: id });
      expect(view.roster.filter((r) => r.is_starter)).toHaveLength(10);
      expect(view.roster.slice(10).map((r) => r.team)).toEqual([null, null, null]);
      expect(view.roster.slice(0, 10).every((r) => r.team === 'A')).toBe(true);

      await rpc(db, admin, 'update_match', { p_match_id: id, ...withoutDup(matchInput({ p_starters_count: 14 })) });
      view = await viewMatch(db, admin, { p_match_id: id });
      expect(view.roster.every((r) => r.is_starter)).toBe(true);
    });
  });

  describe('listados', () => {
    it('my_matches devuelve solo mis partidos con mi posición', async () => {
      const id = await createMatch(db, admin);
      await addPlayers(db, id, [player]);
      await createMatch(db, outsider);

      const mine = await rpc<{ id: string; my_position: number; is_admin: boolean; players_count: number }>(
        db, player, 'my_matches',
      );
      expect(mine).toEqual([expect.objectContaining({ id, my_position: 2, is_admin: false, players_count: 2 })]);
    });

    it('admin_list_matches: solo admins del sistema', async () => {
      await createMatch(db, admin);
      await expect(rpc(db, admin, 'admin_list_matches')).rejects.toThrow(/administrador del sistema/);
      const sys = await createUser(db);
      await db.query('insert into public.system_admins (user_id) values ($1)', [sys]);
      const all = await rpc<{ admin_name: string }>(db, sys, 'admin_list_matches', { p_filter: 'all' });
      expect(all).toHaveLength(1);
      expect(all[0].admin_name).toContain('Capitán');
    });
  });
});

function withoutDup<T extends { p_duplicated_from?: unknown }>(input: T): Omit<T, 'p_duplicated_from'> {
  const { p_duplicated_from: _ignored, ...rest } = input;
  return rest;
}
