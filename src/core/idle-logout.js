import { onAuthStateChanged, signOut } from "../veri/auth.js";
import { auth } from "../veri/init.js";

let cikisZ;

const cikisSifirla = () => { clearTimeout(cikisZ); if (auth.currentUser) cikisZ = setTimeout(() => { showToast("Uzun süre işlem yapılmadığı için çıkış yapıldı", "info"); signOut(auth); }, 30 * 60 * 1000); };

["click", "keydown", "touchstart", "scroll"].forEach(e => document.addEventListener(e, cikisSifirla, { passive: true }));

onAuthStateChanged(auth, cikisSifirla);
