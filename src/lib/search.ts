/** Escape LIKE wildcards in user input. Pure. */
export function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Trims, drops a leading @, collapses spaces and caps length. Pure. */
export function cleanQuery(q: string | null | undefined) {
  return (q ?? "").replace(/\s+/g, " ").trim().replace(/^@/, "").slice(0, 80);
}
