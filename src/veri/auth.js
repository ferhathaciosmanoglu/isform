import { supabase } from "./client.js";

/* Firebase Auth benzeri küçük sarmalayıcı: uygulamanın geri kalanı (onAuthStateChanged, auth.currentUser,
   signInWithEmailAndPassword, signOut, sendPasswordResetEmail) aynen çalışır; arkada Supabase Auth vardır. */
export const auth = { currentUser: null };

const kullaniciYap = oturum => oturum && oturum.user ? {
  uid: oturum.user.id,
  email: oturum.user.email || "",
  getIdToken: async () => (await supabase.auth.getSession()).data.session?.access_token || ""
} : null;

const dinleyiciler = new Set();
let sonUid, ilkOturum;

function guncelle(oturum) {
  const k = kullaniciYap(oturum);
  auth.currentUser = k;
  const uid = k ? k.uid : "";
  if (uid === sonUid) return;   // belirteç yenilenmesi kullanıcıyı değiştirmez
  sonUid = uid;
  dinleyiciler.forEach(cb => { try { cb(k); } catch (e) { console.error(e); } });
}

function baslat() {
  if (ilkOturum) return ilkOturum;
  supabase.auth.onAuthStateChange((olay, oturum) => {
    if (olay === "INITIAL_SESSION") return;
    if (olay === "PASSWORD_RECOVERY") setTimeout(yeniSifreSor, 0);
    guncelle(oturum);
  });
  ilkOturum = supabase.auth.getSession().then(({ data }) => guncelle(data.session)).catch(e => { console.warn("Oturum okunamadı:", e); guncelle(null); });
  return ilkOturum;
}

export function onAuthStateChanged(_auth, cb) {
  dinleyiciler.add(cb);
  baslat().then(() => { if (dinleyiciler.has(cb)) cb(auth.currentUser); });
  return () => dinleyiciler.delete(cb);
}

/* Supabase hata kodlarını uygulamanın tanıdığı Firebase biçimine çevirir */
function hataYap(e) {
  const c = e.code || "", m = String(e.message || "");
  const err = new Error(m);
  err.code = c === "invalid_credentials" || /invalid login/i.test(m) ? "auth/invalid-credential"
    : c === "email_not_confirmed" ? "auth/email-not-confirmed"
    : c === "over_request_rate_limit" || e.status === 429 ? "auth/too-many-requests"
    : "auth/" + (c || "hata");
  return err;
}

export async function signInWithEmailAndPassword(_auth, eposta, sifre) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre });
  if (error) throw hataYap(error);
  guncelle(data.session);
  return { user: auth.currentUser };
}

export async function signOut() {
  await supabase.auth.signOut();
  guncelle(null);
}

export async function sendPasswordResetEmail(_auth, eposta) {
  const { error } = await supabase.auth.resetPasswordForEmail(eposta, { redirectTo: location.origin + location.pathname });
  if (error) throw hataYap(error);
}

/* Sıfırlama e-postasındaki bağlantıdan dönülünce yeni şifre sorulur */
async function yeniSifreSor() {
  for (let i = 0; i < 3; i++) {
    const s = prompt("Yeni şifrenizi girin (en az 8 karakter):");
    if (s === null) return;
    if (s.length < 8) { alert("Şifre en az 8 karakter olmalı."); continue; }
    const { error } = await supabase.auth.updateUser({ password: s });
    if (error) { alert("Şifre değiştirilemedi: " + error.message); return; }
    if (window.showToast) window.showToast("Şifreniz değiştirildi", "success");
    return;
  }
}
