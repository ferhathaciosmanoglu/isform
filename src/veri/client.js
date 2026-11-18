import { createClient } from "@supabase/supabase-js";
import { supabaseAnahtar, supabaseUrl } from "./config.js";

export const supabase = createClient(supabaseUrl, supabaseAnahtar, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
