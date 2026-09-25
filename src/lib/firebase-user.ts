import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { normalizeFilterNiche } from "@/data/creators";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

export function describeAuthError(error: unknown): string {
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";
    if (code && message) return message.includes(code) ? message : `${code}: ${message}`;
    if (message) return message;
  }
  return error instanceof Error ? error.message : "Sign-in failed.";
}

async function googleUser(): Promise<User> {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Firebase is not configured.");
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
  if (!db) throw new Error("Firebase is not configured.");
  const user = await googleUser();
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  const niches = profile.niches.flatMap((item) => {
    const next = normalizeFilterNiche(item);
    return next ? [next] : [];
  }).filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
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
      niches,
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
