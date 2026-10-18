import { beforeEach, describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser, rpc, type Db } from './helpers/db';
import { createMatch, shiftMatch, viewMatch, type MatchView } from './helpers/matches';

type Viewer = MatchView['viewer'] & { can_cancel: boolean; cancel_block_reason: string | null };

describe('herramientas del admin del partido', () => {
  let db: Db;
  let admin: string;
  let matchId: string;
  let code: string;

  async function joinMany(n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = await createUser(db);
      await rpc(db, id, 'join_match_by_code', { p_invite_code: code });
      ids.push(id);
    }
    return ids;
  }

  const cancel = (userId: string) => rpc(db, userId, 'cancel_match', { p_match_id: matchId });
  const viewer = async (userId: string) => (await viewMatch(db, userId, { p_match_id: matchId })).viewer as Viewer;
  const status = async () =>
    (await db.query<{ status: string }>('select status from public.matches where id = $1', [matchId])).rows[0].status;

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db);
    matchId = await createMatch(db, admin); // N = 10
    code = (await viewMatch(db, admin, { p_match_id: matchId })).match.invite_code;
  });

  describe('cancelar', () => {
    it('el admin puede cancelar si la lista de titulares no está completa', async () => {
      await joinMany(5);
      expect((await viewer(admin)).can_cancel).toBe(true);
      await cancel(admin);
      expect(await status()).toBe('cancelled');
    });

    it('NO puede cancelar con la lista de titulares completa', async () => {
      await joinMany(9);
      const v = await viewer(admin);
      expect(v.can_cancel).toBe(false);
      expect(v.cancel_block_reason).toMatch(/completa/);
      await expect(cancel(admin)).rejects.toThrow(/completa/);
      expect(await status()).toBe('open');
    });

    it('si estaba completa y alguien se baja sin suplentes, se vuelve a habilitar', async () => {
      const [first] = await joinMany(9);
      await expect(cancel(admin)).rejects.toThrow(/completa/);
      await rpc(db, first, 'leave_match', { p_match_id: matchId });
      expect((await viewer(admin)).can_cancel).toBe(true);
      await cancel(admin);
      expect(await status()).toBe('cancelled');
    });

    it('si alguien se baja pero hay suplente que lo reemplaza, sigue sin poder cancelar', async () => {
      const [first] = await joinMany(10); // 10 titulares + 1 suplente
      await rpc(db, first, 'leave_match', { p_match_id: matchId });
      await expect(cancel(admin)).rejects.toThrow(/completa/);
    });

    it('también vale cuando el admin saca a alguien y queda incompleta (regla literal)', async () => {
      const [first] = await joinMany(9);
      await rpc(db, admin, 'remove_player', { p_match_id: matchId, p_user_id: first });
      await cancel(admin);
      expect(await status()).toBe('cancelled');
    });

    it('no se puede cancelar después del inicio ni dos veces', async () => {
      await shiftMatch(db, matchId, -0.5);
      await expect(cancel(admin)).rejects.toThrow(/ya empezó/);
      await shiftMatch(db, matchId, 24);
      await cancel(admin);
      await expect(cancel(admin)).rejects.toThrow(/ya está cancelado/);
    });

    it('un jugador común no puede cancelar; un tercero ni sabe que existe', async () => {
      const [player] = await joinMany(1);
      await expect(cancel(player)).rejects.toThrow(/Solo el admin/);
      expect((await viewer(player)).can_cancel).toBe(false);
      expect((await viewer(player)).cancel_block_reason).toBeNull();
      const outsider = await createUser(db);
      await expect(cancel(outsider)).rejects.toThrow(/no existe/);
    });

    it('el admin del sistema puede cancelar aunque esté completa, y queda registrado', async () => {
      await joinMany(9);
      const sys = await createUser(db);
      await db.query('insert into public.system_admins (user_id) values ($1)', [sys]);
      expect((await viewer(sys)).can_cancel).toBe(true);
      await cancel(sys);
      expect(await status()).toBe('cancelled');
      const log = await asUser(db, sys, async (tx) =>
        (await tx.query('select action, target_match_id from public.admin_audit_log')).rows,
      );
      expect(log).toEqual([{ action: 'match.cancel', target_match_id: matchId }]);
    });

    it('un partido cancelado no acepta inscripciones ni cambios', async () => {
      await cancel(admin);
      const u = await createUser(db);
      await expect(rpc(db, u, 'join_match_by_code', { p_invite_code: code })).rejects.toThrow(/cancelado/);
      await expect(
        rpc(db, admin, 'set_teams', { p_match_id: matchId, p_assignments: JSON.stringify([]) }),
      ).rejects.toThrow(/cancelado/);
    });
  });

  describe('pasar el admin y bajarse', () => {
    it('el nuevo admin hereda el partido y el anterior queda afuera; entra el primer suplente', async () => {
      const players = await joinMany(10); // 10 titulares (admin + 9) + 1 suplente
      const sub = players[9];
      const heir = players[0];

      await rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: heir });

      const view = await viewMatch(db, heir, { p_match_id: matchId });
      expect(view.viewer.is_admin).toBe(true);
      expect(view.roster.some((p) => p.user_id === admin)).toBe(false);
      expect(view.roster.find((p) => p.user_id === heir)?.is_admin).toBe(true);
      expect(view.roster.find((p) => p.user_id === sub)?.is_starter).toBe(true);
      // El nuevo admin ve los celulares; el anterior ya no tiene acceso.
      expect(view.roster.every((p) => p.phone !== null)).toBe(true);
      await expect(viewMatch(db, admin, { p_match_id: matchId })).rejects.toThrow(/no existe/);
    });

    it('el nuevo admin tiene que ser un titular', async () => {
      const players = await joinMany(10);
      await expect(
        rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: players[9] }),
      ).rejects.toThrow(/tiene que ser un titular/);
    });

    it('no se puede elegir a uno mismo ni a alguien que no está anotado', async () => {
      const outsider = await createUser(db);
      await expect(
        rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: admin }),
      ).rejects.toThrow(/otro jugador/);
      await expect(
        rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: outsider }),
      ).rejects.toThrow(/no está anotado/);
    });

    it('solo el admin, antes del inicio, y no a una cuenta suspendida', async () => {
      const [a, b] = await joinMany(2);
      await expect(
        rpc(db, a, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: b }),
      ).rejects.toThrow(/Solo el admin/);

      await db.query(`update auth.users set banned_until = now() + interval '1 day' where id = $1`, [b]);
      await expect(
        rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: b }),
      ).rejects.toThrow(/suspendida/);

      await shiftMatch(db, matchId, -0.5);
      await expect(
        rpc(db, admin, 'transfer_admin_and_leave', { p_match_id: matchId, p_new_admin: a }),
      ).rejects.toThrow(/ya empezó/);
    });
  });

  describe('armar equipos', () => {
    const assign = (userId: string, list: Array<{ user_id: string; team: string | null }>) =>
      rpc(db, userId, 'set_teams', { p_match_id: matchId, p_assignments: JSON.stringify(list) });

    it('el admin asigna titulares a A o B, y puede quitarlos', async () => {
      const [a, b] = await joinMany(2);
      await assign(admin, [
        { user_id: admin, team: 'A' },
        { user_id: a, team: 'A' },
        { user_id: b, team: 'B' },
      ]);
      let roster = (await viewMatch(db, a, { p_match_id: matchId })).roster;
      expect(roster.map((p) => p.team)).toEqual(['A', 'A', 'B']);

      await assign(admin, [{ user_id: b, team: null }]);
      roster = (await viewMatch(db, a, { p_match_id: matchId })).roster;
      expect(roster.map((p) => p.team)).toEqual(['A', 'A', null]);
    });

    it('un suplente no puede estar en un equipo', async () => {
      const players = await joinMany(10);
      await expect(assign(admin, [{ user_id: players[9], team: 'A' }])).rejects.toThrow(/Solo los titulares/);
    });

    it('valida el equipo y que el jugador esté anotado', async () => {
      const [a] = await joinMany(1);
      const outsider = await createUser(db);
      await expect(assign(admin, [{ user_id: a, team: 'C' }])).rejects.toThrow(/A o B/);
      await expect(assign(admin, [{ user_id: outsider, team: 'A' }])).rejects.toThrow(/no está anotado/);
    });

    it('solo el admin', async () => {
      const [a] = await joinMany(1);
      await expect(assign(a, [{ user_id: a, team: 'A' }])).rejects.toThrow(/Solo el admin/);
    });

    it('se pueden armar después del inicio, pero no con el resultado cargado', async () => {
      const [a] = await joinMany(1);
      await shiftMatch(db, matchId, -0.5);
      await assign(admin, [{ user_id: a, team: 'B' }]);
      await db.query('update public.matches set result_loaded_at = now() where id = $1', [matchId]);
      await expect(assign(admin, [{ user_id: a, team: 'A' }])).rejects.toThrow(/resultado/);
    });
  });

  describe('nombres de equipo', () => {
    const rename = (userId: string, a: string | null, b: string | null) =>
      rpc(db, userId, 'set_team_names', { p_match_id: matchId, p_team_a_name: a, p_team_b_name: b });
    const names = async (userId: string) => {
      const { match } = await viewMatch(db, userId, { p_match_id: matchId });
      return [match.team_a_name, match.team_b_name];
    };

    it('el admin les pone nombre (sin espacios de más) y vacío vuelve a "sin nombre"', async () => {
      const [player] = await joinMany(1);
      expect(await names(player)).toEqual([null, null]);
      await rename(admin, '  Claro ', 'Oscuro');
      expect(await names(player)).toEqual(['Claro', 'Oscuro']);
      await rename(admin, '', '   ');
      expect(await names(player)).toEqual([null, null]);
    });

    it('se puede renombrar con el resultado ya cargado', async () => {
      await db.query('update public.matches set result_loaded_at = now() where id = $1', [matchId]);
      await rename(admin, 'Claro', null);
      expect(await names(admin)).toEqual(['Claro', null]);
    });

    it('solo el admin, hasta 30 caracteres y sin repetir el nombre', async () => {
      const [player] = await joinMany(1);
      await expect(rename(player, 'Claro', 'Oscuro')).rejects.toThrow(/Solo el admin/);
      await expect(rename(admin, 'x'.repeat(31), null)).rejects.toThrow(/30 caracteres/);
      await expect(rename(admin, 'Claro', 'claro')).rejects.toThrow(/mismo nombre/);
    });
  });
});
