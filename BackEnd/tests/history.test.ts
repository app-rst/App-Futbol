import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createUser, rpc, type Db } from './helpers/db';
import { addPlayers, createMatch, shiftMatch } from './helpers/matches';

type HistoryItem = {
  id: string;
  location: string;
  my_team: 'A' | 'B' | null;
  result: { loaded: boolean; team_a_goals: number | null; team_b_goals: number | null };
  teams: { A: string[]; B: string[] };
  scorers: Array<{ display_name: string; team: string; goals: number }>;
  mvp: Array<{ display_name: string }> | null;
};

describe('historial', () => {
  let db: Db;
  let admin: string;
  let players: string[]; // 9 titulares + 1 suplente
  let matchId: string;

  const history = async (userId: string) =>
    (await rpc<{ my_history: HistoryItem[] }>(db, userId, 'my_history'))[0].my_history;

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db, { nickname: 'Capi', last_name: 'Secreto', phone: '+5491199999999' });
    matchId = await createMatch(db, admin, { p_location: 'La Canchita' });
    players = [];
    for (let i = 0; i < 10; i++) players.push(await createUser(db, { nickname: `J${i + 1}` }));
    await addPlayers(db, matchId, players);
    // Equipos: admin y los impares en A, el resto en B.
    for (const [i, id] of [admin, ...players.slice(0, 9)].entries()) {
      await db.query('update public.match_players set team = $3 where match_id = $1 and user_id = $2', [
        matchId,
        id,
        i % 2 === 0 ? 'A' : 'B',
      ]);
    }
  });

  it('un partido futuro todavía no aparece', async () => {
    expect(await history(admin)).toEqual([]);
  });

  it('aparece para los titulares con equipos, resultado y goleadores', async () => {
    await shiftMatch(db, matchId, -2, 1);
    await rpc(db, admin, 'save_result', {
      p_match_id: matchId,
      p_team_a_goals: 2,
      p_team_b_goals: 1,
      p_scorers: JSON.stringify([{ user_id: players[1], goals: 2 }, { user_id: players[0], goals: 1 }]),
    });

    const [item] = await history(players[0]);
    expect(item).toMatchObject({
      id: matchId,
      location: 'La Canchita',
      my_team: 'B',
      result: { loaded: true, team_a_goals: 2, team_b_goals: 1 },
    });
    expect(item.teams.A).toEqual(['Capi', 'J2', 'J4', 'J6', 'J8']);
    expect(item.teams.B).toEqual(['J1', 'J3', 'J5', 'J7', 'J9']);
    expect(item.scorers).toEqual([
      { display_name: 'J2', team: 'A', goals: 2 },
      { display_name: 'J1', team: 'B', goals: 1 },
    ]);
  });

  it('los suplentes no lo tienen en su historial (no jugaron)', async () => {
    await shiftMatch(db, matchId, -2, 1);
    expect(await history(players[9])).toEqual([]);
  });

  it('los partidos cancelados no aparecen', async () => {
    await shiftMatch(db, matchId, -2, 1);
    await db.query(`update public.matches set status = 'cancelled' where id = $1`, [matchId]);
    expect(await history(admin)).toEqual([]);
  });

  it('el MVP aparece recién cuando cierra la votación', async () => {
    await shiftMatch(db, matchId, -2, 1);
    await rpc(db, players[0], 'cast_mvp_vote', { p_match_id: matchId, p_candidate: players[2] });
    expect((await history(admin))[0].mvp).toBeNull();

    await shiftMatch(db, matchId, -30, 1);
    expect((await history(admin))[0].mvp).toEqual([{ display_name: 'J3' }]);
  });

  it('sin votos, el MVP queda vacío', async () => {
    await shiftMatch(db, matchId, -30, 1);
    expect((await history(admin))[0].mvp).toEqual([]);
  });

  it('no expone datos privados ni partidos ajenos', async () => {
    await shiftMatch(db, matchId, -2, 1);
    const json = JSON.stringify(await history(players[0]));
    expect(json).not.toContain('Secreto');
    expect(json).not.toContain('+549');
    expect(json).not.toContain('@test.com');

    const outsider = await createUser(db);
    expect(await history(outsider)).toEqual([]);
  });

  it('ordena del más nuevo al más viejo', async () => {
    await shiftMatch(db, matchId, -50, 1);
    const newer = await createMatch(db, admin, { p_location: 'Más nuevo' });
    await shiftMatch(db, newer, -5, 1);
    expect((await history(admin)).map((h) => h.location)).toEqual(['Más nuevo', 'La Canchita']);
  });
});
