create extension if not exists vector with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Kullanıcı rolleri (e-posta ile anahtarlı: yönetici önce e-postayı ekler, kişi sonra giriş yapar)
create table public.profiller (
  eposta text primary key check (eposta = lower(eposta) and length(eposta) <= 200),
  rol text not null check (rol in ('yonetici','duzenleyen','goruntuleyen')),
  aktif boolean not null default true,
  guncelleyen text,
  olusturma timestamptz not null default now()
);

create or replace function private.mail() returns text
language sql stable set search_path = '' as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function private.rol() returns text
language sql stable security definer set search_path = '' as $$
  select p.rol from public.profiller p where p.eposta = private.mail() and p.aktif
$$;
create or replace function private.aktif() returns boolean language sql stable set search_path = '' as $$ select private.rol() is not null $$;
create or replace function private.okuyan() returns boolean language sql stable set search_path = '' as $$ select private.rol() in ('yonetici','duzenleyen','goruntuleyen') $$;
create or replace function private.duzenleyen() returns boolean language sql stable set search_path = '' as $$ select private.rol() in ('yonetici','duzenleyen') $$;
create or replace function private.yonetici() returns boolean language sql stable set search_path = '' as $$ select private.rol() = 'yonetici' $$;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Form görselleri: fotoğraflar Storage'da (dosya_yolu), imzalar küçük olduğu için metin olarak burada
create table public.form_gorselleri (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  tur text not null default 'foto' check (tur in ('foto','imza')),
  dosya_yolu text check (length(dosya_yolu) <= 300),
  imza text check (length(imza) <= 300000),
  imza_sorumlu text check (length(imza_sorumlu) <= 300000),
  olusturan text,
  olusturma timestamptz not null default now()
);

create table public.formlar (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  firma_adi text not null check (length(firma_adi) between 1 and 200),
  arama_firma text not null check (length(arama_firma) between 1 and 200),
  sehir text not null check (length(sehir) between 1 and 60),
  islem_tipi text not null default '' check (length(islem_tipi) <= 40),
  aciklama text check (length(aciklama) <= 20000),
  ekleyen text not null,
  foto_id text references public.form_gorselleri(id) on delete set null,
  ek_foto_idler text[] not null default '{}',
  imza_id text references public.form_gorselleri(id) on delete set null,
  firma_kodu text check (length(firma_kodu) <= 20),
  form_no integer,
  form_kodu text check (length(form_kodu) <= 40),
  tarih timestamptz not null,
  eklenme_tarihi timestamptz not null default now(),
  konum jsonb check (konum is null or (jsonb_typeof(konum -> 'lat') = 'number' and jsonb_typeof(konum -> 'lng') = 'number')),
  bakim_aralik integer check (bakim_aralik is null or bakim_aralik between 1 and 120),
  sonraki_bakim timestamptz,
  vektor extensions.vector(256),
  vektor_surum integer,
  olusturulan boolean not null default false,
  form_verisi jsonb,
  ziyaret jsonb check (ziyaret is null or jsonb_typeof(ziyaret) = 'object')
);
create index formlar_arama_firma_idx on public.formlar (arama_firma);
create index formlar_tarih_idx on public.formlar (tarih desc);
create index formlar_eklenme_idx on public.formlar (eklenme_tarihi);
create index formlar_sehir_idx on public.formlar (sehir);
create index formlar_firma_kodu_idx on public.formlar (firma_kodu, form_no);
create index formlar_foto_id_idx on public.formlar (foto_id);
create index formlar_imza_id_idx on public.formlar (imza_id);

create table public.firmalar (
  arama_firma text primary key check (length(arama_firma) between 1 and 200),
  yetkili text check (length(yetkili) <= 200),
  telefon text check (length(telefon) <= 40),
  adres text check (length(adres) <= 500),
  notlar text check (length(notlar) <= 5000),
  etiketler text check (length(etiketler) <= 500),
  guncelleyen text,
  guncelleme_tarihi timestamptz not null default now()
);

create table public.sayaclar (
  arama_firma text primary key,
  firma_kodu text not null check (length(firma_kodu) between 1 and 20),
  son_no integer not null default 0 check (son_no >= 0)
);
create table public.firma_kodlari (
  kod text primary key,
  arama_firma text not null unique
);

create table public.personel (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  ad text not null check (length(ad) between 1 and 100),
  ad_norm text,
  aktif boolean not null default true,
  ekleyen text,
  eklenme timestamptz not null default now()
);
create unique index personel_ad_norm_uq on public.personel (ad_norm) where ad_norm is not null;

create table public.islem_gecmisi (
  id bigint generated always as identity primary key,
  zaman timestamptz not null default now(),
  kim text not null,
  islem text not null check (length(islem) <= 200),
  hedef text check (length(hedef) <= 200),
  detay text check (length(detay) <= 500)
);
create index islem_gecmisi_zaman_idx on public.islem_gecmisi (zaman desc);
