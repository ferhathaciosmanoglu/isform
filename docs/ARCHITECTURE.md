# Mimari

## Yükleme sırası
`src/main.js` modülleri bilinçli bir sırayla içe aktarır. Bazı modüller açılışta DOM'u kurar veya `window` üzerine
işlev koyar; sonrakiler buna güvenir. Örnekler: `form-ui` form alanlarını üretir, `foto-modal` `window.resmiAc`'ı koyar,
`ai/ek-ozellikler` onu sarmalar. **Sırayı değiştirmeyin**; yeni modülü ilgili grubun sonuna ekleyin.
Sıra: state → firebase → lib → ui → core/session → ai çekirdeği → rapor verisi → özellik modülleri (eski sayfadaki sıra) → ai/ek-ozellikler.

## Paylaşılan durum
Başka modülden atama gereken değişkenler `core/state.js` içindeki `state` nesnesindedir
(`aktifRol`, `rolHazir`, `aktifKullaniciMail`, `guncellenecekDocId`, `guncellenecekEskiAramaFirma`, `tumFormlarGlobal`, `raporSehirVeri`).

## Genel (window) işlevler
Eski satır içi `onclick="…"` işleyicileri ve modüller arası gevşek bağ için bazı işlevler `window` üzerindedir:
`showToast, sekmeyiDegistir, ekleModu, resmiAc, modaliKapat, formDuzenle, formSil, yaklasanAc, firmaKartiAc, pdfPaylasKartiAc, aramaOnbellek …`.
ESLint yapılandırması bunları global olarak tanır. Uzun vadede `onclick` yerine `addEventListener` kullanılması önerilir.

## Veri katmanı (`src/veri/`)
Uygulama kodu Firestore API'sinin küçük bir alt kümesini (`collection, doc, query, where, orderBy, limit, getDocs, getDoc, addDoc,
setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, getCountFromServer`) ve Firebase Auth benzeri bir oturum API'sini kullanır.
`veri/firestore.js` ve `veri/auth.js` bunları Supabase'e çevirir: koleksiyon adları tablolara, camelCase alanlar snake_case
sütunlara eşlenir (`SEMA`), boş sütunlar belgede görünmez, tarihler ISO metin döner. Fotoğraflar (`formFotograflari`) Storage'a
yüklenir, okunurken base64 metne çevrilir. İç içe alan yolu ve transaction desteklenmez; form numarası `form_no_ayir()` ile alınır.
Testler (smoke/demo) bu üç dosyayı bellekte çalışan sahteleriyle değiştirir.

## Veri modeli (Postgres, `supabase/migrations/`)
| Tablo | İçerik | Okuma | Yazma |
|---|---|---|---|
| `profiller` (e-posta) | rol, aktif | kendi kaydı / yönetici | yönetici (kendi kaydı hariç) |
| `formlar` | servis kayıtları (`foto_id`, `ek_foto_idler`, `imza_id` görsellere bağlanır; `ziyaret` = personel + tarih) | tüm aktif roller | ekleme: düzenleyen+ (kendi adına), düzenleme/silme: yönetici |
| `form_gorselleri` | fotoğraf (Storage yolu) veya imza (`tur`) | tüm aktif roller | ekleme: düzenleyen+, silme: yönetici |
| `sayaclar`, `firma_kodlari` | firma kodu + son form numarası | düzenleyen+ | yalnızca `form_no_ayir()` ve yönetici |
| `personel` | iş formundaki isim listesi | tüm aktif roller | ekleme: düzenleyen+, düzenleme/silme: yönetici |
| `firmalar` | firma kartı | tüm aktif roller | düzenleyen+ |
| `islem_gecmisi` | denetim kaydı | yönetici | herkes ekler, kimse değiştirmez |

Rol kontrolü `private.rol()` yardımcılarıyla RLS politikalarında yapılır (JWT'deki e-posta → `profiller`). Düzenleyen yalnızca
`bakimi_kapat()` ile bakım hatırlatmasını kapatabilir.

## Form numarası
`features/firms/firma-kodu-servis.js → formNoAyir()` veritabanındaki `form_no_ayir()` fonksiyonunu çağırır; fonksiyon firma başına
kilit alıp sayacı atomik artırır, böylece iki kişi aynı anda kayıt girse de numara tekrarlanmaz. Sayaç yoksa (ilk kayıt / eski veri)
mevcut formlardan hesaplanır; yeni firma kodu `firma_kodlari` ile rezerve edilir.

## AI
`ai/gemini.js` (model seçimi, yedekleme, akış) → `ai/transport.js` (Cloudflare Worker proxy'si veya doğrudan) → Gemini.
`ai/prompts.js` tüm istem ve şemaları tutar; `lib/vektor.js` anlamsal arama vektörlerini paketler.
