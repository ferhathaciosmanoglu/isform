/* ENORPA — Cloudflare Worker: AI proxy
   Tarayıcıdan gelen Gemini isteklerini, API anahtarını sunucuda tutarak Google'a iletir (anahtar tarayıcıya inmez).
   Kullanıcı kimliği Supabase oturum belirteci (JWT) ile doğrulanır; yalnızca profiller tablosunda aktif rolü olanlar kullanır.
   Kurulum: README.md → "AI proxy (Cloudflare Worker)". */
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/";
const GOVDE_SINIRI = 4 * 1024 * 1024;   // uygulamanın en büyük isteği (fotoğraf okuma) ~1 MB
/* Yalnızca uygulamanın kullandığı Gemini yöntemlerine izin verilir */
const YOL_IZIN = /^models(\?pageSize=\d{1,3})?$|^models\/[A-Za-z0-9.-]+:(generateContent|streamGenerateContent|batchEmbedContents|embedContent)(\?alt=sse)?$/;

class HttpHata extends Error { constructor(kod, mesaj) { super(mesaj); this.kod = kod; } }

function corsBasliklari(istek, env) {
  const origin = istek.headers.get("Origin") || "";
  const izinli = String(env.IZINLI_ORIGINLER || "").split(",").map(s => s.trim()).filter(Boolean);
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

export default {
  async fetch(istek, env) {
    const cors = corsBasliklari(istek, env);
    const yanit = (kod, govde) => new Response(JSON.stringify(govde), { status: kod, headers: { "Content-Type": "application/json", ...cors } });
    if (istek.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (istek.method !== "GET" && istek.method !== "POST") throw new HttpHata(405, "Yöntem desteklenmiyor");
      const url = new URL(istek.url), yol = url.pathname.replace(/^\/+/, "") + url.search;
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
