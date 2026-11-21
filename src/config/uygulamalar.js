/* Servis - Saha ana ekranındaki uygulamalar. Yeni uygulama eklemek için bu listeye bir satır ekleyin.
   Adresler, renkler ve simgeler Kazan Takip'in çarkındaki listeyle aynıdır
   (ferhathaciosmanoglu/enorpa-kazan-takip → src/config/uygulamalar.js); bir adres değişirse iki yerde de güncelleyin.
   ic: true  → bu uygulamanın içindeki modül (adres çubuğunda #<id> ile açılır, geri tuşu ana ekrana döner)
   url       → ayrı uygulama; yeni sekmede açılır (Google girişi isteyenler çerçeve içinde açılamaz) */
export const UYGULAMALAR = [
  {
    id: "is-formlari",
    ad: "İş Formları",
    acik: "Servis formu, firma kartları, bakım ve rapor",
    ic: true,
    renk: ["#fb8a4b", "#e5560f"],
    simge: '<path d="M7 3h8l4 4v14H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'
  },
  {
    id: "proje-takip",
    ad: "Proje Takip",
    acik: "Kazan projeleri, resmi form çıktıları, bakım",
    url: "https://enorpa-kazan.pages.dev/",
    renk: ["#fb8a4b", "#e5560f"],
    simge: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4"/>'
  },
  {
    id: "saha-raporu",
    ad: "Saha Raporu",
    acik: "Fotoğraflı saha ziyaret raporu",
    url: "https://ferhathaciosmanoglu.github.io/enorpa-field-report-pwa/",
    renk: ["#f2a047", "#cf6a12"],
    simge: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  },
  {
    id: "brulor-kontrol",
    ad: "Brülör Kontrol",
    acik: "Brülör katalog ölçüleri ve teknik çizimli PDF",
    url: "https://ferhathaciosmanoglu.github.io/EnorpaS/",
    renk: ["#6b7683", "#3f4955"],
    simge: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  },
  {
    id: "brulor-takip",
    ad: "Brülör Takip",
    acik: "Brülör takip tablosu",
    url: "https://script.google.com/a/macros/enorpa.com/s/AKfycbwiJKKF02mfdAYcj3OfGBGAo9tfc9uszYBxDneL3lh5LteMeq-x-tC4Pw8sJcy5cfKa/exec",
    renk: ["#6b7683", "#3f4955"],
    simge: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
  },
  {
    id: "adam-saat",
    ad: "Adam Saat",
    acik: "İş, adam ve saat veri girişi",
    url: "https://script.google.com/a/macros/enorpa.com/s/AKfycbwvpfMp1a2XDKTJQ-Mb5_nUZ1YvnKLBNSahfCX977XBeGm8JCSMHfdQAXhcEs928zBQ/exec",
    renk: ["#5a6169", "#25292e"],
    simge: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'
  },
  {
    id: "harcama",
    ad: "Harcama Formu",
    acik: "Fişleri fotoğraftan okut, KE-FOR-021 Excel çıktısı",
    url: "https://enorpa-harcama.saha-f18.workers.dev/",
    renk: ["#2fb67c", "#17805a"],
    simge: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>'
  },
  {
    id: "is-takip",
    ad: "İş Takip",
    acik: "Görevler, takvim, rutinler ve toplantılar",
    url: "https://enorpa-is-takip.web.app/",
    renk: ["#3b6fd8", "#1e3f8a"],
    simge: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
  },
  {
    id: "kilavuzlar",
    ad: "Ürün Kılavuzları",
    acik: "Kazan kullanım kılavuzları ve QR kodları",
    url: "https://ferhathaciosmanoglu.github.io/kkenorpa/",
    renk: ["#0d9488", "#0f5f59"],
    simge: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'
  },
  {
    id: "brulor-kontrol-v18",
    ad: "Brülör Kontrol V18",
    acik: "Eski sürüm (yerine Brülör Kontrol kullanın)",
    url: "https://ferhathaciosmanoglu.github.io/enorpa/",
    eski: true,
    renk: ["#9aa1a9", "#6b7178"],
    simge: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'
  }
];
