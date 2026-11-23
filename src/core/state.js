/* Modüller arası paylaşılan, değişebilen uygulama durumu.
   (ES modüllerinde içe aktarılan bir `let` değişkenine başka modülden atama yapılamaz; bu yüzden tek nesnede tutulur.) */
export const state = {
  aktifRol: "",
  rolHazir: Promise.resolve(false),
  aktifKullaniciMail: "",
  girisHazir: false,          // rol doğrulandı, Servis Saha ekranları gösterilebilir
  guncellenecekDocId: null,
  guncellenecekEskiAramaFirma: "",
  tumFormlarGlobal: [],
  raporSehirVeri: {},
};
