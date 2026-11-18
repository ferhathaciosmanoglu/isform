-- Sesli asistan (Siri/Android kestirmesi) için: yalnızca service_role (Edge Function) çağırabilir; tarayıcıdaki kullanıcılar çağıramaz.
create or replace function public.asistan_son_kayitlar(p_adet integer default 200)
returns table (tarih timestamptz, firma_adi text, sehir text, islem_tipi text, aciklama text)
language sql stable security definer set search_path = '' as $$
  select f.tarih, f.firma_adi, f.sehir, f.islem_tipi, f.aciklama
  from public.formlar f order by f.tarih desc limit least(greatest(coalesce(p_adet, 200), 1), 200)
$$;
revoke all on function public.asistan_son_kayitlar(integer) from public, anon, authenticated;
grant execute on function public.asistan_son_kayitlar(integer) to service_role;

create or replace function public.asistan_logla(p_kim text, p_detay text) returns void
language sql security definer set search_path = '' as $$
  insert into public.islem_gecmisi (kim, islem, hedef, detay)
  values (left(p_kim, 200), 'Sesli asistan sorusu', '', left(p_detay, 200))
$$;
revoke all on function public.asistan_logla(text, text) from public, anon, authenticated;
grant execute on function public.asistan_logla(text, text) to service_role;
