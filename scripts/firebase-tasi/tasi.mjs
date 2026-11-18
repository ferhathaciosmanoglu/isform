/* Firestore → Supabase veri taşıma (tek seferlik, tekrar çalıştırılabilir: kayıtlar kimliğiyle upsert edilir).
   Kullanım ve gereken ortam değişkenleri: scripts/firebase-tasi/README.md */
import fs from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { firmaSatiri, formSatiri, gecmisSatiri, gorselSatiri, kodSatiri, personelSatiri, profilSatiri, sayacSatiri, sayaclariTamamla } from "./donustur.mjs";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const args = new Set(process.argv.slice(2));
const KURU = args.has("--kuru"), GECMIS = args.has("--gecmis");
const { GOOGLE_APPLICATION_CREDENTIALS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!GOOGLE_APPLICATION_CREDENTIALS || !fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)) throw new Error("GOOGLE_APPLICATION_CREDENTIALS (hizmet hesabı JSON dosyası) gerekli");
if (!KURU && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) throw new Error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (kuru çalıştırma için gerekmez)");

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(GOOGLE_APPLICATION_CREDENTIALS, "utf8"))) });
const fs_ = admin.firestore();
const sb = KURU ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(...a);

async function oku(ad, f, sayfa = 300) {   // büyük koleksiyonlar (fotoğraflar) belleğe topluca alınmaz
  let son = null, n = 0;
  for (;;) {
    let q = fs_.collection(ad).orderBy(admin.firestore.FieldPath.documentId()).limit(sayfa);
    if (son) q = q.startAfter(son);
    const snap = await q.get();
    if (snap.empty) break;
    await f(snap.docs); n += snap.size; son = snap.docs[snap.docs.length - 1];
    if (snap.size < sayfa) break;
  }
  return n;
}
async function yaz(tablo, satirlar, cakisma) {
  if (KURU || !satirlar.length) return;
  for (let i = 0; i < satirlar.length; i += 200) {
    const { error } = await sb.from(tablo).upsert(satirlar.slice(i, i + 200), { onConflict: cakisma });
    if (error) throw new Error(`${tablo}: ${error.message}`);
  }
}
async function yukle(dosya) {
  if (KURU) return;
  const { error } = await sb.storage.from("form-fotograflari").upload(dosya.yol, dosya.veri, { contentType: dosya.tip, upsert: true });
  if (error) throw new Error(`Storage ${dosya.yol}: ${error.message}`);
}

const ozet = { uyari: 0 };
try {
  log(KURU ? "KURU ÇALIŞTIRMA (hiçbir şey yazılmayacak)" : "Taşıma başlıyor…");

  ozet.profiller = await oku("kullanicilar", async d => yaz("profiller", d.map(x => profilSatiri(x.id, x.data())), "eposta")); log("kullanıcılar:", ozet.profiller);
  ozet.personel = await oku("personel", async d => yaz("personel", d.map(x => personelSatiri(x.id, x.data())), "id")); log("personel:", ozet.personel);
  ozet.firmalar = await oku("firmalar", async d => yaz("firmalar", d.map(x => firmaSatiri(x.id, x.data())), "arama_firma")); log("firma kartları:", ozet.firmalar);

  const varOlan = new Set(); let gorselAtlanan = 0;
  ozet.gorseller = await oku("formFotograflari", async d => {
    const satirlar = [];
    for (const x of d) {
      const g = gorselSatiri(x.id, x.data());
      if (!g) { gorselAtlanan++; continue; }
      if (g.dosya) await yukle(g.dosya);
      satirlar.push(g.satir); varOlan.add(x.id);
    }
    await yaz("form_gorselleri", satirlar, "id");
    process.stdout.write(`\rgörseller: ${varOlan.size}`);
  }, 40);
  log(`\rgörseller: ${varOlan.size} taşındı, ${gorselAtlanan} bozuk/boş atlandı`);

  const formSatirlari = [];
  ozet.formlar = await oku("formlar", async d => {
    const satirlar = [], ekGorsel = [];
    for (const x of d) {
      const { satir, uyarilar, gomulu } = formSatiri(x.id, x.data(), varOlan);
      uyarilar.forEach(u => { ozet.uyari++; log(`  uyarı [${x.id}]: ${u}`); });
      for (const [tur, veri] of Object.entries(gomulu)) {   // eski kayıtlarda belgeye gömülü fotoğraf/imza: ayrı görsel olarak taşı
        const gid = `${x.id}_${tur}`, g = gorselSatiri(gid, veri);
        if (!g) continue;
        if (g.dosya) await yukle(g.dosya);
        ekGorsel.push(g.satir); varOlan.add(gid);
        if (tur === "foto") satir.foto_id = gid; else satir.imza_id = gid;
      }
      satirlar.push(satir); formSatirlari.push(satir);
    }
    await yaz("form_gorselleri", ekGorsel, "id");
    await yaz("formlar", satirlar, "id");
    process.stdout.write(`\rformlar: ${formSatirlari.length}`);
  }, 200);
  log(`\rformlar: ${ozet.formlar}`);

  const sayaclar = [], kodlar = [];
  await oku("sayaclar", async d => d.forEach(x => sayaclar.push(sayacSatiri(x.id, x.data()))));
  await oku("firmaKodlari", async d => d.forEach(x => kodlar.push(kodSatiri(x.id, x.data()))));
  const t = sayaclariTamamla(sayaclar, formSatirlari, kodlar);
  await yaz("firma_kodlari", t.kodlar, "kod"); await yaz("sayaclar", t.sayaclar, "arama_firma");
  log(`sayaçlar: ${t.sayaclar.length}, firma kodları: ${t.kodlar.length}`);

  if (GECMIS) { ozet.gecmis = 0; await oku("islemGecmisi", async d => { ozet.gecmis += d.length; if (!KURU) { const { error } = await sb.from("islem_gecmisi").insert(d.map(x => gecmisSatiri(x.data()))); if (error) throw new Error("islem_gecmisi: " + error.message); } }, 400); log("işlem geçmişi:", ozet.gecmis); }

  log(`\n${KURU ? "Kuru çalıştırma" : "Taşıma"} bitti.`, JSON.stringify(ozet));
  if (!KURU) log("Not: işlem geçmişi tekrar çalıştırmada çoğalır; --gecmis yalnızca bir kez kullanın.");
} catch (e) { console.error("\nHATA:", e.message); process.exitCode = 1; }
