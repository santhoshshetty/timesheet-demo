/** Escapes LIKE wildcards so a term is matched literally with `ILIKE … ESCAPE '\'`. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
