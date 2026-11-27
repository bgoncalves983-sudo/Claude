import { api } from "../api";

export type EstadoPush = "nao-suportado" | "bloqueado" | "inativo" | "ativo";

const suportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const paraBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export async function estadoPush(): Promise<EstadoPush> {
  if (!suportado()) return "nao-suportado";
  if (Notification.permission === "denied") return "bloqueado";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "ativo" : "inativo";
  } catch { return "inativo"; }
}

export async function ativarPush(): Promise<void> {
  const { chave } = await api<{ chave: string | null }>("/push/chave");
  if (!chave) throw new Error("As notificações ainda não estão configuradas no servidor.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Autorização recusada. Pode permitir nas definições do browser.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) }));
  await api("/push/subscrever", { metodo: "POST", corpo: sub.toJSON() });
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api("/push/remover", { metodo: "POST", corpo: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
