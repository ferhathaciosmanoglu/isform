import { test } from "node:test";
import assert from "node:assert/strict";
import { adiEslestir, adlariEslestir, adlariTemizle, aiZiyaret, elleZiyaret, formdanZiyaret, incelemeDurumu, personelOzetle, ziyaretOzetle, ziyaretVar, ZIYARET_SURUM } from "../../src/lib/ziyaret.js";

test("adlariTemizle: büyük/küçük harf ve yinelenenleri düzeltir", () => {
  assert.deepEqual(adlariTemizle(["ali  YILMAZ", "Ali Yılmaz", "", " ", "x", "AYŞE kaya"]), ["Ali Yılmaz", "Ayşe Kaya"]);
  assert.deepEqual(adlariTemizle(null), []);
});

test("formdanZiyaret: oluşturulan formdan personel ve tarih alır, kâğıt formda null", () => {
  const v = { tarih: "2026-10-01T09:00:00.000Z", formVerisi: { p: ["ali yılmaz", "", "Ayşe Kaya", "", "", ""] } };
  assert.deepEqual(formdanZiyaret(v), { personel: ["Ali Yılmaz", "Ayşe Kaya"], tarih: "2026-10-01", kaynak: "form", surum: ZIYARET_SURUM });
  assert.equal(formdanZiyaret({ tarih: "2026-10-01" }), null);
});

test("aiZiyaret: kayıttaki tarih önceliklidir, yoksa okunan geçerli tarih kullanılır", () => {
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "yarın" }, "2026-05-02").tarih, "2026-05-02");
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "2028-03-04" }, "2026-05-02").tarih, "2026-05-02");
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "2026-03-04" }, "").tarih, "2026-03-04");
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "" }, "").tarih, "");
  assert.equal(aiZiyaret({ personel: ["Ali"] }).kaynak, "ai");
  assert.deepEqual(aiZiyaret({ personel: ["Mehmet Koya", "kazım balu"] }, "", LISTE).personel, ["Mehmet Kaya", "Kazım Balcı"]);
});

const LISTE = ["Mehmet Kaya", "Mehmet Altun", "Kazım Balcı", "Onur Anuştekin", "Onur Kirezli", "Bircan Özdemir", "Yasin Deveci", "Mustafa Şen", "Halil İbrahim Şenkılıçaslan"];

test("adiEslestir: bozuk okunan adı listedeki yazıma çevirir", () => {
  const b = (a, beklenen) => assert.equal(adiEslestir(a, LISTE), beklenen, a);
  b("Mehmet Koya", "Mehmet Kaya"); b("Mehmet Koyu", "Mehmet Kaya"); b("M. Kaya", "Mehmet Kaya"); b("M.kaya", "Mehmet Kaya");
  b("M. Altın", "Mehmet Altun"); b("Mehmet Alen", "Mehmet Altun");
  b("Kazım Balu", "Kazım Balcı"); b("Karım Balu", "Kazım Balcı");
  b("Onur Anstelin", "Onur Anuştekin"); b("Onur Anustekin", "Onur Anuştekin"); b("Onur Kirazlı", "Onur Kirezli");
  b("B.özdemir", "Bircan Özdemir"); b("Bircan", "Bircan Özdemir"); b("Yasin", "Yasin Deveci"); b("Y. Deveci", "Yasin Deveci");
  b("Mustafa Ser", "Mustafa Şen"); b("Halil İ. Şenkılıçarslan", "Halil İbrahim Şenkılıçaslan");
});

test("adiEslestir: emin olamazsa okunduğu gibi bırakır", () => {
  assert.equal(adiEslestir("Elif Berce Eroğlu", LISTE), "Elif Berce Eroğlu");
  assert.equal(adiEslestir("Mehmet", LISTE), "Mehmet");   // iki Mehmet var
  assert.equal(adiEslestir("Burak Gümüş", LISTE), "Burak Gümüş");
  assert.equal(adiEslestir("ali yılmaz", []), "Ali Yılmaz");
  assert.deepEqual(adlariEslestir(["Mehmet Koya", "M. Kaya", "Kazım Balcı"], LISTE), ["Mehmet Kaya", "Kazım Balcı"]);
});

test("ziyaretVar", () => {
  assert.equal(ziyaretVar({}), false);
  assert.equal(ziyaretVar({ ziyaret: { personel: [], surum: ZIYARET_SURUM } }), true);
});

test("ziyaretOzetle: kişi başına sayı, tarih sırası, okunmamış", () => {
  const L = [
    { tarih: "2026-01-10T08:00:00Z", formKodu: "A1", ziyaret: { personel: ["Ali Yılmaz", "Ayşe Kaya"], tarih: "2026-01-10", surum: 1 } },
    { tarih: "2026-03-05T08:00:00Z", formKodu: "A2", ziyaret: { personel: ["ali yılmaz"], tarih: "2026-03-05", surum: 1 } },
    { tarih: "2026-02-01T08:00:00Z", formKodu: "A3" },
    { tarih: "2026-04-01T08:00:00Z", formKodu: "A4", formVerisi: { p: ["Veli Can"] } }
  ];
  const o = ziyaretOzetle(L);
  assert.equal(o.toplam, 4);
  assert.equal(o.okunmamis, 1);
  assert.deepEqual(o.kisiler, [{ ad: "Ali Yılmaz", sayi: 2 }, { ad: "Ayşe Kaya", sayi: 1 }, { ad: "Veli Can", sayi: 1 }]);
  assert.deepEqual(o.ziyaretler.map(z => z.formKodu), ["A4", "A2", "A3", "A1"]);
});

test("aiZiyaret: okunan ham isimleri de saklar", () => {
  const z = aiZiyaret({ personel: ["Mehmet Koya"] }, "2026-05-02", LISTE);
  assert.deepEqual(z.personel, ["Mehmet Kaya"]);
  assert.deepEqual(z.ham, ["Mehmet Koya"]);
  assert.equal("ham" in aiZiyaret({ personel: [] }, "", LISTE), false);
});

test("elleZiyaret: kaynak elle, ham okuma korunur, sürüm artsa da yeniden okunmaz", () => {
  const onceki = { personel: ["Mehmet Kaya"], ham: ["Mehmet Koya"], kaynak: "ai", surum: ZIYARET_SURUM };
  const z = elleZiyaret(["mehmet kaya", "Kazım Balcı", "Mehmet Kaya"], "2026-03-04", onceki, "y@ornek.com", "2026-11-20T10:00:00Z");
  assert.deepEqual(z, { personel: ["Mehmet Kaya", "Kazım Balcı"], tarih: "2026-03-04", kaynak: "elle", surum: ZIYARET_SURUM,
    onaylayan: "y@ornek.com", onayTarihi: "2026-11-20T10:00:00Z", ham: ["Mehmet Koya"] });
  assert.equal(elleZiyaret([], "geçersiz").tarih, "");
  assert.deepEqual(elleZiyaret(["Ali Can"], "", { personel: ["Ali Cam"], kaynak: "ai", surum: 1 }).ham, ["Ali Cam"]);
  assert.equal(ziyaretVar({ ziyaret: { personel: [], kaynak: "elle", surum: 0 } }), true);
  assert.equal(ziyaretVar({ ziyaret: { personel: ["X Y"], kaynak: "ai", surum: 0 } }), false);
});

test("incelemeDurumu: gözden geçirme grupları", () => {
  const ln = new Set(["mehmet kaya", "kazim balci"]);
  assert.equal(incelemeDurumu({}, ln), "okunmadi");
  assert.equal(incelemeDurumu({ formVerisi: { p: ["Ali"] } }, ln), "form");
  assert.equal(incelemeDurumu({ ziyaret: { personel: [], kaynak: "ai" } }, ln), "bos");
  assert.equal(incelemeDurumu({ ziyaret: { personel: ["Mehmet Kaya", "Hasan Yıldırm"], kaynak: "ai" } }, ln), "listeDisi");
  assert.equal(incelemeDurumu({ ziyaret: { personel: ["Mehmet Kaya"], kaynak: "ai" } }, ln), "ai");
  assert.equal(incelemeDurumu({ ziyaret: { personel: ["Hasan Yıldırm"], kaynak: "elle" } }, ln), "elle");
  assert.equal(incelemeDurumu({ ziyaret: { personel: ["Hasan"], kaynak: "ai" } }, new Set()), "ai");
});

test("personelOzetle: kişi başına form, firma, son ziyaret, ekip ve dönem filtresi", () => {
  const L = [
    { firmaAdi: "A Firma", aramaFirma: "a firma", islemTipi: "Arıza", tarih: "2025-02-01T08:00:00Z", ziyaret: { personel: ["Ali Yılmaz", "Ayşe Kaya"], tarih: "2025-02-01" } },
    { firmaAdi: "A Firma", aramaFirma: "a firma", islemTipi: "Bakım", tarih: "2026-03-05T08:00:00Z", ziyaret: { personel: ["ali yılmaz"], tarih: "2026-03-05" } },
    { firmaAdi: "B Firma", aramaFirma: "b firma", islemTipi: "Arıza", tarih: "2026-04-01T08:00:00Z", ziyaret: { personel: ["Ali Yılmaz"], tarih: "" } },
    { firmaAdi: "C Firma", aramaFirma: "c firma", tarih: "2026-05-01T08:00:00Z" }
  ];
  const o = personelOzetle(L);
  assert.equal(o.formSayisi, 4); assert.equal(o.okunmamis, 1);
  const ali = o.kisiler[0];
  assert.equal(ali.ad, "Ali Yılmaz"); assert.equal(ali.sayi, 3); assert.equal(ali.firmaSayisi, 2); assert.equal(ali.son, "2026-04-01");
  assert.deepEqual(ali.firmalar, [{ ad: "A Firma", sayi: 2 }, { ad: "B Firma", sayi: 1 }]);
  assert.deepEqual(ali.tipler, [{ ad: "Arıza", sayi: 2 }, { ad: "Bakım", sayi: 1 }]);
  assert.deepEqual(ali.ekip, [{ ad: "Ayşe Kaya", sayi: 1 }]);
  assert.deepEqual(o.kisiler[1], { ad: "Ayşe Kaya", sayi: 1, firmaSayisi: 1, son: "2025-02-01", firmalar: [{ ad: "A Firma", sayi: 1 }], tipler: [{ ad: "Arıza", sayi: 1 }], ekip: [{ ad: "Ali Yılmaz", sayi: 1 }] });
  const y = personelOzetle(L, { bas: "2026-01-01", bit: "2026-12-31" });
  assert.equal(y.formSayisi, 3); assert.equal(y.kisiler.length, 1); assert.equal(y.kisiler[0].sayi, 2);
});

test("servis sorumlusu: listedeyse personele eklenir, değilse yalnızca sorumlu olarak saklanır", () => {
  const z = aiZiyaret({ personel: ["Mehmet Koya"], sorumlu: "kazım balu" }, "2026-05-02", LISTE);
  assert.deepEqual(z.personel, ["Mehmet Kaya", "Kazım Balcı"]);
  assert.equal(z.sorumlu, "Kazım Balcı");
  const y = aiZiyaret({ personel: [], sorumlu: "Ahmet Müşteri" }, "", LISTE);
  assert.deepEqual(y.personel, []); assert.equal(y.sorumlu, "Ahmet Müşteri");
  assert.deepEqual(aiZiyaret({ personel: ["Mehmet Kaya"], sorumlu: "Mehmet Kaya" }, "", LISTE).personel, ["Mehmet Kaya"]);
  assert.equal("sorumlu" in aiZiyaret({ personel: ["Mehmet Kaya"], sorumlu: "" }, "", LISTE), false);
  const f = formdanZiyaret({ tarih: "2026-10-01T09:00:00Z", formVerisi: { p: ["Ali Yılmaz", ""], sorumlu: "Veli Can" } });
  assert.deepEqual(f.personel, ["Ali Yılmaz", "Veli Can"]);
});
