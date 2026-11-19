import { test } from "node:test";
import assert from "node:assert/strict";
import { adiEslestir, adlariEslestir, adlariTemizle, aiZiyaret, formdanZiyaret, ziyaretOzetle, ziyaretVar, ZIYARET_SURUM } from "../../src/lib/ziyaret.js";

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
