// Verificacao do conteudo real dos ficheiros (os primeiros bytes), sem confiar no tipo declarado pelo cliente.
export type TipoReal = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export function tipoReal(b: Uint8Array): TipoReal | null {
  if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp"; // RIFF....WEBP
  return null;
}
export async function ler(f: File, n = 16): Promise<Uint8Array> {
  return new Uint8Array(await f.slice(0, n).arrayBuffer());
}
