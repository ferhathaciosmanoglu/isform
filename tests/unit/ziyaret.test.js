import { test } from "node:test";
import assert from "node:assert/strict";
import { adlariTemizle, aiZiyaret, formdanZiyaret, ziyaretOzetle, ziyaretVar, ZIYARET_SURUM } from "../../src/lib/ziyaret.js";

test("adlariTemizle: büyük/küçük harf ve yinelenenleri düzeltir", () => {
  assert.deepEqual(adlariTemizle(["ali  YILMAZ", "Ali Yılmaz", "", " ", "x", "AYŞE kaya"]), ["Ali Yılmaz", "Ayşe Kaya"]);
  assert.deepEqual(adlariTemizle(null), []);
});

test("formdanZiyaret: oluşturulan formdan personel ve tarih alır, kâğıt formda null", () => {
  const v = { tarih: "2026-10-01T09:00:00.000Z", formVerisi: { p: ["ali yılmaz", "", "Ayşe Kaya", "", "", ""] } };
  assert.deepEqual(formdanZiyaret(v), { personel: ["Ali Yılmaz", "Ayşe Kaya"], tarih: "2026-10-01", kaynak: "form", surum: ZIYARET_SURUM });
  assert.equal(formdanZiyaret({ tarih: "2026-10-01" }), null);
});

test("aiZiyaret: geçersiz tarihi yedek tarihle değiştirir", () => {
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "yarın" }, "2026-05-02").tarih, "2026-05-02");
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "2026-03-04" }, "2026-05-02").tarih, "2026-03-04");
  assert.equal(aiZiyaret({ personel: ["Ali"], tarih: "" }, "").tarih, "");
  assert.equal(aiZiyaret({ personel: ["Ali"] }).kaynak, "ai");
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
