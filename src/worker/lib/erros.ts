/** Deteta violacao de UNIQUE, mesmo quando o Drizzle embrulha o erro original em `cause`. */
export function eUnico(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; i++, x = (x as { cause?: unknown }).cause) {
    if (String((x as Error).message ?? x).includes("UNIQUE constraint failed")) return true;
  }
  return false;
}
