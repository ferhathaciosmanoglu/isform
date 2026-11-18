/* Duman testi: gerçek Supabase istemcisi yerine sahte (form numarası RPC'si dışında bir şey çağrılmaz) */
export const supabase = { rpc: async () => ({ data: [{ firma_kodu: "TEST", ilk_no: 1 }], error: null }) };
