import { beforeEach, describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser, rpc, type Db } from './helpers/db';
import { createMatch, shiftMatch, viewMatch } from './helpers/matches';

type JoinResult = { match_id: string; position: number; is_starter: boolean };

describe('inscripción, bajas y promoción de suplentes', () => {
  let db: Db;
  let admin: string;
  let matchId: string;
  let code: string;

  /** Crea `n` usuarios y los anota (vía RPC, como lo haría la app) en orden. */
  async function joinMany(n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = await createUser(db);
      await join(id);
      ids.push(id);
    }
    return ids;
  }

  async function join(userId: string): Promise<JoinResult> {
    const rows = await rpc<{ join_match_by_code: JoinResult }>(db, userId, 'join_match_by_code', {
      p_invite_code: code,
    });
    return rows[0].join_match_by_code;
  }

  async function roster() {
    return (await viewMatch(db, admin, { p_match_id: matchId })).roster;
  }

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db);
    matchId = await createMatch(db, admin); // N = 10, el admin es el titular #1
    code = (await viewMatch(db, admin, { p_match_id: matchId })).match.invite_code;
  });

  describe('anotarse', () => {
    it('los primeros N son titulares; después entran como suplentes por orden de llegada', async () => {
      const starters = await joinMany(9); // completa los 10 titulares
      const sub1 = await createUser(db);
      const sub2 = await createUser(db);

      expect(await join(sub1)).toEqual({ match_id: matchId, position: 11, is_starter: false });
      expect(await join(sub2)).toEqual({ match_id: matchId, position: 12, is_starter: false });

      const r = await roster();
      expect(r.filter((p) => p.is_starter).map((p) => p.user_id)).toEqual([admin, ...starters]);
      expect(r.filter((p) => !p.is_starter).map((p) => p.user_id)).toEqual([sub1, sub2]);
    });

    it('no se puede anotar dos veces', async () => {
      const u = await createUser(db);
      await join(u);
      await expect(join(u)).rejects.toThrow(/Ya estás anotado/);
      await expect(join(admin)).rejects.toThrow(/Ya estás anotado/);
    });

    it('la fecha límite es informativa: no bloquea anotarse', async () => {
      await db.query(`update public.matches set signup_deadline = now() - interval '1 hour' where id = $1`, [matchId]);
      const u = await createUser(db);
      expect((await join(u)).is_starter).toBe(true);
    });

    it('no se puede anotar si el partido empezó o está cancelado', async () => {
      const u = await createUser(db);
      await shiftMatch(db, matchId, -0.5);
      await expect(join(u)).rejects.toThrow(/ya empezó/);

      await shiftMatch(db, matchId, 24);
      await db.query(`update public.matches set status = 'cancelled' where id = $1`, [matchId]);
      await expect(join(u)).rejects.toThrow(/cancelado/);
    });

    it('exige perfil completo y cuenta activa; el código tiene que existir', async () => {
      const noPhone = await createUser(db, { phone: null });
      await expect(join(noPhone)).rejects.toThrow(/Completá tu perfil/);

      const banned = await createUser(db);
      await db.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [banned]);
      await expect(join(banned)).rejects.toThrow(/suspendida/);

      const u = await createUser(db);
      await expect(rpc(db, u, 'join_match_by_code', { p_invite_code: 'noexiste' })).rejects.toThrow(/no existe/);
      await expect(rpc(db, null, 'join_match_by_code', { p_invite_code: code })).rejects.toThrow(/permission denied/);
    });

    it('acepta el código con mayúsculas y espacios (como se pega desde WhatsApp)', async () => {
      const u = await createUser(db);
      const rows = await rpc<{ join_match_by_code: JoinResult }>(db, u, 'join_match_by_code', {
        p_invite_code: `  ${code.toUpperCase()} `,
      });
      expect(rows[0].join_match_by_code.match_id).toBe(matchId);
    });
  });

  describe('bajarse', () => {
    it('si un titular se baja, el primer suplente pasa a titular automáticamente', async () => {
      const starters = await joinMany(9);
      const [sub1, sub2] = await joinMany(2);

      await rpc(db, starters[3], 'leave_match', { p_match_id: matchId });

      const r = await roster();
      expect(r).toHaveLength(11);
      expect(r.filter((p) => p.is_starter)).toHaveLength(10);
      expect(r.find((p) => p.user_id === sub1)).toMatchObject({ is_starter: true, position: 10 });
      expect(r.find((p) => p.user_id === sub2)).toMatchObject({ is_starter: false, position: 11 });
    });

    it('si un suplente se baja, los demás suplentes conservan su orden', async () => {
      await joinMany(9);
      const [sub1, sub2, sub3] = await joinMany(3);
      await rpc(db, sub2, 'leave_match', { p_match_id: matchId });
      const subs = (await roster()).filter((p) => !p.is_starter).map((p) => p.user_id);
      expect(subs).toEqual([sub1, sub3]);
    });

    it('si se baja un titular y no hay suplentes, queda un lugar libre', async () => {
      const starters = await joinMany(9);
      await rpc(db, starters[0], 'leave_match', { p_match_id: matchId });
      const r = await roster();
      expect(r).toHaveLength(9);
      expect(r.every((p) => p.is_starter)).toBe(true);
    });

    it('volver a anotarse después de bajarse te manda al final de la lista', async () => {
      const starters = await joinMany(9);
      const [sub1] = await joinMany(1);
      await rpc(db, starters[0], 'leave_match', { p_match_id: matchId });
      const again = await join(starters[0]);
      expect(again).toMatchObject({ position: 11, is_starter: false });
      expect((await roster()).find((p) => p.user_id === sub1)?.is_starter).toBe(true);
    });

    it('el admin no puede bajarse sin pasarle el admin a otro', async () => {
      await expect(rpc(db, admin, 'leave_match', { p_match_id: matchId })).rejects.toThrow(/elegir a otro titular/);
    });

    it('no se puede bajar después del inicio ni si no estás anotado', async () => {
      const [u] = await joinMany(1);
      const outsider = await createUser(db);
      await expect(rpc(db, outsider, 'leave_match', { p_match_id: matchId })).rejects.toThrow(/No estás anotado/);
      await shiftMatch(db, matchId, -0.5);
      await expect(rpc(db, u, 'leave_match', { p_match_id: matchId })).rejects.toThrow(/ya empezó/);
    });
  });

  describe('sacar jugadores', () => {
    it('el admin saca a un titular y se aplica la misma promoción', async () => {
      const starters = await joinMany(9);
      const [sub1] = await joinMany(1);
      await rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: starters[5] });
      const r = await roster();
      expect(r.some((p) => p.user_id === starters[5])).toBe(false);
      expect(r.find((p) => p.user_id === sub1)?.is_starter).toBe(true);
    });

    it('un jugador común no puede sacar a otro; un tercero ni sabe que el partido existe', async () => {
      const [a, b] = await joinMany(2);
      await expect(rpc(db, a, 'remove_player', { p_match_id: matchId, p_user_id: b })).rejects.toThrow(
        /Solo el admin/,
      );
      const outsider = await createUser(db);
      await expect(rpc(db, outsider, 'remove_player', { p_match_id: matchId, p_user_id: b })).rejects.toThrow(
        /no existe/,
      );
    });

    it('no se puede sacar al admin ni a alguien que no está anotado', async () => {
      const outsider = await createUser(db);
      await expect(rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: admin })).rejects.toThrow(
        /al admin/,
      );
      await expect(rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: outsider })).rejects.toThrow(
        /no está anotado/,
      );
    });

    it('no se puede sacar jugadores después del inicio', async () => {
      const [u] = await joinMany(1);
      await shiftMatch(db, matchId, -0.5);
      await expect(rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: u })).rejects.toThrow(/ya empezó/);
    });

    it('el admin del sistema puede sacar jugadores y queda registrado', async () => {
      const [u] = await joinMany(1);
      const sys = await createUser(db);
      await db.query('insert into public.system_admins (user_id) values ($1)', [sys]);

      await rpc(db, sys, 'remove_player', { p_match_id: matchId, p_user_id: u });
      expect((await roster()).some((p) => p.user_id === u)).toBe(false);

      const log = await asUser(db, sys, async (tx) =>
        (await tx.query('select action, target_user_id, target_match_id from public.admin_audit_log')).rows,
      );
      expect(log).toEqual([{ action: 'match.remove_player', target_user_id: u, target_match_id: matchId }]);
    });

    it('cuando lo hace el admin del partido no se registra como moderación', async () => {
      const [u] = await joinMany(1);
      await rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: u });
      const n = await db.query<{ n: number }>('select count(*)::int n from public.admin_audit_log');
      expect(n.rows[0].n).toBe(0);
    });
  });

  it('nunca hay más de N titulares ni posiciones repetidas tras muchas altas y bajas', async () => {
    const users = await joinMany(14);
    for (const u of [users[0], users[5], users[12]]) await rpc(db, u, 'leave_match', { p_match_id: matchId });
    await join(users[0]);
    await rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: users[2] });

    const r = await roster();
    expect(r.filter((p) => p.is_starter)).toHaveLength(10);
    expect(r.map((p) => p.position)).toEqual(r.map((_, i) => i + 1));
    expect(new Set(r.map((p) => p.user_id)).size).toBe(r.length);
  });
});
