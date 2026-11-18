-- Uygulama vektörü 256 baytlık base64 metin olarak paketliyor ve benzerliği tarayıcıda hesaplıyor; sütun bu biçime uyarlanır.
alter table public.formlar alter column vektor type text using null;
alter table public.formlar add constraint formlar_vektor_boyut check (vektor is null or length(vektor) <= 2000);
