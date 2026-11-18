# Firestore → Supabase veri taşıma

Eski Firebase projesindeki (`isform-b284d`) verileri Supabase'e aktarır: kullanıcı rolleri, personel, firma kartları,
form fotoğrafları (Storage'a) ve imzalar, formlar, form numarası sayaçları. Tekrar çalıştırılabilir (kayıtlar kimliğiyle
upsert edilir). Eski kayıtlardaki gömülü fotoğraf/imzalar (2.1 öncesi) otomatik ayrı görsele taşınır.

## Hazırlık
1. **Firebase hizmet hesabı anahtarı** (yalnızca okuma yeter): Firebase konsolu → Proje ayarları → Hizmet hesapları →
   *Yeni özel anahtar oluştur* (JSON). Dosyayı depo dışında bir yerde tutun.
2. **Supabase service_role anahtarı**: Supabase → Project Settings → API Keys → `service_role` (gizli; sohbete/depoya yazmayın).
3. Bu klasörde bağımlılıkları kurun: `cd scripts/firebase-tasi && npm install`

## Çalıştırma
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/yol/hizmet-hesabi.json
export SUPABASE_URL=https://ohmbnassfbtsxwgozuhj.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...

npm run kuru     # önce kuru çalıştırma: Firestore'u okur, ne taşınacağını ve uyarıları gösterir, hiçbir şey yazmaz
npm run tasi     # gerçek taşıma
node tasi.mjs --gecmis   # (isteğe bağlı, bir kez) işlem geçmişini de taşır
```

## Sonra
- Kullanıcıların **giriş hesapları** Supabase'e taşınmaz (şifreler aktarılamaz): her kişi için Supabase → Authentication → Users →
  *Add user* ile hesap açın (roller zaten taşındı).
- Uygulamada birkaç firma kartına ve eski bir forma bakıp fotoğrafların açıldığını doğrulayın.
- Her şey yolunda olunca Firebase projesini yedekleyip kapatın.
