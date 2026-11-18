/* Firestore belgelerini Supabase satırlarına çeviren SAF işlevler (ağ yok; tests/unit/tasi-donustur.test.js ile test edilir). */

const gecerliTarih = t => typeof t === "string" && t.length >= 10 && !Number.isNaN(Date.parse(t));
const kes = (x, n) => (x === undefined || x === null ? null : String(x).slice(0, n));
const metinOrNull = x => (x === undefined || x === null || x === "" ? null : String(x));
export const koddanNo = kod => { const m = String(kod || "").match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };

/* data:image/jpeg;base64,... → { tip, uzanti, veri: Buffer } ; geçersizse null */
export function veriUrlCoz(s) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(s || ""));
  if (!m) return null;
  return { tip: m[1], uzanti: m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg", veri: Buffer.from(m[2], "base64") };
}

export const profilSatiri = (id, v) => ({ eposta: String(id).toLowerCase(), rol: ["yonetici", "duzenleyen", "goruntuleyen"].includes(v.rol) ? v.rol : "goruntuleyen", aktif: v.aktif === true, guncelleyen: metinOrNull(v.guncelleyen) });

export const personelSatiri = (id, v) => ({ id, ad: String(v.ad || "").slice(0, 100), ad_norm: metinOrNull(v.adNorm), aktif: v.aktif !== false, ekleyen: metinOrNull(v.ekleyen), eklenme: gecerliTarih(v.eklenme) ? v.eklenme : new Date().toISOString() });

export const firmaSatiri = (id, v) => ({
  arama_firma: decodeURIComponent(id).slice(0, 200), yetkili: kes(v.yetkili, 200), telefon: kes(v.telefon, 40), adres: kes(v.adres, 500),
  notlar: kes(v.notlar, 5000), etiketler: kes(v.etiketler, 500), guncelleyen: metinOrNull(v.guncelleyen),
  guncelleme_tarihi: gecerliTarih(v.guncellemeTarihi) ? v.guncellemeTarihi : new Date().toISOString()
});

export const sayacSatiri = (id, v) => ({ arama_firma: decodeURIComponent(id), firma_kodu: String(v.firmaKodu || "").slice(0, 20), son_no: Number.isInteger(v.sonNo) && v.sonNo >= 0 ? v.sonNo : 0 });
export const kodSatiri = (id, v) => ({ kod: id, arama_firma: String(v.aramaFirma || "") });

export const gecmisSatiri = v => ({ zaman: gecerliTarih(v.zaman) ? v.zaman : new Date().toISOString(), kim: String(v.kim || "?").slice(0, 200), islem: String(v.islem || "").slice(0, 200), hedef: kes(v.hedef, 200), detay: kes(v.detay, 500) });

/* formFotograflari belgesi → { satir, dosya } ; dosya: Storage'a yüklenecek { yol, tip, veri } (imza ise null) */
export function gorselSatiri(id, v) {
  if (v.tur === "imza") return { satir: { id, tur: "imza", imza: kes(v.imza, 300000), imza_sorumlu: kes(v.imzaSorumlu, 300000) }, dosya: null };
  const c = veriUrlCoz(v.base64);
  if (!c) return null;
  const yol = `${id}.${c.uzanti}`;
  return { satir: { id, tur: "foto", dosya_yolu: yol }, dosya: { yol, tip: c.tip, veri: c.veri } };
}

/* Form belgesi → { satir, uyarilar, gomuluGorseller }
   varOlanGorseller: yüklenmiş form_gorselleri kimlikleri (silinmiş görsele bağlı alanlar boşaltılır, yoksa yabancı anahtar hatası olur).
   gomuluGorseller: eski kayıtlarda belgenin içine gömülü fotoğraf/imza varsa ayrı görsel olarak taşınması için döner. */
export function formSatiri(id, v, varOlanGorseller = new Set()) {
  const uyarilar = [];
  const eklenme = gecerliTarih(v.eklenmeTarihi) ? v.eklenmeTarihi : null;
  let tarih = gecerliTarih(v.tarih) ? v.tarih : null;
  if (!tarih) { tarih = eklenme || new Date().toISOString(); uyarilar.push("tarih yok/geçersiz, eklenme tarihi kullanıldı"); }
  const firmaAdi = String(v.firmaAdi || v.aramaFirma || "(adsız)").slice(0, 200);
  const gomulu = {};
  const varMi = g => (g && varOlanGorseller.has(g) ? g : null);
  const fotoId = varMi(v.fotoId), imzaId = varMi(v.imzaId);
  let formVerisi = v.formVerisi && typeof v.formVerisi === "object" ? { ...v.formVerisi } : null;
  if (formVerisi && (formVerisi.imza || formVerisi.imzaSorumlu) && !imzaId) {   // 2.1 öncesi: imzalar form belgesine gömülüydü
    gomulu.imza = { imza: formVerisi.imza || "", imzaSorumlu: formVerisi.imzaSorumlu || "", tur: "imza" };
  }
  if (formVerisi) { delete formVerisi.imza; delete formVerisi.imzaSorumlu; }
  if (typeof v.fotograf === "string" && v.fotograf.startsWith("data:") && !fotoId) gomulu.foto = { base64: v.fotograf, tur: "foto" };   // eski kayıt: fotoğraf belgede
  if (v.fotoId && !fotoId && !gomulu.foto) uyarilar.push("fotoğraf belgesi bulunamadı (foto_id boş bırakıldı)");
  const formNo = Number.isInteger(v.formNo) ? v.formNo : (koddanNo(v.formKodu) || null);
  const satir = {
    id, firma_adi: firmaAdi, arama_firma: String(v.aramaFirma || firmaAdi.toLocaleLowerCase("tr-TR")).slice(0, 200), sehir: String(v.sehir || "belirsiz").slice(0, 60),
    islem_tipi: String(v.islemTipi || "").slice(0, 40), aciklama: kes(v.aciklama, 20000), ekleyen: String(v.ekleyen || "bilinmiyor"),
    foto_id: fotoId, ek_foto_idler: (Array.isArray(v.ekFotoIdler) ? v.ekFotoIdler : []).filter(g => varOlanGorseller.has(g)), imza_id: imzaId,
    firma_kodu: kes(v.firmaKodu, 20), form_no: formNo, form_kodu: kes(v.formKodu, 40), tarih, eklenme_tarihi: eklenme || tarih,
    konum: v.konum && typeof v.konum.lat === "number" && typeof v.konum.lng === "number" ? { lat: v.konum.lat, lng: v.konum.lng } : null,
    bakim_aralik: Number.isInteger(v.bakimAralik) && v.bakimAralik >= 1 && v.bakimAralik <= 120 ? v.bakimAralik : null,
    sonraki_bakim: gecerliTarih(v.sonrakiBakim) ? v.sonrakiBakim : null,
    vektor: typeof v.vektor === "string" ? v.vektor.slice(0, 2000) : null, vektor_surum: Number.isInteger(v.vektorSurum) ? v.vektorSurum : null,
    olusturulan: v.olusturulan === true, form_verisi: formVerisi, ziyaret: v.ziyaret && typeof v.ziyaret === "object" ? v.ziyaret : null
  };
  return { satir, uyarilar, gomulu };
}

/* Sayaçları form numaralarıyla tutarlı hale getirir: son_no, o firmadaki en büyük form_no'dan küçük olamaz;
   sayacı olmayan firmalar için sayaç + firma kodu üretilir. */
export function sayaclariTamamla(sayaclar, formSatirlari, kodlar) {
  const sonuc = new Map(sayaclar.map(s => [s.arama_firma, { ...s }]));
  const kodSahibi = new Map(kodlar.map(k => [k.kod, k.arama_firma]));
  const firmalar = new Map();
  for (const f of formSatirlari) {
    const e = firmalar.get(f.arama_firma) || { kod: null, maks: 0 };
    if (f.firma_kodu && !e.kod) e.kod = f.firma_kodu;
    if (f.form_no && f.form_no > e.maks) e.maks = f.form_no;
    firmalar.set(f.arama_firma, e);
  }
  for (const [firma, e] of firmalar) {
    const s = sonuc.get(firma);
    if (s) { if (s.son_no < e.maks) s.son_no = e.maks; continue; }
    if (e.kod) { sonuc.set(firma, { arama_firma: firma, firma_kodu: e.kod, son_no: e.maks }); if (!kodSahibi.has(e.kod)) kodSahibi.set(e.kod, firma); }
  }
  for (const s of sonuc.values()) if (s.firma_kodu && !kodSahibi.has(s.firma_kodu)) kodSahibi.set(s.firma_kodu, s.arama_firma);
  return { sayaclar: [...sonuc.values()].filter(s => s.firma_kodu), kodlar: [...kodSahibi].map(([kod, arama_firma]) => ({ kod, arama_firma })) };
}
