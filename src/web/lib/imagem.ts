/** Reduz uma fotografia do telemovel (3-8 MB) para JPEG de ~200-400 KB. O JPEG gerado nao leva a localizacao GPS da foto original. */
export async function reduzir(ficheiro: File, maxLado: number, qualidade = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Nao foi possivel reduzir a imagem"))), "image/jpeg", qualidade));
}
