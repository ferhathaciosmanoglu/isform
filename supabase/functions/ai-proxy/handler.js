/* ENORPA — Supabase Edge Function (ai-proxy)
   1) AI proxy (/models/...): tarayıcıdan gelen Gemini isteklerini, API anahtarını sunucuda tutarak Google'a iletir.
      Kullanıcı kimliği Supabase oturum belirteci (JWT) ile doğrulanır; yalnızca profiller tablosunda aktif rolü olanlar kullanır.
   2) Sesli asistan (POST /asistan): Siri Kestirmeleri / Android otomasyonları için tek uçlu soru-cevap.
   Adres: https://<proje>.supabase.co/functions/v1/ai-proxy/…   Kurulum: README.md → "AI proxy ve sesli asistan". */
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/";
const GOVDE_SINIRI = 4 * 1024 * 1024;   // uygulamanın en büyük isteği (fotoğraf okuma) ~1 MB
/* Yalnızca uygulamanın kullandığı Gemini yöntemlerine izin verilir */
const YOL_IZIN = /^models(\?pageSize=\d{1,3})?$|^models\/[A-Za-z0-9.-]+:(generateContent|streamGenerateContent|batchEmbedContents|embedContent)(\?alt=sse)?$/;

/* IZINLI_ORIGINLER sırrı verilmezse bu adresler (yayın sitesi ve yerel geliştirme) CORS için izinlidir */
const VARSAYILAN_ORIGINLER = "https://ferhathaciosmanoglu.github.io,http://localhost:5173";

class HttpHata extends Error { constructor(kod, mesaj) { super(mesaj); this.kod = kod; } }

function corsBasliklari(istek, env) {
  const origin = istek.headers.get("Origin") || "";
  const izinli = String(env.IZINLI_ORIGINLER || VARSAYILAN_ORIGINLER).split(",").map(s => s.trim()).filter(Boolean);
  const h = { "Vary": "Origin" };
  if (origin && izinli.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Max-Age"] = "3600";
  }
  return h;
}

/* Basit hız sınırı (isolate başına, kullanıcı başına dakikada 60 istek); kontrolsüz tüketimi keser */
const kovalar = new Map();
function hizSiniri(anahtar, limit = 60) {
  const dk = Math.floor(Date.now() / 60000), k = kovalar.get(anahtar);
  if (!k || k.dk !== dk) { kovalar.set(anahtar, { dk, n: 1 }); if (kovalar.size > 5000) kovalar.clear(); return; }
  if (++k.n > limit) throw new HttpHata(429, "Çok fazla istek, biraz bekleyin");
}

async function kullaniciDogrula(istek, env) {
  const m = /^Bearer (.+)$/.exec(istek.headers.get("Authorization") || "");
  if (!m) throw new HttpHata(401, "Kimlik bilgisi yok");
  const baslik = { Authorization: "Bearer " + m[1], apikey: env.SUPABASE_ANON_KEY };
  const k = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: baslik });
  if (!k.ok) throw new HttpHata(401, "Geçersiz oturum");
  const mail = String((await k.json()).email || "").toLowerCase();
  if (!mail) throw new HttpHata(403, "E-posta doğrulanamadı");
  // Kullanıcının kendi belirteciyle sorgulanır: RLS yalnızca kendi satırını gösterir
  const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiller?select=rol,aktif&eposta=eq.${encodeURIComponent(mail)}`, { headers: baslik });
  const satir = p.ok ? (await p.json())[0] : null;
  if (!satir || satir.aktif !== true) throw new HttpHata(403, "Yetkilendirilmemiş hesap");
  return mail;
}

/* ---------- 2) Siri / Android sesli asistan ---------- */
const MODELLER = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-3.5-flash"];
const SISTEM = "Sen bir teknik servis firmasının sesli yardımcısısın. Türkçe, kısa ve konuşma diliyle cevap ver; madde işareti, yıldız veya başlık kullanma. Yalnızca verilen servis kayıtlarına dayan, kayıtta olmayan bilgiyi asla uydurma; bilmiyorsan 'Kayıtlarda bulamadım' de.";

function guvenliKarsilastir(a, b) {
  if (a.length !== b.length) return false;
  let fark = 0; for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

/* SHORTCUT_TOKEN birden çok kişiye ayrı anahtar verilebilsin diye "etiket:anahtar,etiket:anahtar" biçimindedir
   (tek anahtar biçimi de çalışır). Bir kişinin telefonu kaybolursa yalnızca onun anahtarı çıkarılır. */
function anahtarSahibi(gelen, env) {
  if (!gelen) return null;
  for (const parca of String(env.SHORTCUT_TOKEN || "").split(",").map(x => x.trim()).filter(Boolean)) {
    const i = parca.indexOf(":"), etiket = i > 0 ? parca.slice(0, i) : "varsayilan", anahtar = i > 0 ? parca.slice(i + 1) : parca;
    if (anahtar.length >= 24 && guvenliKarsilastir(gelen, anahtar)) return etiket;
  }
  return null;
}

async function geminiSor(istem, env) {
  let son;
  for (const md of MODELLER) {
    const r = await fetch(`${GEMINI}models/${md}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SISTEM }] }, contents: [{ role: "user", parts: [{ text: istem }] }], generationConfig: { temperature: 0.2 } })
    });
    if (r.ok) {
      const j = await r.json();
      const t = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || "").join("").trim();
      if (t) return t;
      son = new HttpHata(502, "Boş yanıt geldi");
    } else if (r.status === 404 || r.status === 429) { son = new HttpHata(r.status === 429 ? 429 : 502, "Model şu an kullanılamıyor"); }
    else throw new HttpHata(502, `Gemini hatası ${r.status}`);
  }
  throw son || new HttpHata(502, "Yanıt alınamadı");
}

/* Veritabanı işlevleri yalnızca service_role ile çağrılabilir (supabase/migrations/..._asistan_fonksiyonlari.sql) */
const rpc = (env, ad, govde) => fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${ad}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
  body: JSON.stringify(govde)
});

async function asistan(istek, env, url) {
  if (istek.method !== "POST") throw new HttpHata(405, "POST kullanın");
  const sahip = anahtarSahibi(istek.headers.get("x-asistan-anahtari") || "", env);
  if (!sahip) throw new HttpHata(401, "Yetkisiz");
  hizSiniri("asistan:" + sahip, 30);
  let govde = {}; try { govde = await istek.json(); } catch { /* boş gövde */ }
  const soru = String((govde && govde.soru) || url.searchParams.get("soru") || "").trim().slice(0, 500);
  if (!soru) throw new HttpHata(400, "Soru boş");

  /* v1: son 200 kayıt bağlam olarak verilir (fotoğraf, vektör, form verisi indirilmez) */
  const r = await rpc(env, "asistan_son_kayitlar", { p_adet: 200 });
  if (!r.ok) throw new HttpHata(502, "Kayıtlar okunamadı");
  const satirlar = (await r.json()).map(x => [String(x.tarih || "").slice(0, 10), x.firma_adi || "", x.sehir || "", x.islem_tipi || "", String(x.aciklama || "").replace(/\s+/g, " ").slice(0, 160)].join(" | "));
  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });   // YYYY-MM-DD, Türkiye saatiyle
  const cevap = await geminiSor(`Bugün: ${bugun}\nServis kayıtları (tarih | firma | şehir | işlem | açıklama), yeniden eskiye:\n${satirlar.join("\n")}\n\nSoru: ${soru}`, env);
  await rpc(env, "asistan_logla", { p_kim: "asistan:" + sahip, p_detay: soru.slice(0, 200) }).catch(() => {});
  return url.searchParams.get("format") === "text"
    ? new Response(cevap, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
    : new Response(JSON.stringify({ cevap }), { headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(istek, env) {
    const cors = corsBasliklari(istek, env);
    const yanit = (kod, govde) => new Response(JSON.stringify(govde), { status: kod, headers: { "Content-Type": "application/json", ...cors } });
    if (istek.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (istek.method !== "GET" && istek.method !== "POST") throw new HttpHata(405, "Yöntem desteklenmiyor");
      const url = new URL(istek.url);
      /* Edge Function adresindeki önek ("/functions/v1/ai-proxy" ya da "/ai-proxy") atılır: geriye "models/…" ya da "asistan" kalır */
      const alt = url.pathname.replace(/^\/(functions\/v1\/)?ai-proxy(?=\/|$)/, "").replace(/^\/+/, ""), yol = alt + url.search;
      if (alt === "asistan") return await asistan(istek, env, url);   // Siri/Android: tarayıcı değil, CORS gerekmez
      if (!YOL_IZIN.test(yol)) throw new HttpHata(404, "Bu yola izin verilmiyor");
      const mail = await kullaniciDogrula(istek, env);
      hizSiniri(mail);
      const govde = istek.method === "POST" ? await istek.text() : undefined;
      if (govde && govde.length > GOVDE_SINIRI) throw new HttpHata(413, "İstek çok büyük");
      const r = await fetch(GEMINI + yol, { method: istek.method, headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: govde });
      const h = new Headers(cors); h.set("Content-Type", r.headers.get("content-type") || "application/json");
      return new Response(r.body, { status: r.status, headers: h });   // akışlı (SSE) yanıtlar da aynen geçer
    } catch (e) {
      if (!(e instanceof HttpHata)) console.error(e);
      return yanit(e instanceof HttpHata ? e.kod : 500, { error: { message: e instanceof HttpHata ? e.message : "Sunucu hatası" } });
    }
  }
};
