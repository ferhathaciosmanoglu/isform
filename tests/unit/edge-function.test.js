import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../supabase/functions/ai-proxy/handler.js";

const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "servis", GEMINI_API_KEY: "gk",
  SHORTCUT_TOKEN: "ali:" + "a".repeat(24) + ",b".repeat(1) + "x".repeat(0), IZINLI_ORIGINLER: "https://site.pages.dev" };
env.SHORTCUT_TOKEN = "ali:" + "a".repeat(24) + ",ayse:" + "b".repeat(24);

/* Sahte ağ: Supabase (kullanıcı, profil, RPC) ve Gemini */
function sahteAg({ aktif = true, kullanici = true } = {}) {
  const cagrilar = [];
  globalThis.fetch = async (url, init = {}) => {
    cagrilar.push({ url: String(url), init });
    const u = String(url);
    if (u.endsWith("/auth/v1/user")) return kullanici ? Response.json({ email: "Ali@Enorpa.com" }) : new Response("{}", { status: 401 });
    if (u.includes("/rest/v1/profiller")) return Response.json(aktif ? [{ rol: "duzenleyen", aktif: true }] : []);
    if (u.endsWith("/rpc/asistan_son_kayitlar")) return Response.json([{ tarih: "2026-10-01T09:00:00Z", firma_adi: "Örnek Tarım", sehir: "antalya", islem_tipi: "Bakım", aciklama: "Kazan  basıncı\ndüşük" }]);
    if (u.endsWith("/rpc/asistan_logla")) return new Response(null, { status: 204 });
    if (u.startsWith("https://generativelanguage.googleapis.com/")) return Response.json({ candidates: [{ content: { parts: [{ text: "Örnek Tarım'a bir kez bakıma gidilmiş." }] } }] });
    throw new Error("beklenmeyen istek: " + u);
  };
  return cagrilar;
}
const ist = (yol, { yontem = "POST", baslik = {}, govde } = {}) => new Request("https://w.example" + yol, { method: yontem, headers: baslik, body: govde });

test("proxy: oturumsuz istek 401", async () => {
  sahteAg();
  const r = await worker.fetch(ist("/models/gemini-3.1-flash-lite:generateContent", { govde: "{}" }), env);
  assert.equal(r.status, 401);
});

test("proxy: geçersiz belirteç 401, yetkisiz hesap 403", async () => {
  sahteAg({ kullanici: false });
  assert.equal((await worker.fetch(ist("/models/m:generateContent", { baslik: { Authorization: "Bearer x" }, govde: "{}" }), env)).status, 401);
  sahteAg({ aktif: false });
  assert.equal((await worker.fetch(ist("/models/m:generateContent", { baslik: { Authorization: "Bearer x" }, govde: "{}" }), env)).status, 403);
});

test("proxy: yetkili kullanıcı Gemini'ye anahtar sunucuda eklenerek iletilir", async () => {
  const c = sahteAg();
  const r = await worker.fetch(ist("/models/gemini-3.1-flash-lite:generateContent", { baslik: { Authorization: "Bearer jwt", Origin: "https://site.pages.dev" }, govde: '{"a":1}' }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://site.pages.dev");
  const g = c.find(x => x.url.startsWith("https://generativelanguage"));
  assert.equal(g.init.headers["x-goog-api-key"], "gk"); assert.equal(g.init.body, '{"a":1}');
});

test("proxy: izinsiz yol 404, izinsiz origin için CORS başlığı yok", async () => {
  sahteAg();
  assert.equal((await worker.fetch(ist("/admin", { baslik: { Authorization: "Bearer jwt" }, govde: "{}" }), env)).status, 404);
  const r = await worker.fetch(ist("/models", { yontem: "OPTIONS", baslik: { Origin: "https://kotu.example" } }), env);
  assert.equal(r.status, 204); assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

test("asistan: anahtarsız 401, yanlış anahtar 401, GET 405", async () => {
  sahteAg();
  assert.equal((await worker.fetch(ist("/asistan", { govde: '{"soru":"x"}' }), env)).status, 401);
  assert.equal((await worker.fetch(ist("/asistan", { baslik: { "x-asistan-anahtari": "c".repeat(24) }, govde: '{"soru":"x"}' }), env)).status, 401);
  assert.equal((await worker.fetch(ist("/asistan", { yontem: "GET" }), env)).status, 405);
});

test("asistan: doğru anahtarla cevap döner, kayıtlar bağlama girer, işlem geçmişine yazılır", async () => {
  const c = sahteAg();
  const r = await worker.fetch(ist("/asistan?format=text", { baslik: { "x-asistan-anahtari": "b".repeat(24) }, govde: '{"soru":"Örnek Tarım\'a kaç kez gidildi?"}' }), env);
  assert.equal(r.status, 200); assert.match(await r.text(), /bir kez/);
  const g = JSON.parse(c.find(x => x.url.startsWith("https://generativelanguage")).init.body);
  assert.match(g.contents[0].parts[0].text, /Örnek Tarım \| antalya \| Bakım \| Kazan basıncı düşük/);
  const log = c.find(x => x.url.endsWith("/rpc/asistan_logla"));
  assert.equal(JSON.parse(log.init.body).p_kim, "asistan:ayse");
  assert.equal(log.init.headers.Authorization, "Bearer servis");
});

test("asistan: boş soru 400", async () => {
  sahteAg();
  assert.equal((await worker.fetch(ist("/asistan", { baslik: { "x-asistan-anahtari": "a".repeat(24) }, govde: "{}" }), env)).status, 400);
});

test("Edge Function adres öneki (/functions/v1/ai-proxy ve /ai-proxy) atılır", async () => {
  const c = sahteAg();
  for (const on of ["/functions/v1/ai-proxy", "/ai-proxy"]) {
    const r = await worker.fetch(ist(on + "/models/gemini-3.1-flash-lite:generateContent", { baslik: { Authorization: "Bearer jwt" }, govde: "{}" }), env);
    assert.equal(r.status, 200);
  }
  assert.ok(c.some(x => x.url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"));
  const a = await worker.fetch(ist("/functions/v1/ai-proxy/asistan?format=text", { baslik: { "x-asistan-anahtari": "a".repeat(24) }, govde: '{"soru":"x"}' }), env);
  assert.equal(a.status, 200);
});

test("IZINLI_ORIGINLER verilmezse yayın sitesi varsayılan olarak izinlidir", async () => {
  sahteAg();
  const e = { ...env }; delete e.IZINLI_ORIGINLER;
  const r = await worker.fetch(ist("/models", { yontem: "OPTIONS", baslik: { Origin: "https://ferhathaciosmanoglu.github.io" } }), e);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://ferhathaciosmanoglu.github.io");
  const k = await worker.fetch(ist("/models", { yontem: "OPTIONS", baslik: { Origin: "https://kotu.example" } }), e);
  assert.equal(k.headers.get("Access-Control-Allow-Origin"), null);
});
