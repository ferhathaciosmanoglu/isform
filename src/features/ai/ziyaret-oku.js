import { AiHata, aiAnahtarHazirla, gemini } from "./gemini.js";
import { AI_PROMPT, AI_SEMA } from "./prompts.js";
import { aiZiyaret } from "../../lib/ziyaret.js";

/* Form fotoğrafından (data: URL) ENORPA personelini ve ziyaret tarihini okur. Yan etkisi yoktur (DOM'a dokunmaz). */
export async function ziyaretFotodanOku(src, { yeniden = true } = {}) {
  if (!String(src).startsWith("data:")) return null;
  const parts = [{ inlineData: { mimeType: src.slice(5, src.indexOf(";")), data: src.split(",")[1] } }, { text: AI_PROMPT.ziyaretOku }];
  for (let deneme = 0; ; deneme++) {
    try { return await gemini(parts, { json: true, sema: AI_SEMA.ziyaret, sistem: AI_PROMPT.sistem }); }
    catch (e) {
      if (!yeniden || !(e instanceof AiHata) || !(e.bekle > 0) || deneme >= 1) throw e;   // kota dolduysa bir kez bekleyip yeniden dener
      await new Promise(r => setTimeout(r, Math.min(e.bekle, 90) * 1000 + 500));
    }
  }
}

/* Kayıt anında çağrılır: { ziyaret } döner; çevrimdışı, anahtar yok, kota dolu veya süre aşımında {} (kayıt yine yapılır,
   yönetici daha sonra "Ziyaretleri AI ile oku" ile tamamlar). Anahtar sorma penceresi açmaz. */
export async function ziyaretHazirla(src, tarihIso, sureMs = 15000) {
  if (!navigator.onLine) return {};
  try {
    if (!(await aiAnahtarHazirla(false, true))) return {};
    const c = await Promise.race([ziyaretFotodanOku(src, { yeniden: false }), new Promise((_, rej) => setTimeout(() => rej(new Error("zaman aşımı")), sureMs))]);
    if (!c) return {};
    return { ziyaret: c.okundu === false ? { personel: [], tarih: "", kaynak: "ai", surum: 1 } : aiZiyaret(c, String(tarihIso || "").slice(0, 10)) };
  } catch (e) { console.warn("Ziyaret okunamadı:", e.message); return {}; }
}
