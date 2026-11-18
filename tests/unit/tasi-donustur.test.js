import { test } from "node:test";
import assert from "node:assert/strict";
import { firmaSatiri, formSatiri, gorselSatiri, profilSatiri, sayaclariTamamla, veriUrlCoz } from "../../scripts/firebase-tasi/donustur.mjs";

test("veriUrlCoz / gorselSatiri: foto Storage yoluna, imza satıra", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(veriUrlCoz(png).uzanti, "png"); assert.equal(veriUrlCoz("bozuk"), null);
  const g = gorselSatiri("abc", { base64: png });
  assert.deepEqual(g.satir, { id: "abc", tur: "foto", dosya_yolu: "abc.png" }); assert.equal(g.dosya.tip, "image/png"); assert.ok(g.dosya.veri.length > 0);
  assert.equal(gorselSatiri("x", { base64: "" }), null);
  const i = gorselSatiri("im", { tur: "imza", imza: "data:A", imzaSorumlu: "data:B" });
  assert.deepEqual(i.satir, { id: "im", tur: "imza", imza: "data:A", imza_sorumlu: "data:B" }); assert.equal(i.dosya, null);
});

test("formSatiri: alanlar eşlenir, olmayan görsele bağlantı boşaltılır, formNo koddan türetilir", () => {
  const v = { firmaAdi: "Örnek Tarım", aramaFirma: "ornek tarim", sehir: "antalya", islemTipi: "Bakım", aciklama: "x", ekleyen: "a@b.c", fotoId: "f1", ekFotoIdler: ["f2", "silinmis"], imzaId: "silinmis2",
    firmaKodu: "ORNE", formKodu: "ORNE12", tarih: "2026-10-01T09:00:00.000Z", eklenmeTarihi: "2026-10-01T09:01:00.000Z", konum: { lat: 1, lng: 2 }, bakimAralik: 6, sonrakiBakim: "2027-04-01T09:00:00.000Z",
    numaraCevrimdisi: true, formVerisi: { p: ["Ali"], imza: "data:I" } };
  const { satir, uyarilar, gomulu } = formSatiri("id1", v, new Set(["f1", "f2"]));
  assert.equal(satir.foto_id, "f1"); assert.deepEqual(satir.ek_foto_idler, ["f2"]); assert.equal(satir.imza_id, null);
  assert.equal(satir.form_no, 12); assert.equal(satir.bakim_aralik, 6); assert.deepEqual(satir.konum, { lat: 1, lng: 2 });
  assert.equal("numaraCevrimdisi" in satir, false); assert.equal(satir.form_verisi.imza, undefined); assert.deepEqual(satir.form_verisi.p, ["Ali"]);
  assert.equal(gomulu.imza.imza, "data:I");   // gömülü imza ayrı görsele taşınacak
  assert.deepEqual(uyarilar, []);
});

test("formSatiri: eksik/bozuk tarih ve alanlar için uyarı ve güvenli varsayılanlar", () => {
  const { satir, uyarilar } = formSatiri("id2", { firmaAdi: "X", tarih: "bozuk", eklenmeTarihi: "2026-01-02T00:00:00.000Z", fotograf: "data:image/jpeg;base64,AAAA" }, new Set());
  assert.equal(satir.tarih, "2026-01-02T00:00:00.000Z"); assert.equal(satir.sehir, "belirsiz"); assert.equal(satir.ekleyen, "bilinmiyor"); assert.ok(uyarilar.length >= 1);
  const e = formSatiri("id3", { firmaAdi: "Y", tarih: "2026-01-01T00:00:00Z", fotograf: "data:image/jpeg;base64,AAAA" }, new Set());
  assert.ok(e.gomulu.foto);   // eski kayıt: belgedeki gömülü fotoğraf
});

test("profil / firma satırları", () => {
  assert.deepEqual(profilSatiri("Ali@Enorpa.com", { rol: "yonetici", aktif: true }), { eposta: "ali@enorpa.com", rol: "yonetici", aktif: true, guncelleyen: null });
  assert.equal(profilSatiri("x@y.z", { rol: "garip", aktif: true }).rol, "goruntuleyen");
  assert.equal(firmaSatiri("ali'nin%20serasi", { yetkili: "Veli" }).arama_firma, "ali'nin serasi");
});

test("sayaclariTamamla: sayaç form numarasının gerisinde kalmaz, sayacı olmayan firmaya sayaç üretilir", () => {
  const formlar = [{ arama_firma: "a", firma_kodu: "AAAA", form_no: 7 }, { arama_firma: "a", firma_kodu: "AAAA", form_no: 3 }, { arama_firma: "b", firma_kodu: "BBBB", form_no: 2 }];
  const t = sayaclariTamamla([{ arama_firma: "a", firma_kodu: "AAAA", son_no: 5 }], formlar, []);
  assert.deepEqual(t.sayaclar.find(s => s.arama_firma === "a"), { arama_firma: "a", firma_kodu: "AAAA", son_no: 7 });
  assert.deepEqual(t.sayaclar.find(s => s.arama_firma === "b"), { arama_firma: "b", firma_kodu: "BBBB", son_no: 2 });
  assert.deepEqual(t.kodlar.map(k => k.kod).sort(), ["AAAA", "BBBB"]);
});
