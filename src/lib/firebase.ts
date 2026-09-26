import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^['"]+|['"]+$/g, "");
}

function configFrom(raw: {
  apiKey?: unknown;
  authDomain?: unknown;
  projectId?: unknown;
  storageBucket?: unknown;
  messagingSenderId?: unknown;
  appId?: unknown;
  measurementId?: unknown;
} | null): FirebaseWebConfig | null {
  if (!raw) return null;
  const apiKey = clean(raw.apiKey);
  const authDomain = clean(raw.authDomain);
  const projectId = clean(raw.projectId);
  const storageBucket = clean(raw.storageBucket);
  const messagingSenderId = clean(raw.messagingSenderId);
  const appId = clean(raw.appId);
  const measurementId = clean(raw.measurementId);
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementId ? { measurementId } : {}),
  };
}

/** Values Vite inlines from import.meta.env at build time. */
export function firebaseWebConfig(): FirebaseWebConfig | null {
  return configFrom({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  });
}

async function loadFirebaseConfig(): Promise<FirebaseWebConfig | null> {
  const baked = firebaseWebConfig();
  if (typeof window === "undefined") return baked;
  try {
    const res = await fetch("/api/firebase/config", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return baked;
    const live = configFrom((await res.json()) as FirebaseWebConfig);
    return live ?? baked;
  } catch {
    return baked;
  }
}

let appPromise: Promise<FirebaseApp | null> | null = null;

export function ensureFirebase(): Promise<FirebaseApp | null> {
  if (!appPromise) {
    appPromise = loadFirebaseConfig().then((config) => {
      if (!config) return null;
      const existing = getApps()[0];
      if (existing) return existing;
      return initializeApp(config);
    });
  }
  return appPromise;
}

const authByApp = new WeakMap<FirebaseApp, Auth>();

function authFor(app: FirebaseApp): Auth {
  const cached = authByApp.get(app);
  if (cached) return cached;
  let auth: Auth;
  if (typeof window === "undefined") {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, { persistence: browserLocalPersistence });
    } catch {
      auth = getAuth(app);
    }
  }
  authByApp.set(app, auth);
  return auth;
}

export async function firebaseAuth(): Promise<Auth | null> {
  const app = await ensureFirebase();
  if (!app) return null;
  const auth = authFor(app);
  await auth.authStateReady();
  return auth;
}

export async function firebaseDb(): Promise<Firestore | null> {
  const app = await ensureFirebase();
  return app ? getFirestore(app) : null;
}
