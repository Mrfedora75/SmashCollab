import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, serverTimestamp, deleteDoc, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
const env = await initializeTestEnvironment({ projectId: "demo-smash", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 } });
const A = env.authenticatedContext("alice").firestore();
const B = env.authenticatedContext("bob").firestore();
const C = env.authenticatedContext("carol").firestore();
const anon = env.unauthenticatedContext().firestore();
let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log("ok  ", name); } catch (e) { fail++; console.log("FAIL", name, e.message?.slice(0,120)); } }
/** Writes done by the server (service account bypasses rules). */
async function server(fn) { await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore())); }
const prof = (uid) => ({ uid, displayName: "X", channel: "@x", channelId: "UC1", avgViews: 1, niches: ["Gaming"], bio: "", avatar: null, country: "", state: null, county: "", updatedAt: serverTimestamp() });

// ---- profiles
await t("own profile write", assertSucceeds(setDoc(doc(A, "users/alice"), prof("alice"))));
await t("other profile write denied", assertFails(setDoc(doc(A, "users/bob"), prof("bob"))));
await t("email field denied", assertFails(setDoc(doc(A, "users/alice"), { ...prof("alice"), email: "a@b.c" })));
await t("signed-in read profile", assertSucceeds(getDoc(doc(B, "users/alice"))));
await t("anon read profile denied", assertFails(getDoc(doc(anon, "users/alice"))));
await t("create with subscriberCount denied", assertFails(setDoc(doc(C, "users/carol"), { ...prof("carol"), subscriberCount: 1 })));
await t("create with legacy subscribers denied", assertFails(setDoc(doc(C, "users/carol"), { ...prof("carol"), subscribers: 1 })));
await t("create with plus denied", assertFails(setDoc(doc(C, "users/carol"), { ...prof("carol"), plus: true, plusUntil: 9e12 })));
await server((db) => updateDoc(doc(db, "users/alice"), { subscriberCount: 1200, subscribers: 1200, verifiedChannelId: "UCalice", plus: true, plusUntil: 9e12 }));
await t("owner edit keeps server fields", assertSucceeds(setDoc(doc(A, "users/alice"), { ...prof("alice"), bio: "new bio" }, { merge: true })));
await t("owner can't change subscriberCount", assertFails(updateDoc(doc(A, "users/alice"), { subscriberCount: 1 })));
await t("owner can't change subscribers", assertFails(updateDoc(doc(A, "users/alice"), { subscribers: 1 })));
await t("owner can't set plus false->true / change plus", assertFails(updateDoc(doc(A, "users/alice"), { plus: false })));
await t("owner can't extend plusUntil", assertFails(updateDoc(doc(A, "users/alice"), { plusUntil: 9e13 })));
await t("owner can't change verifiedChannelId", assertFails(updateDoc(doc(A, "users/alice"), { verifiedChannelId: "UCother" })));
await t("owner can't overwrite profile without server fields", assertFails(setDoc(doc(A, "users/alice"), prof("alice"))));
await t("new profile without subscribers ok", assertSucceeds(setDoc(doc(B, "users/bob"), prof("bob"))));
await t("bob can't grant himself plus", assertFails(setDoc(doc(B, "users/bob"), { plus: true, plusUntil: 9e12 }, { merge: true })));

// ---- swipes: pitches are server-only
const sw = (from, to, direction) => ({ from, to, direction, note: "hi", createdAt: serverTimestamp() });
await t("client pitch create denied", assertFails(setDoc(doc(A, "swipes/alice_bob"), sw("alice", "bob", "pitch"))));
await t("own pass create", assertSucceeds(setDoc(doc(C, "swipes/carol_bob"), sw("carol", "bob", "pass"))));
await t("pass -> pitch update denied", assertFails(updateDoc(doc(C, "swipes/carol_bob"), { direction: "pitch" })));
await t("pass -> pitch overwrite denied", assertFails(setDoc(doc(C, "swipes/carol_bob"), sw("carol", "bob", "pitch"))));
await t("forged pass denied", assertFails(setDoc(doc(C, "swipes/bob_carol"), sw("bob", "carol", "pass"))));
await t("self swipe denied", assertFails(setDoc(doc(A, "swipes/alice_alice"), sw("alice", "alice", "pass"))));
await server((db) => setDoc(doc(db, "swipes/alice_bob"), { from: "alice", to: "bob", direction: "pitch", note: "hi", createdAt: Timestamp.now() }));
await t("target reads pitch", assertSucceeds(getDoc(doc(B, "swipes/alice_bob"))));
await t("third party can't read pitch", assertFails(getDoc(doc(C, "swipes/alice_bob"))));
await t("match before mutual denied", assertFails(setDoc(doc(A, "matches/alice_bob"), { users: ["alice", "bob"], createdAt: serverTimestamp(), blockedBy: null, lastMessageAt: null })));
await t("carol passes alice", assertSucceeds(setDoc(doc(C, "swipes/carol_alice"), sw("carol", "alice", "pass"))));
await t("alice can't read carol's pass", assertFails(getDoc(doc(A, "swipes/carol_alice"))));
await server((db) => setDoc(doc(db, "swipes/bob_alice"), { from: "bob", to: "alice", direction: "pitch", note: "yo", createdAt: Timestamp.now() }));
await t("carol can't create alice_bob match", assertFails(setDoc(doc(C, "matches/alice_bob"), { users: ["alice", "bob"], createdAt: serverTimestamp(), blockedBy: null, lastMessageAt: null })));
await t("get nonexistent match ok", assertSucceeds(getDoc(doc(B, "matches/alice_bob"))));
await t("client match create denied even after mutual pitch", assertFails(setDoc(doc(B, "matches/alice_bob"), { users: ["alice", "bob"], createdAt: serverTimestamp(), blockedBy: null, lastMessageAt: null })));
await server((db) => setDoc(doc(db, "matches/alice_bob"), { users: ["alice", "bob"], createdAt: Timestamp.now(), blockedBy: null, lastMessageAt: null }));

// ---- matches & messages (client-written, match membership checked)
await t("carol can't read match", assertFails(getDoc(doc(C, "matches/alice_bob"))));
await t("participant message", assertSucceeds(addDoc(collection(A, "matches/alice_bob/messages"), { from: "alice", text: "hey", createdAt: serverTimestamp() })));
await t("spoofed from denied", assertFails(addDoc(collection(A, "matches/alice_bob/messages"), { from: "bob", text: "hey", createdAt: serverTimestamp() })));
await t("carol can't message", assertFails(addDoc(collection(C, "matches/alice_bob/messages"), { from: "carol", text: "hey", createdAt: serverTimestamp() })));
await t("carol can't read messages", assertFails(getDocs(collection(C, "matches/alice_bob/messages"))));
await t("bob reads messages", assertSucceeds(getDocs(collection(B, "matches/alice_bob/messages"))));
await t("lastMessageAt bump", assertSucceeds(updateDoc(doc(A, "matches/alice_bob"), { lastMessageAt: serverTimestamp() })));
await t("can't change users", assertFails(updateDoc(doc(A, "matches/alice_bob"), { users: ["alice", "carol"] })));
await t("alice blocks", assertSucceeds(updateDoc(doc(A, "matches/alice_bob"), { blockedBy: "alice" })));
await t("bob can't unblock alice's block", assertFails(updateDoc(doc(B, "matches/alice_bob"), { blockedBy: null })));
await t("no messages while blocked", assertFails(addDoc(collection(B, "matches/alice_bob/messages"), { from: "bob", text: "hey", createdAt: serverTimestamp() })));
await t("alice unblocks", assertSucceeds(updateDoc(doc(A, "matches/alice_bob"), { blockedBy: null })));
await t("my swipes query", assertSucceeds(getDocs(query(collection(A, "swipes"), where("from", "==", "alice")))));
await t("inbound query", assertSucceeds(getDocs(query(collection(A, "swipes"), where("to", "==", "alice"), where("direction", "==", "pitch")))));
await t("inbound query without direction denied", assertFails(getDocs(query(collection(A, "swipes"), where("to", "==", "alice")))));
await t("matches query", assertSucceeds(getDocs(query(collection(A, "matches"), where("users", "array-contains", "alice")))));
await t("users list", assertSucceeds(getDocs(collection(A, "users"))));
await t("pitch note edit", assertSucceeds(updateDoc(doc(A, "swipes/alice_bob"), { note: "new" })));
await t("can't retarget swipe", assertFails(updateDoc(doc(A, "swipes/alice_bob"), { to: "carol" })));
await t("can't re-stamp a pitch (would dodge the daily counter)", assertFails(updateDoc(doc(A, "swipes/alice_bob"), { createdAt: serverTimestamp() })));
await t("withdraw pitch -> pass", assertSucceeds(updateDoc(doc(A, "swipes/alice_bob"), { direction: "pass", createdAt: serverTimestamp() })));
await t("delete own swipe", assertSucceeds(deleteDoc(doc(C, "swipes/carol_alice"))));

// ---- server-only collections
await t("entitlements read denied", assertFails(getDoc(doc(A, "entitlements/UC1"))));
await t("entitlements write denied", assertFails(setDoc(doc(A, "entitlements/UC1"), { plusUntil: 9e12 })));
await t("stripeSessions denied", assertFails(setDoc(doc(A, "stripeSessions/x"), { a: 1 })));
await t("channels read denied", assertFails(getDoc(doc(A, "channels/UCalice"))));
await t("channels write denied", assertFails(setDoc(doc(A, "channels/UCalice"), { subscriberCount: 1, uid: "alice" })));
await t("pitchUsage write denied", assertFails(setDoc(doc(A, "pitchUsage/alice"), { day: "2026-01-01", count: 0 })));
await t("pitchUsage read denied", assertFails(getDoc(doc(A, "pitchUsage/alice"))));
await t("other collection denied", assertFails(setDoc(doc(A, "random/x"), { a: 1 })));
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
