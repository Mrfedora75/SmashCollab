import { GoogleAuthProvider, browserPopupRedirectResolver, onAuthStateChanged, signInWithCredential, signInWithPopup, type User } from "firebase/auth";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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

async function restoredUser(): Promise<User | null> {
  const auth = await firebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

export async function signInToFirebase(options?: { popup?: boolean }): Promise<User | null> {
  const existing = await restoredUser();
  if (existing) return existing;
  const auth = await firebaseAuth();
  if (!auth) return null;

  try {
    const res = await fetch("/api/firebase/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { idToken?: string | null };
      if (data.idToken) {
        const credential = GoogleAuthProvider.credential(data.idToken);
        const signedIn = await signInWithCredential(auth, credential);
        return signedIn.user;
      }
    }
  } catch {
    // No YouTube token is available. Do not open a second Google window.
  }

  if (!options?.popup) return null;
  const provider = new GoogleAuthProvider();
  const signedIn = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  return signedIn.user;
}

export async function saveFirebaseUser(profile: DeskProfile): Promise<void> {
  const db = await firebaseDb();
  if (!db) throw new Error("Firebase is not configured.");
  const user = await restoredUser();
  if (!user) throw new Error("You are not signed in. Sign in again before saving.");
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
      // Profiles are readable by other signed-in creators, so no email here.
      email: deleteField(),
      displayName: profile.displayName || user.displayName || "",
      channel: profile.channel,
      channelId: profile.channelId ?? null,
      subscribers: profile.subscribers,
      avgViews: profile.avgViews,
      niches,
      bio: (profile.bio ?? "").slice(0, 150),
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

/** The signed-in creator's saved Firestore profile (used to restore after logout / on a new device). */
export async function loadFirebaseProfile(): Promise<DeskProfile | null> {
  const db = await firebaseDb();
  const user = await restoredUser();
  if (!db || !user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const niches = Array.isArray(data.niches) ? data.niches.filter((n): n is string => typeof n === "string") : [];
  if (typeof data.channel !== "string" || niches.length === 0) return null;
  const country = typeof data.country === "string" ? data.country : "";
  return {
    displayName: typeof data.displayName === "string" ? data.displayName : data.channel,
    channel: data.channel,
    channelId: typeof data.channelId === "string" ? data.channelId : undefined,
    subscribers: typeof data.subscribers === "number" ? data.subscribers : 0,
    avgViews: typeof data.avgViews === "number" ? data.avgViews : 0,
    niches,
    bio: typeof data.bio === "string" ? data.bio : "",
    avatar: typeof data.avatar === "string" ? data.avatar : null,
    country: country as DeskProfile["country"],
    state: (typeof data.state === "string" ? data.state : null) as DeskProfile["state"],
    county: typeof data.county === "string" ? data.county : "",
  };
}

export async function currentFirebaseUid(): Promise<string | null> {
  const user = await restoredUser();
  return user?.uid ?? null;
}
