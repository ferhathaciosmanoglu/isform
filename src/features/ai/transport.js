import { auth } from "../../veri/init.js";
import { supabaseUrl } from "../../veri/config.js";

/* Gemini isteklerinin tek çıkış noktası.
   İstekler Supabase Edge Function'ı (supabase/functions/ai-proxy) üzerinden gider: API anahtarı yalnızca sunucuda durur,
   tarayıcıya hiç inmez. Kullanıcı kimliği Supabase oturum belirteci (JWT) ile doğrulanır. Başka bir proxy için
   VITE_AI_PROXY_URL verilebilir. */
const PROXY = String((import.meta.env && import.meta.env.VITE_AI_PROXY_URL) || supabaseUrl + "/functions/v1/ai-proxy").replace(/\/+$/, "");
const DOGRUDAN = "https://generativelanguage.googleapis.com/v1beta/";

export const proxyAktif = () => !!PROXY;

/* yol: "models/gemini-x:generateContent" gibi, v1beta/ sonrası kısım */
export async function aiFetch(yol, { method = "GET", body, anahtar } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (PROXY) {
    const kullanici = auth.currentUser;
    if (!kullanici) throw new Error("AI için önce giriş yapın");
    headers.Authorization = "Bearer " + await kullanici.getIdToken();
    return fetch(`${PROXY}/${yol}`, { method, headers, body });
  }
  headers["x-goog-api-key"] = anahtar;
  return fetch(DOGRUDAN + yol, { method, headers, body });
}
