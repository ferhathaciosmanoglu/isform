import { AiHata, aiAnahtarHazirla, gemini } from "./gemini.js";
import { AI_PROMPT, AI_SEMA } from "./prompts.js";
import { aiZiyaret, okunamadi } from "../../lib/ziyaret.js";
import { VARSAYILAN_PERSONEL } from "../../lib/personel-varsayilan.js";

/* Uygulamadaki personel listesi (personel.js önbelleğe yazar); yoksa varsayılan liste */
export function bilinenPersonel() {
  try { const l = JSON.parse(localStorage.getItem("personel_listesi") || "[]").map(x => x && x.ad).filter(Boolean); if (l.length) return l; } catch { /* yok */ }
  return [...VARSAYILAN_PERSONEL];
}

/* Form fotoğrafından (data: URL) ENORPA personelini ve ziyaret tarihini okur. Yan etkisi yoktur (DOM'a dokunmaz).
   yeniden: kota dolunca / Google yoğunken (503) kaç kez bekleyip yeniden denensin */
export async function ziyaretFotodanOku(src, { yeniden = 3, liste = bilinenPersonel() } = {}) {
  if (!String(src).startsWith("data:")) return null;
  const parts = [{ inlineData: { mimeType: src.slice(5, src.indexOf(";")), data: src.split(",")[1] } }, { text: AI_PROMPT.ziyaretOku(liste) }];
  for (let deneme = 0; ; deneme++) {
    try { return await gemini(parts, { json: true, sema: AI_SEMA.ziyaret, sistem: AI_PROMPT.sistem }); }
    catch (e) {
      if (!(e instanceof AiHata) || !(e.bekle > 0) || deneme >= yeniden) throw e;
      await new Promise(r => setTimeout(r, Math.min(e.bekle * (deneme + 1), 120) * 1000 + 500));
    }
  }
}

/* Kayıt anında çağrılır: { ziyaret } döner; çevrimdışı, anahtar yok, kota dolu veya süre aşımında {} (kayıt yine yapılır,
   yönetici daha sonra "Ziyaretleri AI ile oku" ile tamamlar). Anahtar sorma penceresi açmaz. */
export async function ziyaretHazirla(src, tarihIso, sureMs = 15000) {
  if (!navigator.onLine) return {};
  try {
    if (!(await aiAnahtarHazirla(false, true))) return {};
    const liste = bilinenPersonel();
    const c = await Promise.race([ziyaretFotodanOku(src, { yeniden: 0, liste }), new Promise((_, rej) => setTimeout(() => rej(new Error("zaman aşımı")), sureMs))]);
    if (!c) return {};
    return { ziyaret: c.okundu === false ? okunamadi() : aiZiyaret(c, String(tarihIso || "").slice(0, 10), liste) };
  } catch (e) { console.warn("Ziyaret okunamadı:", e.message); return {}; }
}
