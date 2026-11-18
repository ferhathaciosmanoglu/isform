import { metniNormalizeEt } from "./text.js";

/* ===== ZİYARET: bir servis formundan "Enorpa'dan kim, ne zaman gitti" bilgisi =====
   formlar belgesinde `ziyaret: { personel: [ad], tarih: "YYYY-MM-DD", kaynak: "form" | "ai", surum }` olarak saklanır.
   Uygulamada oluşturulan formlarda bilgi formVerisi'nden (yapay zekâsız), taranmış kâğıt formlarda fotoğraftan okunur. */
export const ZIYARET_SURUM = 1;

export const adTemizle = t => String(t || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR")
  .split(" ").map(k => k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1)).join(" ");

const ISO_GUN = /^\d{4}-\d{2}-\d{2}$/;
export const gunMu = t => ISO_GUN.test(String(t || "")) && !Number.isNaN(Date.parse(t));

/* Yinelenenleri (büyük/küçük harf, Türkçe karakter, boşluk farkı) atar; en fazla 12 kişi */
export function adlariTemizle(liste) {
  const gorulen = new Set(), cikti = [];
  for (const a of Array.isArray(liste) ? liste : []) {
    const ad = adTemizle(a), k = metniNormalizeEt(ad);
    if (ad.length < 2 || ad.length > 60 || gorulen.has(k)) continue;
    gorulen.add(k); cikti.push(ad);
  }
  return cikti.slice(0, 12);
}

/* Uygulamada oluşturulmuş formdan (formVerisi.p) yapay zekâsız ziyaret bilgisi; yoksa null */
export function formdanZiyaret(v) {
  const fv = v && v.formVerisi; if (!fv || !Array.isArray(fv.p)) return null;
  const personel = adlariTemizle(fv.p);
  const tarih = gunMu(String(v.tarih || "").slice(0, 10)) ? String(v.tarih).slice(0, 10) : "";
  return { personel, tarih, kaynak: "form", surum: ZIYARET_SURUM };
}

/* Yapay zekâ çıktısını (serbest) kaydedilebilir biçime çevirir */
export function aiZiyaret(cikti, yedekTarih = "") {
  const personel = adlariTemizle(cikti && cikti.personel);
  let tarih = String((cikti && cikti.tarih) || "").trim();
  if (!gunMu(tarih)) tarih = "";
  return { personel, tarih: tarih || (gunMu(yedekTarih) ? yedekTarih : ""), kaynak: "ai", surum: ZIYARET_SURUM };
}

/* Bu kayıt için ziyaret bilgisi çıkarılmış mı? (okunamadı da "çıkarılmış" sayılır; tekrar tekrar AI'a gitmesin) */
export const ziyaretVar = v => !!(v && v.ziyaret && v.ziyaret.surum >= ZIYARET_SURUM);

/* Firma için özet. formlar: aynı firmanın formlar belgeleri (data() nesneleri). Her form bir ziyaret sayılır.
   Dönen: { toplam, okunmamis, kisiler: [{ ad, sayi }] (çoktan aza), ziyaretler: [{ tarih, personel, formKodu }] (yeniden eskiye) } */
export function ziyaretOzetle(formlar) {
  const kisi = new Map(), ziyaretler = []; let okunmamis = 0;
  for (const v of formlar || []) {
    const z = ziyaretVar(v) ? v.ziyaret : (formdanZiyaret(v) || null);
    const tarih = (z && z.tarih) || String(v.tarih || "").slice(0, 10);
    const personel = z ? adlariTemizle(z.personel) : [];
    if (!personel.length) okunmamis++;
    personel.forEach(ad => {
      const k = metniNormalizeEt(ad), e = kisi.get(k) || { ad, sayi: 0 }; e.sayi++; kisi.set(k, e);
    });
    ziyaretler.push({ tarih, personel, formKodu: v.formKodu || "" });
  }
  ziyaretler.sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));
  const kisiler = [...kisi.values()].sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr-TR"));
  return { toplam: ziyaretler.length, okunmamis, kisiler, ziyaretler };
}

/* Kaydın personel listesi: çıkarılmış ziyaret bilgisi, yoksa uygulamada oluşturulmuş formdan; yoksa [] */
export const ziyaretPersonel = v => adlariTemizle((ziyaretVar(v) ? v.ziyaret : formdanZiyaret(v) || {}).personel);
