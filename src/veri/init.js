import { collection, doc, setDoc } from "./firestore.js";

export { auth } from "./auth.js";

/* Yer tutucu: Firestore API'sini taklit eden katman (firestore.js) veritabanı nesnesini kullanmaz; çağrı yerleri değişmesin diye durur. */
export const db = { destek: "supabase" };

/* Çevrimdışı yazma kuyruğu yoktur (giriş için internet gerekir); yazma sonucu doğrudan beklenir. */
export const kuyrugaAl = p => p;

/* Yeni belge: kimlik istemcide üretilir, böylece başka belgeden ona bağlanılabilir. */
export async function belgeEkle(koleksiyon, veri) {
  const ref = doc(collection(db, koleksiyon));
  await setDoc(ref, veri);
  return ref;
}
