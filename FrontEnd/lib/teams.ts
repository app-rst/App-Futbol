export type Team = "A" | "B";
export type TeamNames = { A: string | null; B: string | null };

/** Nombres de equipo de un partido (null = sin nombre). */
export function teamNamesOf(m: { team_a_name: string | null; team_b_name: string | null }): TeamNames {
  return { A: m.team_a_name, B: m.team_b_name };
}

/** Nombre a mostrar: el que puso el admin o, si no puso, "Equipo A" / "Equipo B". */
export function teamLabel(names: TeamNames | undefined, team: Team): string {
  return names?.[team] ?? `Equipo ${team}`;
}
