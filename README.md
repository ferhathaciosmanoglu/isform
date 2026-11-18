# ENORPA İş Formları

Servis formu oluşturma, firma kartları, bakım takibi, raporlar/harita, ziyaret geçmişi ve Gemini destekli asistan içeren PWA.
Ön yüz: düz JavaScript (ES modülleri) + Vite. Arka uç: **Supabase** (Auth, Postgres, Storage, Realtime, Edge Functions).
Yayın: **GitHub Pages**.

## Hızlı başlangıç

```bash
npm ci
npm run dev          # http://localhost:5173
npm run check        # lint + birim testleri + üretim derlemesi
npm run test:smoke   # tarayıcı duman testi (ilk kez: npx playwright install chromium)
npm run demo         # Supabase'e bağlanmadan, uydurma verilerle: http://localhost:5174
```

Node 22 önerilir (en az 20.19). Supabase adresi ve herkese açık (publishable) anahtarı `src/veri/config.js` içindedir;
başka bir projeye geçmek için `.env` dosyasında `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` verin (`.env.example`).

**Gerçek veritabanına karşı entegrasyon testi** (yönetici rolü olan bir test hesabı gerekir; test kendi kayıtlarını siler):

```bash
SUPABASE_TEST_EPOSTA=... SUPABASE_TEST_SIFRE=... npm run test:entegrasyon
```

## Klasör yapısı

Ayrıntı için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
public/        ikonlar, manifest, service worker
src/
  main.js      giriş: modülleri yükleme sırasıyla içe aktarır (sıra önemlidir)
  veri/        Supabase istemcisi; Firestore benzeri API (firestore.js) ve oturum (auth.js) katmanı
  core/        oturum, rol, kimlik doğrulama, ortak durum (state)
  lib/         saf yardımcılar (metin, tarih, firma kodu, vektör, ziyaret …) — birim testli
  ui/          toast, tema
  features/    forms, search, firms, maintenance, reports, admin, ai
  styles/      CSS parçaları
supabase/migrations/   veritabanı şeması, güvenlik politikaları (RLS) ve fonksiyonlar
supabase/functions/ai-proxy/   AI proxy + sesli asistan (Edge Function)
scripts/firebase-tasi/ Firestore → Supabase tek seferlik veri taşıma betiği
tests/         unit (node:test), smoke (Playwright, sahte veri katmanı), entegrasyon (gerçek Supabase)
```

## Kurulum

### 1. Supabase
1. Proje oluşturun; `supabase/migrations/*.sql` dosyalarını sırayla çalıştırın (SQL Editor ya da `supabase db push`).
2. **Authentication → Providers → Email**: *Confirm email* açık kalsın (roller e-postaya bağlıdır).
3. **Authentication → URL Configuration**: Site URL'e yayın adresinizi yazın (şifre sıfırlama bağlantısı oraya döner).
4. İlk yöneticiyi SQL Editor'den ekleyin ve **Authentication → Users → Add user** ile giriş hesabını açın:
   ```sql
   insert into public.profiller (eposta, rol) values ('yonetici@ornek.com', 'yonetici');
   ```
5. Sonraki kullanıcılar: Authentication → Users'tan hesabı açın, uygulamada ⋯ → **Kullanıcılar ve yetkiler** ile rolünü verin.

Roller: `yonetici` (her şey), `duzenleyen` (form ekler, firma kartı ve personel düzenler), `goruntuleyen` (yalnızca okur).
Yetkiler veritabanında RLS ile zorlanır; tarayıcıdaki kontroller yalnızca görünüm içindir.

### 2. Site (GitHub Pages)
Depo → Settings → Pages → Source: **GitHub Actions**. `.github/workflows/yayin.yml` her `main` gönderiminde lint, test ve derleme
yapıp yayınlar. Supabase'de **Authentication → URL Configuration → Site URL** ve Redirect URLs'e yayın adresinizi
(`https://KULLANICI.github.io/isform/`) ve yerel geliştirme için `http://localhost:5173/**` ekleyin.

### 3. AI proxy ve sesli asistan (Supabase Edge Function)
Gemini anahtarı yalnızca sunucuda durur; kullanıcı kimliği Supabase oturumuyla doğrulanır. Aynı fonksiyon Siri/Android
kestirmesi için `POST /asistan` uç noktasını da sunar. Adres: `https://PROJE.supabase.co/functions/v1/ai-proxy` (uygulama bunu
kendiliğinden kullanır; farklı bir proxy için `VITE_AI_PROXY_URL`).

Yayın: `supabase functions deploy ai-proxy` (ya da Supabase panelinden). Sırlar: Supabase → **Edge Functions → Secrets**:
`GEMINI_API_KEY` (Google AI Studio'dan yeni bir anahtar), `IZINLI_ORIGINLER` (örn. `https://KULLANICI.github.io`, CORS),
isteğe bağlı `SHORTCUT_TOKEN` (Siri için; `ali:UZUN_RASTGELE,ayse:UZUN_RASTGELE`, anahtar ≥ 24 karakter, `openssl rand -hex 24`).
`SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` platform tarafından otomatik verilir.

**Siri (iPhone):** Kestirmeler → "Metin Dikte Et" → "URL İçeriğini Al" (yöntem POST, adres
`https://PROJE.supabase.co/functions/v1/ai-proxy/asistan?format=text`, başlık `x-asistan-anahtari: <kişinin anahtarı>`, gövde JSON
`{"soru": <dikte edilen>}`) → "Metni Söyle". Bir telefon kaybolursa yalnızca o kişinin anahtarını `SHORTCUT_TOKEN`'dan çıkarın.
Anahtar tüm servis kayıtlarını okuyabilir; paylaşmayın.

## Yedekleme
Uygulamadaki **Tam yedek (JSON)** elle alınan bir kopyadır. Düzenli yedek için Supabase panelinde *Database → Backups*
bölümüne bakın (günlük yedekler; plan sınırları için Supabase belgelerine bakın).

## Kişisel veriler (KVKK)
Uygulama müşteri yetkilisi adı, telefonu, adresi, imzası ve kayıt anındaki GPS konumunu saklar. Çalışanlara ve müşterilere
aydınlatma metni verin, saklama süresini belirleyin. Personel adları kaynak koda yazılmaz; uygulamadaki Personel listesi
ekranından yönetilir.

## Bilinen noktalar
- Çevrimdışı kayıt desteklenmez: giriş ve form kaydı için internet gerekir.
- Form fotoğrafları Supabase Storage'dadır (özel bucket); uygulama onları base64 olarak indirip gösterir.
- Firebase'den veri aktarımı ayrı bir adımdır: `scripts/firebase-tasi/` (README'sine bakın). Kullanıcıların giriş hesapları
  (şifreler) taşınamaz, Supabase'de yeniden açılır.
