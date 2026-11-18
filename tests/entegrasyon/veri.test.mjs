/* Entegrasyon testi: veri katmanını (src/veri/*) GERÇEK Supabase projesine karşı dener.
   Çalıştırmak için yönetici rolü olan bir test hesabı gerekir:
     SUPABASE_TEST_EPOSTA=... SUPABASE_TEST_SIFRE=... npm run test:entegrasyon
   Ortam değişkenleri yoksa atlanır. Test kendi kayıtlarını ("ENTEGRASYON TESTI" firması) sonunda siler. */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const EPOSTA = process.env.SUPABASE_TEST_EPOSTA, SIFRE = process.env.SUPABASE_TEST_SIFRE;
const atla = !EPOSTA || !SIFRE;

globalThis.FileReader = class { readAsDataURL(b) { b.arrayBuffer().then(ab => { this.result = `data:${b.type};base64,` + Buffer.from(ab).toString("base64"); this.onload(); }, e => { this.error = e; this.onerror(); }); } };

describe("veri katmanı (Supabase)", { skip: atla }, () => {
  let K, A, B, FIRMA = "entegrasyon testi " + Date.now(), silinecek = [], gorseller = [];
  before(async () => {
    A = await import("../../src/veri/auth.js"); K = await import("../../src/veri/firestore.js"); B = await import("../../src/features/firms/firma-kodu-servis.js");
    await A.signInWithEmailAndPassword(A.auth, EPOSTA, SIFRE);
  });
  after(async () => {
    for (const id of silinecek) await K.deleteDoc(K.doc(null, "formlar", id)).catch(() => {});
    for (const id of gorseller) await K.deleteDoc(K.doc(null, "formFotograflari", id)).catch(() => {});
    await K.deleteDoc(K.doc(null, "firmalar", encodeURIComponent(FIRMA))).catch(() => {});
    const { supabase } = await import("../../src/veri/client.js");
    await supabase.from("sayaclar").delete().eq("arama_firma", FIRMA); await supabase.from("firma_kodlari").delete().eq("arama_firma", FIRMA);
    await A.signOut();
  });

  const ornek = ek => ({ firmaAdi: "Entegrasyon Testi", aramaFirma: FIRMA, sehir: "antalya", islemTipi: "Bakım", aciklama: "Kazan'ın basıncı düşük", ekleyen: EPOSTA.toLowerCase(),
    tarih: "2026-10-01T09:00:00.000Z", eklenmeTarihi: new Date().toISOString(), olusturulan: false, ...ek });

  test("oturum açıldı ve kullanıcı bilgisi var", () => { assert.equal(A.auth.currentUser.email, EPOSTA.toLowerCase()); });

  test("rol okunur (kullanicilar → profiller)", async () => {
    const s = await K.getDoc(K.doc(null, "kullanicilar", EPOSTA.toLowerCase()));
    assert.equal(s.exists(), true); assert.equal(s.data().rol, "yonetici"); assert.equal(s.data().aktif, true);
  });

  test("form numarası atomik ve ardışık verilir", async () => {
    const a = await B.formNoAyir(FIRMA, 2), b = await B.formNoAyir(FIRMA);
    assert.match(a.firmaKodu, /^[A-Z]{3,4}/); assert.equal(a.ilkNo, 1); assert.equal(b.firmaKodu, a.firmaKodu); assert.equal(b.ilkNo, 3);
  });

  test("form eklenir, camelCase alanlarla geri okunur; boş alanlar görünmez", async () => {
    const ref = K.doc(K.collection(null, "formlar")); silinecek.push(ref.id);
    await K.setDoc(ref, ornek({ formKodu: "TEST1", formNo: 1, konum: { lat: 36.9, lng: 30.7 }, formVerisi: { p: ["Ali Yılmaz"], sorumlu: "Veli" }, ziyaret: { personel: ["Ali Yılmaz"], surum: 1 }, numaraCevrimdisi: true }));
    const s = await K.getDoc(ref), v = s.data();
    assert.equal(v.firmaAdi, "Entegrasyon Testi"); assert.equal(v.formKodu, "TEST1"); assert.deepEqual(v.konum, { lat: 36.9, lng: 30.7 });
    assert.equal(v.tarih, "2026-10-01T09:00:00.000Z"); assert.equal("sonrakiBakim" in v, false); assert.equal("numaraCevrimdisi" in v, false);
    assert.deepEqual(v.ziyaret.personel, ["Ali Yılmaz"]); assert.equal(v.formVerisi.p[0], "Ali Yılmaz");
  });

  test("sorgular: önek araması, eşitlik, sıralama, limit, sayım", async () => {
    const ref2 = K.doc(K.collection(null, "formlar")); silinecek.push(ref2.id);
    await K.setDoc(ref2, ornek({ formKodu: "TEST2", formNo: 2, tarih: "2026-11-01T09:00:00.000Z", sonrakiBakim: "2026-12-01T09:00:00.000Z" }));
    const hi = "", on = FIRMA.slice(0, 15);
    const q1 = await K.getDocs(K.query(K.collection(null, "formlar"), K.where("aramaFirma", ">=", on), K.where("aramaFirma", "<=", on + hi), K.limit(5)));
    assert.equal(q1.size, 2);
    const q2 = await K.getDocs(K.query(K.collection(null, "formlar"), K.where("aramaFirma", "==", FIRMA), K.orderBy("tarih", "desc"), K.limit(10)));
    assert.deepEqual(q2.docs.map(d => d.data().formKodu), ["TEST2", "TEST1"]);
    const q3 = await K.getDocs(K.query(K.collection(null, "formlar"), K.where("aramaFirma", "==", FIRMA), K.where("sonrakiBakim", ">", ""), K.orderBy("sonrakiBakim"), K.limit(10)));
    assert.deepEqual(q3.docs.map(d => d.data().formKodu), ["TEST2"]);
    const q4 = await K.getDocs(K.query(K.collection(null, "formlar"), K.where("formKodu", "==", "TEST2")));
    assert.equal(q4.size, 1);
    const c = await K.getCountFromServer(K.query(K.collection(null, "formlar"), K.where("aramaFirma", "==", FIRMA), K.where("tarih", ">=", "2026-10-15T00:00:00.000Z")));
    assert.equal(c.data().count, 1);
    const q5 = await K.getDocs(K.query(K.collection(null, "formlar"), K.where("eklenmeTarihi", ">=", ""), K.orderBy("eklenmeTarihi", "desc"), K.limit(1)));
    assert.equal(q5.size, 1);
  });

  test("güncelleme ve deleteField", async () => {
    const id = silinecek[1], ref = K.doc(null, "formlar", id);
    await K.updateDoc(ref, { aciklama: "düzeltildi", sonrakiBakim: K.deleteField() });
    const v = (await K.getDoc(ref)).data(); assert.equal(v.aciklama, "düzeltildi"); assert.equal("sonrakiBakim" in v, false);
    await assert.rejects(K.updateDoc(K.doc(null, "formlar", "yok-boyle-id"), { aciklama: "x" }), e => e.code === "permission-denied");
  });

  test("fotoğraf Storage'a yüklenir, base64 olarak geri okunur, silinir; imza tabloda durur", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const f = K.doc(K.collection(null, "formFotograflari")); gorseller.push(f.id);
    await K.setDoc(f, { base64: png });
    const g = (await K.getDoc(f)).data(); assert.equal(g.base64, png);
    const i = await K.addDoc(K.collection(null, "formFotograflari"), { imza: "data:image/png;base64,AAAA", imzaSorumlu: "data:image/png;base64,BBBB", tur: "imza" }); gorseller.push(i.id);
    const im = (await K.getDoc(K.doc(null, "formFotograflari", i.id))).data(); assert.equal(im.imza, "data:image/png;base64,AAAA"); assert.equal(im.tur, "imza");
    const b = K.writeBatch(); b.delete(f); b.delete(K.doc(null, "formFotograflari", i.id)); await b.commit();
    assert.equal((await K.getDoc(f)).exists(), false);
  });

  test("firma kartı (merge), işlem geçmişi, personel", async () => {
    const fr = K.doc(null, "firmalar", encodeURIComponent(FIRMA));
    await K.setDoc(fr, { yetkili: "Ayşe", telefon: "0555", guncelleyen: EPOSTA.toLowerCase(), guncellemeTarihi: new Date().toISOString() }, { merge: true });
    assert.equal((await K.getDoc(fr)).data().yetkili, "Ayşe");
    await K.addDoc(K.collection(null, "islemGecmisi"), { zaman: new Date().toISOString(), kim: EPOSTA.toLowerCase(), islem: "Entegrasyon testi", hedef: "x", detay: "y" });
    const gec = await K.getDocs(K.query(K.collection(null, "islemGecmisi"), K.orderBy("zaman", "desc"), K.limit(1)));
    assert.equal(gec.docs[0].data().islem, "Entegrasyon testi");
    const p = await K.addDoc(K.collection(null, "personel"), { ad: "Test Kişi", adNorm: "test kisi " + Date.now(), aktif: true, ekleyen: EPOSTA.toLowerCase(), eklenme: new Date().toISOString() });
    await K.deleteDoc(K.doc(null, "personel", p.id));
  });

  test("canlı dinleme: eklenen kayıt akışa yansır", async () => {
    let son = null, sayac = 0;
    const iptal = K.onSnapshot(K.query(K.collection(null, "formlar"), K.where("aramaFirma", "==", FIRMA), K.orderBy("tarih", "desc"), K.limit(10)), s => { son = s; sayac++; });
    await new Promise(r => setTimeout(r, 2500));
    const once = son ? son.size : -1;
    const ref = K.doc(K.collection(null, "formlar")); silinecek.push(ref.id);
    await K.setDoc(ref, ornek({ formKodu: "TEST3", formNo: 3 }));
    await new Promise(r => setTimeout(r, 4000)); iptal();
    assert.equal(once, 2); assert.equal(son.size, 3); assert.ok(sayac >= 2);
  });
});
