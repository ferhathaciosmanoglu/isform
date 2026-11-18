/* Supabase web ayarları. Bu iki değer gizli değildir (tarayıcıya zaten iner); güvenlik veritabanındaki
   satır düzeyi güvenlik (RLS) politikalarıyla sağlanır. Başka bir projeye geçmek için .env dosyasında
   VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değişkenlerini verin. */
const env = import.meta.env || {};

export const supabaseUrl = env.VITE_SUPABASE_URL || "https://ohmbnassfbtsxwgozuhj.supabase.co";
export const supabaseAnahtar = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_XKaVSBTOVU-3sHpL-3mpFQ_MtM903ie";
export const FOTO_DEPO = "form-fotograflari";
