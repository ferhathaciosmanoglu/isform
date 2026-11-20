import { metniNormalizeEt } from "./text.js";
import { levenshtein } from "./levenshtein.js";

/* ===== ZİYARET: bir servis formundan "Enorpa'dan kim, ne zaman gitti" bilgisi =====
   formlar belgesinde `ziyaret: { personel: [ad], tarih: "YYYY-MM-DD", kaynak: "form" | "ai", surum }` olarak saklanır.
   Uygulamada oluşturulan formlarda bilgi formVerisi'nden (yapay zekâsız), taranmış kâğıt formlarda fotoğraftan okunur. */
export const ZIYARET_SURUM = 3;   // 2: isimler personel listesiyle eşleştirilir, tarih formdan alınır; 3: imzadaki servis sorumlusu da okunur (eskiler yeniden okunur)

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
  const personel = adlariTemizle([...fv.p, fv.sorumlu]);   // servis sorumlusu personel listesinden seçilir; o da forma gitmiştir
  const tarih = gunMu(String(v.tarih || "").slice(0, 10)) ? String(v.tarih).slice(0, 10) : "";
  return { personel, tarih, kaynak: "form", surum: ZIYARET_SURUM };
}

/* Yapay zekâ çıktısını (serbest) kaydedilebilir biçime çevirir */
/* ---- İsim eşleştirme: el yazısından bozuk okunan adı ("Mehmet Koya", "M. Kaya", "Kazım Balu") personel listesindeki
   doğru yazıma çevirir. Emin olunamazsa okunduğu gibi bırakır (listede olmayan eski personel olabilir). */
const sozcuk = t => metniNormalizeEt(t).replace(/[.]/g, ". ").replace(/[^a-z. ]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
export function adiEslestir(ad, liste) {
  const temiz = adTemizle(ad), adaylar = (liste || []).map(a => ({ ad: adTemizle(a), s: sozcuk(a) })).filter(a => a.s.length >= 2);
  const s = sozcuk(temiz); if (!s.length || !adaylar.length) return temiz;
  const tam = s.join(" ");
  const tek = l => (l.length === 1 ? l[0].ad : null);
  // 1) aynı ya da çok yakın tam ad
  let enIyi = null, enAz = Infinity;
  for (const a of adaylar) { const d = levenshtein(a.s.join(" "), tam); if (d < enAz) { enAz = d; enIyi = a; } }
  if (enIyi && enAz <= Math.max(1, Math.floor(tam.length / 6))) return enIyi.ad;
  const soyad = s[s.length - 1].replace(/\.$/, ""), ilk = s[0].replace(/\.$/, "");
  const soyadYakin = a => { const as = a.s[a.s.length - 1]; return levenshtein(as, soyad) <= Math.max(1, Math.floor(as.length / 3)); };
  // 2) tek kelime: "Yasin", "Bircan" (adı ya da soyadı tek kişiye uyuyorsa)
  if (s.length === 1) return tek(adaylar.filter(a => a.s[0] === ilk)) || tek(adaylar.filter(soyadYakin)) || temiz;
  // 3) baş harfli: "M. Kaya", "B.özdemir"
  if (ilk.length === 1) return tek(adaylar.filter(a => a.s[0][0] === ilk && soyadYakin(a))) || temiz;
  // 4) adı aynı, soyadı bozuk okunmuş: "Kazım Balu", "Onur Anstelin" (soyadının ilk harfi tutmalı)
  const ayniAd = adaylar.filter(a => a.s[0] === ilk || levenshtein(a.s[0], ilk) <= 1);
  const harfiTutan = ayniAd.filter(a => a.s[a.s.length - 1][0] === soyad[0]);
  const yakin = harfiTutan.filter(a => levenshtein(a.s[a.s.length - 1], soyad) <= Math.ceil(a.s[a.s.length - 1].length * 0.6));
  if (yakin.length === 1) return yakin[0].ad;
  // 5) soyadı tutuyor, adın baş harfi aynı: "Mehmet Kayış" değil ama "Mehmed Kaya" gibi
  return tek(adaylar.filter(a => a.s[0][0] === ilk[0] && soyadYakin(a))) || temiz;
}
export const adlariEslestir = (adlar, liste) => adlariTemizle((adlar || []).map(a => adiEslestir(a, liste)));

/* Yapay zekâ çıktısını (serbest) kaydedilebilir biçime çevirir. formTarih: kayıttaki tarih (kâğıttan okunan tarih
   çoğu zaman yanlış okunduğu için kayıttaki tarih önceliklidir; yoksa okunan tarih kullanılır). liste: bilinen personel adları */
export function aiZiyaret(cikti, formTarih = "", liste = []) {
  let personel = adlariEslestir(cikti && cikti.personel, liste);
  /* İmzadaki servis sorumlusu bazen Personeller bölümüne yazılmaz. Personel listesindeki biriyle eşleşiyorsa forma gitmiş
     sayılır; eşleşmiyorsa (müşteri yetkilisi olabilir) yalnızca `sorumlu` olarak saklanır, düzeltme ekranında öneri çıkar. */
  const sorumluHam = adTemizle(cikti && cikti.sorumlu), sorumlu = sorumluHam.length >= 3 ? adiEslestir(sorumluHam, liste) : "";
  const listede = sorumlu && (liste || []).some(a => metniNormalizeEt(adTemizle(a)) === metniNormalizeEt(sorumlu));
  if (listede) personel = adlariTemizle([...personel, sorumlu]);
  let tarih = String((cikti && cikti.tarih) || "").trim();
  if (!gunMu(tarih)) tarih = "";
  const ham = adlariTemizle(cikti && cikti.personel);   // okunduğu gibi: eşleştirme kuralı değişirse AI'a gitmeden yeniden eşlenebilir
  return { personel, ...(ham.length ? { ham } : {}), ...(sorumlu ? { sorumlu } : {}), tarih: gunMu(formTarih) ? formTarih : tarih, kaynak: "ai", surum: ZIYARET_SURUM };
}
export const okunamadi = () => ({ personel: [], tarih: "", kaynak: "ai", surum: ZIYARET_SURUM });

/* Bu kayıt için ziyaret bilgisi çıkarılmış mı? (okunamadı da "çıkarılmış" sayılır; tekrar tekrar AI'a gitmesin).
   Elle düzeltilen/onaylanan kayıt sürüm artsa da yeniden okunmaz (insan kararı AI'ın üstündedir). */
export const ziyaretVar = v => !!(v && v.ziyaret && (v.ziyaret.kaynak === "elle" || v.ziyaret.surum >= ZIYARET_SURUM));

/* Yöneticinin düzelttiği / onayladığı ziyaret bilgisi. onceki: kayıttaki ziyaret (ham okumayı korumak için) */
export function elleZiyaret(personel, tarih, onceki = null, kim = "", zaman = new Date().toISOString()) {
  const z = { personel: adlariTemizle(personel), tarih: gunMu(tarih) ? tarih : "", kaynak: "elle", surum: ZIYARET_SURUM, onaylayan: kim, onayTarihi: zaman };
  const ham = onceki && Array.isArray(onceki.ham) ? onceki.ham : onceki && onceki.kaynak === "ai" ? adlariTemizle(onceki.personel) : [];
  if (ham.length) z.ham = ham;
  return z;
}

/* Gözden geçirme ekranı için kaydın durumu. listeNorm: personel listesindeki adların metniNormalizeEt hali (Set)
   "okunmadi" | "bos" (okundu ama personel yok) | "listeDisi" (listede olmayan isim var) | "ai" (listeyle uyumlu AI okuması) | "elle" | "form" */
export function incelemeDurumu(v, listeNorm) {
  const z = v && v.ziyaret;
  if (!z) return formdanZiyaret(v) ? "form" : "okunmadi";
  if (z.kaynak === "elle") return "elle";
  if (z.kaynak === "form") return "form";
  const p = adlariTemizle(z.personel);
  if (!p.length) return "bos";
  if (listeNorm && listeNorm.size && p.some(a => !listeNorm.has(metniNormalizeEt(a)))) return "listeDisi";
  return "ai";
}

/* Firma için özet. formlar: aynı firmanın formlar belgeleri (data() nesneleri). Her form bir ziyaret sayılır.
   Dönen: { toplam, okunmamis, kisiler: [{ ad, sayi }] (çoktan aza), ziyaretler: [{ tarih, personel, formKodu }] (yeniden eskiye) } */
export function ziyaretOzetle(formlar) {
  const kisi = new Map(), ziyaretler = []; let okunmamis = 0;
  for (const v of formlar || []) {
    const z = v.ziyaret || formdanZiyaret(v) || null;
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
export const ziyaretPersonel = v => adlariTemizle((v.ziyaret || formdanZiyaret(v) || {}).personel);

/* ---- Personel raporu: her kişi kaç forma, kaç farklı firmaya gitti, en son ne zaman ----
   formlar: tüm formların data() nesneleri. bas/bit: "YYYY-MM-DD" (dahil), boşsa sınır yok.
   Dönen: { kisiler: [{ ad, sayi, firmaSayisi, son, firmalar: [{ ad, sayi }], tipler: [{ ad, sayi }], ekip: [{ ad, sayi }] }],
            formSayisi (dönemdeki), okunmamis (dönemde personeli olmayan form) } */
export function personelOzetle(formlar, { bas = "", bit = "" } = {}) {
  const kisi = new Map(); let formSayisi = 0, okunmamis = 0;
  const say = (m, k, ad) => { const e = m.get(k) || { ad, sayi: 0 }; e.sayi++; m.set(k, e); };
  const sirali = m => [...m.values()].sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr-TR"));
  for (const v of formlar || []) {
    const z = v.ziyaret || formdanZiyaret(v) || null;
    const tarih = (z && z.tarih) || String(v.tarih || "").slice(0, 10);
    if ((bas && tarih < bas) || (bit && tarih > bit)) continue;
    formSayisi++;
    const personel = z ? adlariTemizle(z.personel) : [];
    if (!personel.length) { okunmamis++; continue; }
    const firmaAd = String(v.firmaAdi || v.aramaFirma || "Bilinmeyen firma").trim(), firmaK = v.aramaFirma || metniNormalizeEt(firmaAd);
    const tip = String(v.islemTipi || "").trim() || "Belirtilmemiş";
    personel.forEach(ad => {
      const k = metniNormalizeEt(ad);
      const e = kisi.get(k) || { ad, sayi: 0, son: "", firmalar: new Map(), tipler: new Map(), ekip: new Map() };
      e.sayi++; if (tarih > e.son) e.son = tarih;
      say(e.firmalar, firmaK, firmaAd); say(e.tipler, tip, tip);
      personel.forEach(b => { if (b !== ad) say(e.ekip, metniNormalizeEt(b), b); });
      kisi.set(k, e);
    });
  }
  const kisiler = [...kisi.values()].map(e => ({ ad: e.ad, sayi: e.sayi, firmaSayisi: e.firmalar.size, son: e.son,
    firmalar: sirali(e.firmalar), tipler: sirali(e.tipler), ekip: sirali(e.ekip) }))
    .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr-TR"));
  return { kisiler, formSayisi, okunmamis };
}
