alter table public.profiller enable row level security;
alter table public.form_gorselleri enable row level security;
alter table public.formlar enable row level security;
alter table public.firmalar enable row level security;
alter table public.sayaclar enable row level security;
alter table public.firma_kodlari enable row level security;
alter table public.personel enable row level security;
alter table public.islem_gecmisi enable row level security;

-- profiller: herkes yalnızca kendi kaydını okur; liste ve yazma yalnızca yönetici (kendi kaydını değiştiremez)
create policy profiller_oku on public.profiller for select to authenticated
  using (eposta = (select private.mail()) or (select private.yonetici()));
create policy profiller_ekle on public.profiller for insert to authenticated
  with check ((select private.yonetici()) and eposta <> (select private.mail()));
create policy profiller_guncelle on public.profiller for update to authenticated
  using ((select private.yonetici()) and eposta <> (select private.mail()))
  with check ((select private.yonetici()) and eposta <> (select private.mail()));
create policy profiller_sil on public.profiller for delete to authenticated
  using ((select private.yonetici()) and eposta <> (select private.mail()));

-- form_gorselleri: okuma tüm aktif roller, ekleme düzenleyen+, silme yönetici, güncelleme yok
create policy gorsel_oku on public.form_gorselleri for select to authenticated using ((select private.okuyan()));
create policy gorsel_ekle on public.form_gorselleri for insert to authenticated with check ((select private.duzenleyen()));
create policy gorsel_sil on public.form_gorselleri for delete to authenticated using ((select private.yonetici()));

-- formlar: okuma tüm aktif roller, ekleme düzenleyen+ (kendi adına), düzenleme/silme yönetici
create policy formlar_oku on public.formlar for select to authenticated using ((select private.okuyan()));
create policy formlar_ekle on public.formlar for insert to authenticated
  with check ((select private.duzenleyen()) and ekleyen = (select private.mail()));
create policy formlar_guncelle on public.formlar for update to authenticated
  using ((select private.yonetici())) with check ((select private.yonetici()));
create policy formlar_sil on public.formlar for delete to authenticated using ((select private.yonetici()));

-- firmalar
create policy firmalar_oku on public.firmalar for select to authenticated using ((select private.okuyan()));
create policy firmalar_ekle on public.firmalar for insert to authenticated
  with check ((select private.duzenleyen()) and guncelleyen = (select private.mail()));
create policy firmalar_guncelle on public.firmalar for update to authenticated
  using ((select private.duzenleyen())) with check ((select private.duzenleyen()) and guncelleyen = (select private.mail()));
create policy firmalar_sil on public.firmalar for delete to authenticated using ((select private.yonetici()));

-- sayaclar / firma_kodlari: istemci doğrudan yazmaz (form_no_ayir fonksiyonu yazar); okuma düzenleyen+, yönetim yönetici
create policy sayaclar_oku on public.sayaclar for select to authenticated using ((select private.duzenleyen()));
create policy sayaclar_yonet on public.sayaclar for all to authenticated
  using ((select private.yonetici())) with check ((select private.yonetici()));
create policy kodlar_oku on public.firma_kodlari for select to authenticated using ((select private.duzenleyen()));
create policy kodlar_yonet on public.firma_kodlari for all to authenticated
  using ((select private.yonetici())) with check ((select private.yonetici()));

-- personel: okuma tüm aktif roller, ekleme düzenleyen+, düzenleme/silme yönetici
create policy personel_oku on public.personel for select to authenticated using ((select private.okuyan()));
create policy personel_ekle on public.personel for insert to authenticated
  with check ((select private.duzenleyen()) and ekleyen = (select private.mail()));
create policy personel_guncelle on public.personel for update to authenticated
  using ((select private.yonetici())) with check ((select private.yonetici()));
create policy personel_sil on public.personel for delete to authenticated using ((select private.yonetici()));

-- islem_gecmisi: herkes kendi adına ekler, yalnızca yönetici okur, değiştirme/silme yok
create policy gecmis_ekle on public.islem_gecmisi for insert to authenticated
  with check ((select private.aktif()) and kim = (select private.mail()));
create policy gecmis_oku on public.islem_gecmisi for select to authenticated using ((select private.yonetici()));

-- Form numarası: atomik; aynı firmaya aynı anda iki kayıt girilse de numara tekrarlanmaz.
-- p_kod_taban: istemcideki firmaKodTaban(aramaFirma) sonucu (ör. ORNE). Çakışırsa A, B, ... eki eklenir.
create or replace function public.form_no_ayir(p_arama_firma text, p_kod_taban text, p_adet integer default 1)
returns table (firma_kodu text, ilk_no integer)
language plpgsql security definer set search_path = '' as $$
declare
  s public.sayaclar%rowtype;
  v_kod text; v_max integer; i integer := 0; aday text; n integer; ek text;
begin
  if not (select private.duzenleyen()) then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_adet < 1 or p_adet > 50 then raise exception 'gecersiz adet'; end if;
  if coalesce(p_arama_firma, '') = '' or p_kod_taban !~ '^[A-Z]{3,4}$' then raise exception 'gecersiz firma'; end if;
  perform pg_advisory_xact_lock(hashtext(p_arama_firma));

  select * into s from public.sayaclar where arama_firma = p_arama_firma;
  if found then
    update public.sayaclar set son_no = son_no + p_adet where arama_firma = p_arama_firma;
    return query select s.firma_kodu, s.son_no + 1; return;
  end if;

  -- sayaç yok (yeni firma ya da eski veri): mevcut formlardan kod ve son numara
  select f.firma_kodu, coalesce(max(f.form_no), 0) into v_kod, v_max
    from public.formlar f where f.arama_firma = p_arama_firma and f.firma_kodu is not null
    group by f.firma_kodu order by count(*) desc limit 1;
  if v_kod is null then
    v_max := 0;
    loop
      ek := ''; n := i;
      while n > 0 loop n := n - 1; ek := chr(65 + n % 26) || ek; n := n / 26; end loop;
      aday := p_kod_taban || ek;
      exit when not exists (select 1 from public.firma_kodlari k where k.kod = aday and k.arama_firma <> p_arama_firma)
            and not exists (select 1 from public.formlar f where f.firma_kodu = aday and f.arama_firma <> p_arama_firma);
      i := i + 1;
      if i > 2000 then raise exception 'firma kodu uretilemedi'; end if;
    end loop;
    v_kod := aday;
  end if;
  insert into public.firma_kodlari (kod, arama_firma) values (v_kod, p_arama_firma) on conflict (kod) do nothing;
  insert into public.sayaclar (arama_firma, firma_kodu, son_no) values (p_arama_firma, v_kod, v_max + p_adet);
  return query select v_kod, v_max + 1;
end $$;
revoke all on function public.form_no_ayir(text, text, integer) from public, anon;
grant execute on function public.form_no_ayir(text, text, integer) to authenticated;

-- Düzenleyen yalnızca bakım hatırlatmasını kapatabilir (yeni kayıt akışı)
create or replace function public.bakimi_kapat(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.duzenleyen()) then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.formlar set sonraki_bakim = null where id = p_id;
end $$;
revoke all on function public.bakimi_kapat(text) from public, anon;
grant execute on function public.bakimi_kapat(text) to authenticated;

-- Canlı akış
alter publication supabase_realtime add table public.formlar;

-- Fotoğraf deposu (özel; ücretsiz planda var)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-fotograflari', 'form-fotograflari', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy foto_oku on storage.objects for select to authenticated
  using (bucket_id = 'form-fotograflari' and (select private.okuyan()));
create policy foto_ekle on storage.objects for insert to authenticated
  with check (bucket_id = 'form-fotograflari' and (select private.duzenleyen()));
create policy foto_sil on storage.objects for delete to authenticated
  using (bucket_id = 'form-fotograflari' and (select private.yonetici()));
