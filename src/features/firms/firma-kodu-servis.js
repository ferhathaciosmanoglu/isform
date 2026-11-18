import { supabase } from "../../veri/client.js";
import { firmaKodTaban } from "../../lib/firma-kodu.js";

/* Form numarası ayırır: veritabanındaki form_no_ayir() fonksiyonu sayacı atomik artırır, böylece iki kişi aynı anda
   kayıt girse de aynı numara iki kez verilmez. Yeni firma kodu da orada rezerve edilir (başka firma alamaz).
   Döner: { firmaKodu, ilkNo } — ilkNo, ilkNo+1 … ilkNo+adet-1 bu kayıt için ayrılmıştır. */
export async function formNoAyir(aramaFirma, adet = 1) {
  const { data, error } = await supabase.rpc("form_no_ayir", { p_arama_firma: aramaFirma, p_kod_taban: firmaKodTaban(aramaFirma), p_adet: adet });
  if (error) { const e = new Error(error.message || "Form numarası ayrılamadı"); e.code = error.code === "42501" ? "permission-denied" : error.code; throw e; }
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) throw new Error("Form numarası ayrılamadı, tekrar deneyin");
  return { firmaKodu: r.firma_kodu, ilkNo: r.ilk_no };
}
