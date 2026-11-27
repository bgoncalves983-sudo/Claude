// Gera o par de chaves das notificacoes push (VAPID). Uso: node scripts/gerar-vapid.mjs
import { generateKeyPairSync } from "node:crypto";
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const j = privateKey.export({ format: "jwk" });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, "base64url"), Buffer.from(j.y, "base64url")]).toString("base64url");
console.log("VAPID_PUBLIC_KEY  (vai para o wrangler.jsonc, em vars; nao e segredo):\n" + pub + "\n");
console.log("VAPID_PRIVATE_KEY (SEGREDO: guardar no cofre e colar em 'npx wrangler secret put VAPID_PRIVATE_KEY'; nao partilhar):\n" + j.d);
