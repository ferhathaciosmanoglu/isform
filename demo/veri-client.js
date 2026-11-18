/* DEMO: sahte Supabase istemcisi. Form numarası fonksiyonu bellekte firma başına sayaç tutar. */
const sayaclar = new Map();
export const supabase = {
  rpc: async (ad, p) => {
    if (ad !== "form_no_ayir") return { data: null, error: { message: "Demo'da desteklenmiyor" } };
    const s = sayaclar.get(p.p_arama_firma) || { kod: p.p_kod_taban, son: 0 };
    const ilk = s.son + 1; s.son += p.p_adet; sayaclar.set(p.p_arama_firma, s);
    return { data: [{ firma_kodu: s.kod, ilk_no: ilk }], error: null };
  }
};
