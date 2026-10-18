/** Tipos de lo que devuelven las RPC de Postgres (ver BackEnd/supabase/migrations). */

export type MatchStatus = "open" | "cancelled";

export type Match = {
  id: string;
  invite_code: string;
  location: string;
  starts_at: string;
  ends_at: string;
  starters_count: number;
  field_cost: number;
  signup_deadline: string;
  status: MatchStatus;
  cancelled_at: string | null;
  team_a_goals: number | null;
  team_b_goals: number | null;
  result_loaded_at: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
};

export type RosterEntry = {
  user_id: string;
  position: number;
  is_starter: boolean;
  team: "A" | "B" | null;
  display_name: string;
  is_admin: boolean;
  is_me: boolean;
  /** Solo viene para el admin del partido y los admins del sistema. */
  phone: string | null;
};

export type MatchView = {
  match: Match;
  players_count: number;
  roster: RosterEntry[];
  viewer: {
    is_admin: boolean;
    is_participant: boolean;
    is_system_admin: boolean;
    position: number | null;
    is_starter: boolean;
    can_duplicate: boolean;
    /** La base decide si se puede cancelar (regla de la lista completa). */
    can_cancel: boolean;
    /** Por qué no se puede cancelar (solo para el admin o el admin del sistema). */
    cancel_block_reason: string | null;
  };
};

/** Lo de después del partido (get_match_post). Nunca trae conteos de votos. */
export type MatchPost = {
  result: { loaded: boolean; team_a_goals: number | null; team_b_goals: number | null };
  scorers: Array<{ user_id: string; display_name: string; team: "A" | "B" | null; goals: number }>;
  voting: {
    opens_at: string;
    closes_at: string;
    is_open: boolean;
    is_closed: boolean;
    is_starter: boolean;
    has_voted: boolean;
    can_vote: boolean;
    candidates: Array<{ user_id: string; display_name: string; team: "A" | "B" | null }>;
  };
  /** null mientras la votación no cerró; [] si nadie votó; varios si hay empate. */
  mvp: Array<{ user_id: string; display_name: string }> | null;
};

/** Un partido de mi historial (my_history): solo donde fui titular. */
export type HistoryMatch = {
  id: string;
  location: string;
  starts_at: string;
  ends_at: string;
  my_team: "A" | "B" | null;
  result: { loaded: boolean; team_a_goals: number | null; team_b_goals: number | null };
  teams: { A: string[]; B: string[] };
  team_names: { A: string | null; B: string | null };
  scorers: Array<{ display_name: string; team: "A" | "B" | null; goals: number }>;
  /** null mientras la votación sigue abierta; [] si nadie votó. */
  mvp: Array<{ display_name: string }> | null;
};

export type MyMatch = {
  id: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: MatchStatus;
  starters_count: number;
  players_count: number;
  my_position: number | null;
  is_admin: boolean;
  team_a_goals: number | null;
  team_b_goals: number | null;
};

export type AdminMatch = {
  id: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: MatchStatus;
  starters_count: number;
  players_count: number;
  admin_name: string | null;
  team_a_goals: number | null;
  team_b_goals: number | null;
};
