import { beforeEach, describe, expect, it } from 'vitest';
import { asUser, createTestDb, createUser, rpc, type Db } from './helpers/db';
import { addPlayers, createMatch, shiftMatch } from './helpers/matches';

type Post = {
  result: { loaded: boolean; team_a_goals: number | null; team_b_goals: number | null };
  scorers: Array<{ user_id: string; display_name: string; team: string; goals: number }>;
  voting: {
    is_open: boolean;
    is_closed: boolean;
    is_starter: boolean;
    has_voted: boolean;
    can_vote: boolean;
    candidates: Array<{ user_id: string }>;
  };
  mvp: Array<{ user_id: string; display_name: string }> | null;
};

describe('después del partido: resultado y MVP', () => {
  let db: Db;
  let admin: string;
  let players: string[]; // 9 titulares (además del admin) + 2 suplentes
  let starters: string[]; // los 10 titulares, admin incluido
  let subs: string[];
  let matchId: string;

  const post = async (userId: string) =>
    (await rpc<{ get_match_post: Post }>(db, userId, 'get_match_post', { p_match_id: matchId }))[0].get_match_post;
  const vote = (voter: string, candidate: string) =>
    rpc(db, voter, 'cast_mvp_vote', { p_match_id: matchId, p_candidate: candidate });
  const saveResult = (userId: string, a: number, b: number, scorers: Array<{ user_id: string; goals: number }> = []) =>
    rpc(db, userId, 'save_result', {
      p_match_id: matchId,
      p_team_a_goals: a,
      p_team_b_goals: b,
      p_scorers: JSON.stringify(scorers),
    });

  /** Titulares alternados en A y B (admin en A). */
  async function assignTeams() {
    for (const [i, id] of starters.entries()) {
      await db.query('update public.match_players set team = $3 where match_id = $1 and user_id = $2', [
        matchId,
        id,
        i % 2 === 0 ? 'A' : 'B',
      ]);
    }
  }
  const teamA = () => starters.filter((_, i) => i % 2 === 0);
  const teamB = () => starters.filter((_, i) => i % 2 === 1);

  /** Terminó hace 1 hora (votación abierta). */
  const finishedRecently = () => shiftMatch(db, matchId, -2, 1);
  /** Terminó hace más de 24 horas (votación cerrada). */
  const finishedLongAgo = () => shiftMatch(db, matchId, -30, 1);

  beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db);
    matchId = await createMatch(db, admin);
    players = [];
    for (let i = 0; i < 11; i++) players.push(await createUser(db, { nickname: `J${i + 1}` }));
    await addPlayers(db, matchId, players);
    starters = [admin, ...players.slice(0, 9)];
    subs = players.slice(9);
    await assignTeams();
  });

  describe('resultado y goleadores', () => {
    it('el admin carga el resultado y los goleadores después del fin', async () => {
      await finishedRecently();
      await saveResult(admin, 3, 1, [
        { user_id: teamA()[1], goals: 2 },
        { user_id: teamB()[0], goals: 1 },
      ]);
      const p = await post(players[0]);
      expect(p.result).toEqual({ loaded: true, team_a_goals: 3, team_b_goals: 1 });
      expect(p.scorers).toEqual([
        expect.objectContaining({ user_id: teamA()[1], team: 'A', goals: 2 }),
        expect.objectContaining({ user_id: teamB()[0], team: 'B', goals: 1 }),
      ]);
    });

    it('no se puede cargar antes del fin ni en un partido cancelado', async () => {
      await expect(saveResult(admin, 1, 0)).rejects.toThrow(/cuando termina/);
      await finishedRecently();
      await db.query(`update public.matches set status = 'cancelled' where id = $1`, [matchId]);
      await expect(saveResult(admin, 1, 0)).rejects.toThrow(/cancelado/);
    });

    it('solo el admin del partido', async () => {
      await finishedRecently();
      await expect(saveResult(players[0], 1, 0)).rejects.toThrow(/Solo el admin/);
      const outsider = await createUser(db);
      await expect(saveResult(outsider, 1, 0)).rejects.toThrow(/no existe/);
    });

    it('exige que todos los titulares tengan equipo', async () => {
      await finishedRecently();
      await db.query('update public.match_players set team = null where match_id = $1 and user_id = $2', [
        matchId,
        players[0],
      ]);
      await expect(saveResult(admin, 1, 0)).rejects.toThrow(/asigná a todos los titulares/);
    });

    it('los goleadores tienen que ser titulares', async () => {
      await finishedRecently();
      await expect(saveResult(admin, 1, 0, [{ user_id: subs[0], goals: 1 }])).rejects.toThrow(/titulares/);
    });

    it('la suma de goleadores no puede superar los goles del equipo (pero sí ser menor)', async () => {
      await finishedRecently();
      await expect(saveResult(admin, 1, 0, [{ user_id: teamA()[0], goals: 2 }])).rejects.toThrow(/equipo A suman 2/);
      await expect(saveResult(admin, 0, 0, [{ user_id: teamB()[0], goals: 1 }])).rejects.toThrow(/equipo B suman 1/);
      await saveResult(admin, 4, 0, [{ user_id: teamA()[0], goals: 1 }]); // 3 goles sin goleador cargado
      expect((await post(admin)).result.team_a_goals).toBe(4);
    });

    it('una vez guardado, el marcador no se puede cambiar', async () => {
      await finishedRecently();
      await saveResult(admin, 2, 0, [{ user_id: teamA()[0], goals: 2 }]);
      await expect(saveResult(admin, 1, 1)).rejects.toThrow(/ya está guardado/);
      expect((await post(admin)).result).toEqual({ loaded: true, team_a_goals: 2, team_b_goals: 0 });
    });

    it('editar reemplaza los goleadores, y después ya no se pueden cambiar los equipos', async () => {
      await finishedRecently();
      await saveResult(admin, 2, 0, [{ user_id: teamA()[0], goals: 2 }]);
      await saveResult(admin, 2, 0, [
        { user_id: teamA()[1], goals: 1 },
        { user_id: teamA()[2], goals: 1 },
      ]);
      const p = await post(admin);
      expect(p.scorers.map((s) => s.user_id).sort()).toEqual([teamA()[1], teamA()[2]].sort());
      await expect(
        rpc(db, admin, 'set_teams', {
          p_match_id: matchId,
          p_assignments: JSON.stringify([{ user_id: players[0], team: 'B' }]),
        }),
      ).rejects.toThrow(/resultado/);
    });

    it('goleador repetido o con 0 goles → error', async () => {
      await finishedRecently();
      await expect(
        saveResult(admin, 2, 0, [
          { user_id: teamA()[0], goals: 1 },
          { user_id: teamA()[0], goals: 1 },
        ]),
      ).rejects.toThrow(/repetido/);
      await expect(saveResult(admin, 1, 0, [{ user_id: teamA()[0], goals: 0 }])).rejects.toThrow(/al menos 1 gol/);
    });
  });

  describe('votación del MVP', () => {
    it('no se puede votar antes del fin ni después de las 24 horas', async () => {
      await expect(vote(players[0], players[1])).rejects.toThrow(/se abre cuando termina/);
      await finishedLongAgo();
      await expect(vote(players[0], players[1])).rejects.toThrow(/ya cerró/);
    });

    it('solo votan titulares, a otro titular, y no a sí mismos', async () => {
      await finishedRecently();
      await expect(vote(subs[0], players[0])).rejects.toThrow(/Solo votan los titulares/);
      await expect(vote(players[0], players[0])).rejects.toThrow(/a vos mismo/);
      await expect(vote(players[0], subs[0])).rejects.toThrow(/a un titular/);
      const outsider = await createUser(db);
      await expect(vote(outsider, players[0])).rejects.toThrow(/no existe/);
    });

    it('un solo voto por persona; el voto es opcional', async () => {
      await finishedRecently();
      expect((await post(players[0])).voting).toMatchObject({ is_open: true, can_vote: true, has_voted: false });
      await vote(players[0], players[1]);
      await expect(vote(players[0], players[2])).rejects.toThrow(/Ya votaste/);
      expect((await post(players[0])).voting).toMatchObject({ can_vote: false, has_voted: true });
    });

    it('los candidatos son los demás titulares; los suplentes no pueden votar', async () => {
      await finishedRecently();
      const p = await post(players[0]);
      expect(p.voting.candidates.map((c) => c.user_id).sort()).toEqual(
        starters.filter((s) => s !== players[0]).sort(),
      );
      expect((await post(subs[0])).voting).toMatchObject({ is_starter: false, can_vote: false, candidates: [] });
    });

    it('partido cancelado: no hay votación', async () => {
      await finishedRecently();
      await db.query(`update public.matches set status = 'cancelled' where id = $1`, [matchId]);
      await expect(vote(players[0], players[1])).rejects.toThrow(/cancelado/);
    });

    it('el MVP no se ve mientras la votación está abierta', async () => {
      await finishedRecently();
      await vote(players[0], players[1]);
      expect((await post(admin)).mvp).toBeNull();
    });

    it('al cerrar se muestra solo el MVP', async () => {
      await finishedRecently();
      await vote(players[0], players[1]);
      await vote(players[2], players[1]);
      await vote(players[3], players[1]);
      await vote(players[5], players[4]);
      await vote(players[6], players[4]);
      await finishedLongAgo();
      expect((await post(subs[0])).mvp).toEqual([{ user_id: players[1], display_name: 'J2' }]);
    });

    it('si hay empate se muestran todos los empatados', async () => {
      await finishedRecently();
      await vote(players[0], players[1]);
      await vote(players[2], players[1]);
      await vote(players[4], players[3]);
      await vote(players[5], players[3]);
      await vote(players[6], players[7]);
      await finishedLongAgo();
      expect((await post(admin)).mvp?.map((m) => m.user_id).sort()).toEqual([players[1], players[3]].sort());
    });

    it('con menos de la mitad de los titulares votando, no hay MVP', async () => {
      await finishedRecently();
      for (const voter of players.slice(2, 6)) await vote(voter, players[1]);
      await finishedLongAgo();
      expect((await post(admin)).mvp).toEqual([]);
    });

    it('si nadie votó, no hay MVP', async () => {
      await finishedLongAgo();
      expect((await post(admin)).mvp).toEqual([]);
    });
  });

  describe('anonimato del voto', () => {
    beforeEach(async () => {
      await finishedRecently();
      await vote(players[0], players[1]);
      await vote(admin, players[1]);
      // Hasta 5 de 10 titulares, el mínimo para que haya MVP.
      for (const voter of players.slice(2, 5)) await vote(voter, players[1]);
    });

    it('nadie de la app puede leer las tablas de votos: ni jugadores, ni el admin, ni el admin del sistema', async () => {
      const sys = await createUser(db);
      await db.query('insert into public.system_admins (user_id) values ($1)', [sys]);
      for (const who of [players[0], admin, sys]) {
        for (const table of ['mvp_ballots', 'mvp_votes']) {
          await expect(asUser(db, who, (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(
            /permission denied/,
          );
        }
      }
      await expect(asUser(db, players[0], (tx) => tx.query('select * from public.match_scorers'))).rejects.toThrow(
        /permission denied/,
      );
    });

    it('la tabla de votos no guarda votante ni fecha', async () => {
      const cols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'mvp_votes' order by ordinal_position`,
      );
      expect(cols.rows.map((c) => c.column_name)).toEqual(['id', 'match_id', 'candidate_id']);
      const ballotCols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'mvp_ballots' order by ordinal_position`,
      );
      expect(ballotCols.rows.map((c) => c.column_name)).toEqual(['match_id', 'voter_id']);
    });

    it('get_match_post nunca expone conteos ni quién votó a quién', async () => {
      await finishedLongAgo();
      const p = await post(admin);
      const json = JSON.stringify(p);
      expect(json).not.toMatch(/"votes"|"count"|"n":/);
      expect(p.mvp).toEqual([{ user_id: players[1], display_name: 'J2' }]);
      // Lo único que cada uno sabe es si ÉL votó.
      expect(p.voting.has_voted).toBe(true);
      expect((await post(players[5])).voting.has_voted).toBe(false);
    });
  });
});
