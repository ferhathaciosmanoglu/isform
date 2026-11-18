import { supabase } from "./client.js";
import { FOTO_DEPO } from "./config.js";
import { auth } from "./auth.js";

/* ===== FIRESTORE UYUMLULUK KATMANI (arkada Supabase / Postgres) =====
   Uygulama kodu Firestore API'sinin küçük bir alt kümesini kullanır (collection, doc, query, where, getDocs, addDoc,
   updateDoc, writeBatch, onSnapshot …). Bu dosya aynı işlevleri Supabase tablolarına çevirir; alan adları camelCase ↔
   snake_case eşlenir, boş (null) alanlar Firestore'daki gibi hiç görünmez, tarihler ISO metin olarak döner.
   Sınırlar: iç içe alan yolu ("a.b") ve işlem (transaction) desteklenmez; form numarası form_no_ayir() ile alınır. */

const TARIH = ["tarih", "eklenmeTarihi", "sonrakiBakim", "zaman", "eklenme", "guncellemeTarihi"];

/* koleksiyon → { tablo, pk, alanlar: { camel: snake } } */
const SEMA = {
  formlar: {
    tablo: "formlar", pk: "id",
    alanlar: { firmaAdi: "firma_adi", aramaFirma: "arama_firma", sehir: "sehir", islemTipi: "islem_tipi", aciklama: "aciklama", ekleyen: "ekleyen",
      fotoId: "foto_id", ekFotoIdler: "ek_foto_idler", imzaId: "imza_id", firmaKodu: "firma_kodu", formNo: "form_no", formKodu: "form_kodu",
      tarih: "tarih", eklenmeTarihi: "eklenme_tarihi", konum: "konum", bakimAralik: "bakim_aralik", sonrakiBakim: "sonraki_bakim",
      vektor: "vektor", vektorSurum: "vektor_surum", olusturulan: "olusturulan", formVerisi: "form_verisi", ziyaret: "ziyaret" }
  },
  formFotograflari: { tablo: "form_gorselleri", pk: "id", alanlar: { tur: "tur", imza: "imza", imzaSorumlu: "imza_sorumlu" } },
  firmalar: {
    tablo: "firmalar", pk: "arama_firma", kodla: true,
    alanlar: { yetkili: "yetkili", telefon: "telefon", adres: "adres", notlar: "notlar", etiketler: "etiketler", guncelleyen: "guncelleyen", guncellemeTarihi: "guncelleme_tarihi" }
  },
  sayaclar: { tablo: "sayaclar", pk: "arama_firma", kodla: true, alanlar: { firmaKodu: "firma_kodu", sonNo: "son_no" } },
  firmaKodlari: { tablo: "firma_kodlari", pk: "kod", alanlar: { aramaFirma: "arama_firma" } },
  personel: { tablo: "personel", pk: "id", alanlar: { ad: "ad", adNorm: "ad_norm", aktif: "aktif", ekleyen: "ekleyen", eklenme: "eklenme" } },
  islemGecmisi: { tablo: "islem_gecmisi", pk: "id", alanlar: { zaman: "zaman", kim: "kim", islem: "islem", hedef: "hedef", detay: "detay" } },
  kullanicilar: { tablo: "profiller", pk: "eposta", alanlar: { rol: "rol", aktif: "aktif", guncelleyen: "guncelleyen" } }
};
const sema = ad => { const s = SEMA[ad]; if (!s) { const e = new Error("Desteklenmeyen koleksiyon: " + ad); e.code = "unimplemented"; throw e; } return s; };

const idCoz = (s, id) => s.kodla ? decodeURIComponent(id) : id;
const idKodla = (s, v) => s.kodla ? encodeURIComponent(v) : String(v);
const sutun = (s, alan) => (alan === "__name__" || (alan === "id" && s.pk === "id")) ? s.pk : (s.alanlar[alan] || alan);

/* ---- Hata çevirisi ---- */
function hataFirlat(e) {
  const err = new Error(e.message || String(e));
  err.code = e.code === "42501" || e.status === 401 || e.status === 403 || /row-level security|permission denied/i.test(e.message || "") ? "permission-denied" : (e.code || "hata");
  throw err;
}
const izinYok = () => { const e = new Error("Bu işlem için yetkiniz yok"); e.code = "permission-denied"; return e; };

/* ---- Satır ↔ belge ---- */
export const deleteField = () => ({ __sil: true });
const silMi = v => v && v.__sil === true;

function satirdanBelge(s, satir) {
  const out = {};
  for (const [camel, snake] of Object.entries(s.alanlar)) {
    let v = satir[snake];
    if (v === null || v === undefined) continue;
    if (TARIH.includes(camel) && typeof v === "string") { const t = new Date(v); if (!Number.isNaN(t.getTime())) v = t.toISOString(); }
    out[camel] = v;
  }
  return out;
}
function belgedenSatir(s, veri, { silDestekle = true } = {}) {
  const out = {};
  for (const [k, v] of Object.entries(veri || {})) {
    if (k.includes(".")) { const e = new Error("İç içe alan yolu desteklenmiyor: " + k); e.code = "unimplemented"; throw e; }
    const snake = s.alanlar[k];
    if (!snake) continue;   // şemada karşılığı olmayan eski alanlar (numaraCevrimdisi, fotograf …) yok sayılır
    if (silMi(v)) { if (silDestekle) out[snake] = null; continue; }
    out[snake] = v === undefined ? null : v;
  }
  return out;
}
const kimlikMail = () => (auth.currentUser && auth.currentUser.email || "").toLowerCase();

/* ---- Belge / sorgu referansları ---- */
const rasgeleId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "");
export const collection = (_db, ad) => ({ tur: "col", ad });
export function doc(a, ad, id) {
  if (a && a.tur === "col") return { tur: "doc", ad: a.ad, id: rasgeleId(), yeni: true };
  return { tur: "doc", ad, id: String(id) };
}
export const query = (kaynak, ...kisitlar) => ({ tur: "q", ad: kaynak.ad, kisitlar: [...(kaynak.kisitlar || []), ...kisitlar.flat()] });
export const where = (alan, op, deger) => ({ k: "where", alan, op, deger });
export const orderBy = (alan, yon = "asc") => ({ k: "order", alan, yon });
export const limit = n => ({ k: "limit", n });
export const startAfter = d => ({ k: "after", d });

const ON_EK = "";

/* Kısıtları Supabase sorgusuna uygular */
function uygula(qb, s, kisitlar, { sirala = true } = {}) {
  const wl = kisitlar.filter(k => k.k === "where"), kullanildi = new Set();
  // [alan >= x] ve [alan <= x + ] çifti = "x ile başlar" (Firestore önek araması) → LIKE
  for (const g of wl) {
    if (g.op !== ">=" || typeof g.deger !== "string") continue;
    const u = wl.find(k => k !== g && k.alan === g.alan && k.op === "<=" && k.deger === g.deger + ON_EK);
    if (!u) continue;
    qb = qb.like(sutun(s, g.alan), g.deger.replace(/[\\%_]/g, c => "\\" + c) + "%");
    kullanildi.add(g); kullanildi.add(u);
  }
  for (const g of wl) {
    if (kullanildi.has(g)) continue;
    if (g.op === ">=" && g.deger === "") continue;   // "alan >= ''" her kayıtla eşleşir
    const c = sutun(s, g.alan);
    if (g.op === ">" && g.deger === "") qb = qb.not(c, "is", null);   // "alan > ''" = alan dolu
    else if (g.op === "==") qb = g.deger === null ? qb.is(c, null) : qb.eq(c, g.deger);
    else if (g.op === "!=") qb = qb.neq(c, g.deger);
    else if (g.op === "<") qb = qb.lt(c, g.deger);
    else if (g.op === "<=") qb = qb.lte(c, g.deger);
    else if (g.op === ">") qb = qb.gt(c, g.deger);
    else if (g.op === ">=") qb = qb.gte(c, g.deger);
    else throw new Error("Desteklenmeyen karşılaştırma: " + g.op);
  }
  const son = kisitlar.filter(k => k.k === "after").pop();
  if (son && son.d) qb = qb.gt(s.pk, idCoz(s, son.d.id));
  if (sirala) {
    const sirali = kisitlar.filter(k => k.k === "order");
    for (const o of sirali) qb = qb.order(sutun(s, o.alan), { ascending: o.yon !== "desc", nullsFirst: false });
    if (!sirali.some(o => sutun(s, o.alan) === s.pk)) qb = qb.order(s.pk, { ascending: true });   // sayfalama için kararlı sıra
  }
  return qb;
}

/* ---- Görseller: fotoğraflar Storage'da, imzalar tabloda; uygulama tarafı eskisi gibi base64 metin görür ---- */
const blobdanMetin = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
async function gorselBelgesi(satir) {
  if (satir.tur === "imza") return { tur: "imza", imza: satir.imza || "", imzaSorumlu: satir.imza_sorumlu || "" };
  if (!satir.dosya_yolu) return { tur: "foto", base64: "" };
  const { data, error } = await supabase.storage.from(FOTO_DEPO).download(satir.dosya_yolu);
  if (error) hataFirlat(error);
  return { tur: "foto", base64: await blobdanMetin(data) };
}
async function gorselEkle(id, veri) {
  if (veri.tur === "imza") {
    const { error } = await supabase.from("form_gorselleri").insert({ id, tur: "imza", imza: veri.imza || null, imza_sorumlu: veri.imzaSorumlu || null, olusturan: kimlikMail() });
    if (error) hataFirlat(error); return;
  }
  const m = /^data:([^;]+);base64,/.exec(veri.base64 || "");
  if (!m) throw new Error("Geçersiz fotoğraf verisi");
  const uz = m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg", yol = `${id}.${uz}`;
  const blob = await (await fetch(veri.base64)).blob();
  const yuk = await supabase.storage.from(FOTO_DEPO).upload(yol, blob, { contentType: m[1], upsert: false });
  if (yuk.error) hataFirlat(yuk.error);
  const { error } = await supabase.from("form_gorselleri").insert({ id, tur: "foto", dosya_yolu: yol, olusturan: kimlikMail() });
  if (error) { await supabase.storage.from(FOTO_DEPO).remove([yol]); hataFirlat(error); }
}
async function gorselSil(ids) {
  if (!ids.length) return;
  const { data } = await supabase.from("form_gorselleri").select("id,dosya_yolu").in("id", ids);
  const yollar = (data || []).map(x => x.dosya_yolu).filter(Boolean);
  if (yollar.length) await supabase.storage.from(FOTO_DEPO).remove(yollar);
  const { error } = await supabase.from("form_gorselleri").delete().in("id", ids);
  if (error) hataFirlat(error);
}

/* ---- Okuma ---- */
const belgeSnap = (id, veri) => ({ id, exists: () => true, data: () => veri, ref: { id }, metadata: { hasPendingWrites: false, fromCache: false } });
const bosSnap = id => ({ id, exists: () => false, data: () => undefined, ref: { id }, metadata: { hasPendingWrites: false, fromCache: false } });
const topluSnap = docs => ({ docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f), docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });

async function belgeyeCevir(ad, s, satir) {
  const veri = ad === "formFotograflari" ? await gorselBelgesi(satir) : satirdanBelge(s, satir);
  return belgeSnap(idKodla(s, satir[s.pk]), veri);
}

const SAYFA = 1000;   // PostgREST tek istekte en çok bu kadar satır döner
async function sorguCalistir(hedef) {
  const ad = hedef.ad, s = sema(ad), kisitlar = hedef.kisitlar || [];
  const lim = kisitlar.filter(k => k.k === "limit").pop();
  const satirlar = [];
  for (let bas = 0; ; bas += SAYFA) {
    const kalan = lim ? lim.n - satirlar.length : SAYFA;
    if (kalan <= 0) break;
    const adet = Math.min(SAYFA, kalan);
    const { data, error } = await uygula(supabase.from(s.tablo).select("*"), s, kisitlar).range(bas, bas + adet - 1);
    if (error) hataFirlat(error);
    satirlar.push(...data);
    if (data.length < adet) break;
  }
  if (ad === "formFotograflari") {   // fotoğraflar tek tek indirilir (yedekte kullanılır)
    const docs = []; for (let i = 0; i < satirlar.length; i += 5) docs.push(...await Promise.all(satirlar.slice(i, i + 5).map(x => belgeyeCevir(ad, s, x))));
    return topluSnap(docs);
  }
  return topluSnap(await Promise.all(satirlar.map(x => belgeyeCevir(ad, s, x))));
}
export const getDocs = hedef => sorguCalistir(hedef);

export async function getDoc(ref) {
  if (ref.ad === "ayarlar") return bosSnap(ref.id);   // eski tarayıcı-anahtarı modu yok; AI anahtarı sunucudadır (Cloudflare Worker)
  const s = sema(ref.ad);
  const { data, error } = await supabase.from(s.tablo).select("*").eq(s.pk, idCoz(s, ref.id)).maybeSingle();
  if (error) hataFirlat(error);
  return data ? belgeyeCevir(ref.ad, s, data) : bosSnap(ref.id);
}

export async function getCountFromServer(hedef) {
  const s = sema(hedef.ad);
  const { count, error } = await uygula(supabase.from(s.tablo).select("*", { count: "exact", head: true }), s, hedef.kisitlar || [], { sirala: false });
  if (error) hataFirlat(error);
  return { data: () => ({ count: count || 0 }) };
}

/* ---- Yazma ---- */
export async function setDoc(ref, veri, secenek = {}) {
  if (ref.ad === "ayarlar") { const e = new Error("Bu ayar Supabase sürümünde desteklenmiyor"); e.code = "unimplemented"; throw e; }
  const s = sema(ref.ad);
  if (ref.ad === "formFotograflari") return gorselEkle(ref.id, veri);
  const satir = { ...belgedenSatir(s, veri), [s.pk]: idCoz(s, ref.id) };
  if (ref.yeni) {   // yeni kimlik: yalnızca INSERT yetkisi yeter
    const { error } = await supabase.from(s.tablo).insert(satir); if (error) hataFirlat(error); return;
  }
  void secenek;   // upsert yalnızca verilen sütunları günceller (merge davranışı)
  const { error } = await supabase.from(s.tablo).upsert(satir, { onConflict: s.pk }); if (error) hataFirlat(error);
}

export async function addDoc(kaynak, veri) {
  const ref = doc(kaynak);
  if (kaynak.ad === "islemGecmisi") {   // kimlik veritabanında üretilir; geri okuma yetkisi yalnızca yöneticidedir
    const s = sema("islemGecmisi"), { error } = await supabase.from(s.tablo).insert(belgedenSatir(s, veri)); if (error) hataFirlat(error);
    return { id: "" };
  }
  await setDoc(ref, veri); return { id: ref.id };
}

export async function updateDoc(ref, veri) {
  const s = sema(ref.ad), anahtarlar = Object.keys(veri || {});
  if (ref.ad === "formlar" && anahtarlar.length === 1 && anahtarlar[0] === "sonrakiBakim" && silMi(veri.sonrakiBakim)) {   // düzenleyen yalnızca bakım hatırlatmasını kapatabilir
    const { error } = await supabase.rpc("bakimi_kapat", { p_id: ref.id }); if (error) hataFirlat(error); return;
  }
  const satir = belgedenSatir(s, veri);
  if (!Object.keys(satir).length) return;
  const { data, error } = await supabase.from(s.tablo).update(satir).eq(s.pk, idCoz(s, ref.id)).select(s.pk);
  if (error) hataFirlat(error);
  if (!data.length) throw izinYok();   // RLS satırı gizlediyse ya da kayıt yoksa
}

export async function deleteDoc(ref) {
  const s = sema(ref.ad);
  if (ref.ad === "formFotograflari") return gorselSil([ref.id]);
  const { data, error } = await supabase.from(s.tablo).delete().eq(s.pk, idCoz(s, ref.id)).select(s.pk);
  if (error) hataFirlat(error);
  if (!data.length) throw izinYok();
}

export function writeBatch() {
  const islemler = [];
  const b = {
    set: (ref, veri, sec) => { islemler.push(() => setDoc(ref, veri, sec)); return b; },
    update: (ref, veri) => { islemler.push(() => updateDoc(ref, veri)); return b; },
    delete: ref => { islemler.push(ref); return b; },
    async commit() {
      // Görsel silmeleri tek istekte toplanır; kalanlar 8'erli gruplar halinde çalışır (Postgres tek istekte çok tablolu işlem sunmaz)
      const gorseller = islemler.filter(x => typeof x !== "function" && x.ad === "formFotograflari").map(x => x.id);
      const digerleri = islemler.filter(x => typeof x === "function" || x.ad !== "formFotograflari").map(x => typeof x === "function" ? x : () => deleteDoc(x));
      for (let i = 0; i < digerleri.length; i += 8) await Promise.all(digerleri.slice(i, i + 8).map(f => f()));
      await gorselSil([...new Set(gorseller)]);
    }
  };
  return b;
}

/* ---- Canlı dinleme: tablodaki her değişiklikte sorgu yeniden çalışır (küçük sorgular için yeterli) ---- */
export function onSnapshot(hedef, a, b, c) {
  const geri = typeof a === "function" ? a : b, hataGeri = typeof a === "function" ? b : c;
  const s = sema(hedef.ad); let kapali = false, bekleyen = null;
  const yukle = async () => {
    try { const snap = await sorguCalistir(hedef); if (!kapali) geri(snap); }
    catch (e) { if (!kapali && hataGeri) hataGeri(e); }
  };
  yukle();
  const kanal = supabase.channel("dinle-" + hedef.ad + "-" + rasgeleId())
    .on("postgres_changes", { event: "*", schema: "public", table: s.tablo }, () => { clearTimeout(bekleyen); bekleyen = setTimeout(yukle, 400); })
    .subscribe();
  return () => { kapali = true; clearTimeout(bekleyen); supabase.removeChannel(kanal); };
}
