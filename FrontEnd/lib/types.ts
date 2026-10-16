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
  };
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
