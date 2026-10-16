import { rpc, type Db } from './db';

const HOUR = 3600 * 1000;

export type MatchInput = {
  p_location: string;
  p_starts_at: string;
  p_ends_at: string;
  p_starters_count: number;
  p_field_cost: number;
  p_signup_deadline: string;
  p_duplicated_from?: string | null;
};

/** Datos válidos de un partido que empieza dentro de `hoursFromNow` horas. */
export function matchInput(overrides: Partial<MatchInput> = {}, hoursFromNow = 48): MatchInput {
  const start = Date.now() + hoursFromNow * HOUR;
  return {
    p_location: 'Cancha Los Pibes',
    p_starts_at: new Date(start).toISOString(),
    p_ends_at: new Date(start + HOUR).toISOString(),
    p_starters_count: 10,
    p_field_cost: 50000,
    p_signup_deadline: new Date(start - 2 * HOUR).toISOString(),
    ...overrides,
  };
}

export async function createMatch(db: Db, adminId: string, overrides: Partial<MatchInput> = {}): Promise<string> {
  const rows = await rpc<{ create_match: string }>(db, adminId, 'create_match', matchInput(overrides));
  return rows[0].create_match;
}

/** Inscribe jugadores directo en la tabla (como superusuario), en orden. */
export async function addPlayers(db: Db, matchId: string, userIds: string[]): Promise<void> {
  for (const id of userIds) {
    await db.query('insert into public.match_players (match_id, user_id) values ($1, $2)', [matchId, id]);
  }
}

/** Mueve el partido en el tiempo (como superusuario) para simular que ya empezó/terminó. */
export async function shiftMatch(db: Db, matchId: string, startsInHours: number, durationHours = 1): Promise<void> {
  const start = new Date(Date.now() + startsInHours * HOUR);
  await db.query(
    `update public.matches set starts_at = $2, ends_at = $3, signup_deadline = $2 where id = $1`,
    [matchId, start.toISOString(), new Date(start.getTime() + durationHours * HOUR).toISOString()],
  );
}

export type MatchView = {
  match: Record<string, unknown> & { id: string; invite_code: string; starters_count: number; location: string };
  players_count: number;
  roster: Array<{
    user_id: string;
    position: number;
    is_starter: boolean;
    team: string | null;
    display_name: string;
    is_admin: boolean;
    is_me: boolean;
    phone: string | null;
  }>;
  viewer: {
    is_admin: boolean;
    is_participant: boolean;
    is_system_admin: boolean;
    position: number | null;
    is_starter: boolean;
    can_duplicate: boolean;
  };
};

export async function viewMatch(db: Db, userId: string, args: { p_match_id?: string; p_invite_code?: string }) {
  const rows = await rpc<{ get_match_view: MatchView }>(db, userId, 'get_match_view', args);
  return rows[0].get_match_view;
}
