/* Supabase Edge Function: AI proxy + sesli asistan. Mantık handler.js içindedir (Web standart API'leri; birim testli).
   JWT'yi platform değil handler doğrular (verify_jwt = false): /asistan Siri anahtarıyla, diğer yollar kullanıcı oturumuyla çalışır. */
import handler from "./handler.js";

Deno.serve((istek: Request) => handler.fetch(istek, {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY"),
  SHORTCUT_TOKEN: Deno.env.get("SHORTCUT_TOKEN"),
  IZINLI_ORIGINLER: Deno.env.get("IZINLI_ORIGINLER"),
}));
