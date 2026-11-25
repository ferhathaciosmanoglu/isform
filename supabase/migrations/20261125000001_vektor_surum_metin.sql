-- Uygulama vektör sürümünü metin olarak yazıyor (VEKTOR_SURUM = "e1-256", src/lib/vektor.js) ama sütun integer açılmıştı;
-- bu yüzden açıklaması olan her yeni form "invalid input syntax for type integer" hatasıyla kaydedilemiyordu.
alter table public.formlar alter column vektor_surum type text using vektor_surum::text;
alter table public.formlar add constraint formlar_vektor_surum_uzunluk check (vektor_surum is null or length(vektor_surum) <= 20);
-- Firebase'den taşınan vektörler aynı biçimde (256 bayt → 344 karakter base64) ama sürümleri taşımada düşmüştü; anlamsal aramada tekrar kullanılsınlar.
update public.formlar set vektor_surum = 'e1-256' where vektor is not null and vektor_surum is null and length(vektor) = 344;
