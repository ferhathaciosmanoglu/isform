/* DEMO modu: npm run demo → http://localhost:5174
   Veri katmanı dosyaları (src/veri/firestore.js, auth.js, client.js) bellekte çalışan sahte modüllerle değiştirilir;
   gerçek veritabanına bağlanılmaz. Görünümü denemek ve ekran görüntüsü almak içindir. Herhangi bir e-posta/şifre ile giriş yapılır. */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const kok = fileURLToPath(new URL("..", import.meta.url));
const sahte = {
  [path.join(kok, "src/veri/firestore.js")]: fileURLToPath(new URL("./veri-firestore.js", import.meta.url)),
  [path.join(kok, "src/veri/auth.js")]: fileURLToPath(new URL("./veri-auth.js", import.meta.url)),
  [path.join(kok, "src/veri/client.js")]: fileURLToPath(new URL("./veri-client.js", import.meta.url))
};
const veriSahtesi = {
  name: "enorpa-demo-veri",
  enforce: "pre",
  resolveId(kaynak, ic) {
    if (!ic || !kaynak.startsWith(".")) return null;
    return sahte[path.resolve(path.dirname(ic), kaynak)] || null;
  }
};

export default defineConfig({
  root: kok,
  base: "./",
  plugins: [veriSahtesi],
  server: { port: 5174, host: true }
});
