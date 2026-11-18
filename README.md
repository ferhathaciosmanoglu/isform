# ENORPA İş Formları

Servis formu oluşturma, firma kartları, bakım takibi, raporlar/harita, ziyaret geçmişi ve Gemini destekli asistan içeren PWA.
Ön yüz: düz JavaScript (ES modülleri) + Vite. Arka uç: **Supabase** (Auth, Postgres, Storage, Realtime). Yayın: **Cloudflare**
(Pages + Workers).

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
cloudflare/ai-proxy/   AI proxy + sesli asistan (Cloudflare Worker)
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

### 2. Cloudflare Pages (site)
Depoyu Cloudflare Pages'e bağlayın (Build command: `npm run build`, output: `dist`) **ya da** GitHub'da şu sırları tanımlayın,
`.github/workflows/yayin.yml` her `main` gönderiminde yayınlar:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (proje adı: Variables → `CF_PAGES_PROJE`, varsayılan `enorpa-isform`).

### 3. AI proxy ve sesli asistan (Cloudflare Worker)
Gemini anahtarı yalnızca sunucuda durur; kullanıcı kimliği Supabase oturumuyla doğrulanır. Aynı Worker Siri/Android
kestirmesi için `POST /asistan` uç noktasını da sunar.

```bash
cd cloudflare/ai-proxy
# wrangler.toml → IZINLI_ORIGINLER: yayın adresiniz (CORS)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SHORTCUT_TOKEN              # ali:UZUN_RASTGELE,ayse:UZUN_RASTGELE  (anahtar ≥ 24 karakter; openssl rand -hex 24)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # yalnızca /asistan için
npx wrangler deploy
```

**Siri (iPhone):** Kestirmeler → "Metin Dikte Et" → "URL İçeriğini Al" (yöntem POST, adres `https://WORKER/asistan?format=text`,
başlık `x-asistan-anahtari: <kişinin anahtarı>`, gövde JSON `{"soru": <dikte edilen>}`) → "Metni Söyle". Bir telefon kaybolursa
yalnızca o kişinin anahtarını `SHORTCUT_TOKEN`'dan çıkarıp secret'ı yeniden yazın. Anahtar tüm servis kayıtlarını okuyabilir; paylaşmayın.

Çıkan Worker adresini GitHub'da **Variables → `VITE_AI_PROXY_URL`** olarak ekleyin (ya da yerelde `.env`) ve siteyi yeniden yayınlayın.
Proxy yoksa uygulama eski modda çalışır: anahtar her cihazda elle girilir ve tarayıcıda saklanır (önerilmez).

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
