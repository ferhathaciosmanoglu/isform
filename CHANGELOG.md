# Değişiklik günlüğü

## Yayınlanmamış — Supabase'e geçiş
- Arka uç Firebase'den Supabase'e taşındı (Auth, Postgres + RLS, Storage, Realtime); `src/veri/` Firestore benzeri API'yi koruyarak çağrı yerlerini değiştirmeden geçişi sağlar.
- Form numarası artık `form_no_ayir()` Postgres fonksiyonuyla verilir; fotoğraflar Storage'da durur.
- AI proxy ve sesli asistan Supabase Edge Function oldu (`supabase/functions/ai-proxy`); yayın GitHub Pages'te kalıyor.
- Çevrimdışı kayıt kaldırıldı (giriş için zaten internet gerekiyordu). "Eski kayıtları optimize et" aracı ve Firebase dosyaları (kurallar, fonksiyonlar, kurulum iş akışı) kaldırıldı.
- Ziyaret geçmişi: firma kartında ENORPA'dan kim, ne zaman, kaç kez gitti (AI ile form okuma).
- Kayıt kartlarında formu ekleyen kişi yerine forma giden personel gösteriliyor (ekleyen kayıtta ve işlem geçmişinde kalıyor).
- Form okurken isimler personel listesiyle eşleştiriliyor ("Mehmet Koya", "M. Kaya" → Mehmet Kaya); ziyaret tarihi kayıttaki tarihten alınıyor. Önceden okunanlar bir sonraki toplu okumada yeniden okunur.
- Yönetici ⋯ → **Ziyaret okumalarını düzelt**: AI'ın okuduğu personel form fotoğrafıyla yan yana; personel boş, listede olmayan isim, okunmamış gruplarında tek tek düzeltilip kaydedilir. Elle düzeltilen kayıtları toplu AI okuması bir daha değiştirmez; AI'ın ham okuması da saklanır.
- Rapor → **Giden personel**: kişi başına form ve firma sayısı, son ziyaret, en çok gittiği firmalar, işlem tipleri, birlikte gittiği kişiler; dönem seçimi ve CSV. Eski "Personel dağılımı" (formu ekleyen) kaldırıldı. Form CSV'sine "Giden personel" sütunu eklendi.
- Düzeltme: yeni girişte personel listesi sayfa yenilenene kadar yüklenmiyordu.
- Google "yoğun" (503) hatası verdiğinde toplu okuma durmuyor; bekleyip yeniden deniyor, gerekirse yedek modele geçiyor.

## 2.1.0
**Düzeltmeler**
- Kesme işareti ve ters bölü içeren metinler ekranda `\'` olarak bozuk görünüyordu (`htmlGuvenli`); düzenleme butonu da veriye fazladan `\` yazabiliyordu.
- Kartlarda bakım rozeti ve "Kopyala" butonu hiç görünmüyordu.
- Çevrimdışı eklenen kayıtlarda fotoğraf bağlantısı kopuyordu (sahte kimlik); artık kimlik yerelde üretiliyor.
- Form silinince PDF ek sayfaları ve imzalar silinmiyordu.
- Akış sekmesi oturum açılmadan dinlenmeye başladığı için girişten sonra boş kalabiliyordu.
- 30 günden fazla gecikmiş bakımlar listede görünmüyordu; liste 15'ten 50 kayda çıktı.
- Aynı anda girilen kayıtlar aynı form numarasını alabiliyordu; numara artık transaction ile ayrılıyor.
- "Bakım yapıldı", "Kopyala" ve "Yeni kayıt olarak ekle" formu açmadan alanları dolduruyordu.
- Gece 00:00–03:00 arası "bugün" bir önceki gün sayılıyordu; 31 Ocak + 1 ay 3 Mart oluyordu.
- CSV dışa aktarımları birleştirildi; formül enjeksiyonuna karşı korunuyor.

**Güvenlik**
- Firestore kuralları alan adlarını, tipleri ve boyutları denetliyor; başkası adına kayıt eklenemiyor. Emülatör testleri eklendi.
- Personel adları kaynak koddan çıkarıldı (KVKK).
- jsPDF, html2canvas ve heic2any CDN yerine npm paketinden ve sürümü sabit yükleniyor.
- Asistan uç noktası kişi başına anahtar destekliyor, yalnızca gereken alanları okuyor, soruları işlem geçmişine yazıyor; AI proxy istek boyutunu sınırlıyor.
- Şifre sıfırlama ekranı hesabın var olup olmadığını belli etmiyor.
- Bağımlılıklar güncellendi (Firebase 12, Vite 6, firebase-admin 14); `npm audit` temiz.

**Performans**
- İmzalar form belgesinden ayrıldı (arama, rapor ve asistan her kayıtta imza indirmiyor).
- Şehir ve e-posta aramaları sınırlandı ve sunucuda tarihe göre sıralanıyor.
- Firebase ayrı dosyada; PDF şablonu, jsPDF, html2canvas ve heic2any ilk kullanımda yükleniyor (açılış dosyası 157 KB → 131 KB).
- Service worker sürümü otomatik; açılış dosyaları önceden önbelleğe alınıyor, yeni sürüm bildirimi gösteriliyor.

**Erişilebilirlik**
- Yakınlaştırma engeli kaldırıldı; alt menü klavyeyle kullanılabiliyor; bildirimler ekran okuyucuya duyuruluyor.
- Karanlık mod cihaz ayarını izliyor; imza retina ekranda net ve kalemle çalışıyor.

**Altyapı**
- `package-lock.json`, `.gitignore`, `.env.example`; lint hataları giderildi; PR'lar için CI (lint, birim, kural, duman, functions).
- Yedek kullanıcıları, işlem geçmişini ve isteğe bağlı fotoğrafları da içeriyor; optimize önce özet gösterip toplu yazıyor.

## 2.0.0
- Tek dosyalık `index.html` (3.098 satır) Vite + ES modüllerine bölündü; davranış değişmedi (orijinalle karşılaştırmalı doğrulandı).
- Modüller arası paylaşılan değişkenler `core/state.js` altında toplandı.
- Firebase SDK CDN yerine npm paketinden (10.8.1, sürüm sabit) yükleniyor; ayarlar `src/firebase/config.js`.
- Gemini istekleri `features/ai/transport.js` üzerinden; `VITE_AI_PROXY_URL` verilirse Cloud Function (`functions/`) kullanılır.
- Eklendi: birim testleri, tarayıcı duman testi, ESLint/Prettier, CI, `firestore.rules` taslağı, `asistan` (Siri/otomasyon) uç noktası.
