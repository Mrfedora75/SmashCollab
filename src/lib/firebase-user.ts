import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

async function googleUser(): Promise<User | null> {
  const auth = firebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  try {
    const res = await fetch("/api/firebase/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { idToken?: string };
      if (data.idToken) {
        const credential = GoogleAuthProvider.credential(data.idToken);
        const signedIn = await signInWithCredential(auth, credential);
        return signedIn.user;
      }
    }
  } catch {
    // Fall through to the Firebase Google popup.
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const signedIn = await signInWithPopup(auth, provider);
  return signedIn.user;
}

export async function saveFirebaseUser(profile: DeskProfile): Promise<void> {
  const db = firebaseDb();
  if (!db) return;
  const user = await googleUser();
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName: profile.displayName || user.displayName || "",
      channel: profile.channel,
      channelId: profile.channelId ?? null,
      subscribers: profile.subscribers,
      avgViews: profile.avgViews,
      niches: profile.niches,
      bio: profile.bio ?? "",
      avatar: profile.avatar ?? user.photoURL ?? null,
      country: profile.country ?? "",
      state: profile.country === "us" ? (profile.state ?? null) : null,
      county: profile.county?.trim().slice(0, 40) ?? "",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}
