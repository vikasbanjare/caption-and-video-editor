import type { Cue, CaptionStyle } from "@/engine";

/**
 * Local project persistence — ported from the Daxio review tool's storage layer
 * (openDB / idbPut / idbGet / idbDel). Project metadata (cues, style, notes)
 * lives in localStorage; the (large) source video Blob lives in IndexedDB. This
 * is what lets your captioning work survive a reload — the app had no
 * persistence before.
 */

/** A timestamped note pinned to the video frame (Daxio "comment"/pin, solo). */
export interface ProjectNote {
  id: string;
  /** seconds into the video */
  t: number;
  /** normalized 0..1 position on the frame, or null for an un-pinned note */
  x: number | null;
  y: number | null;
  body: string;
  resolved: boolean;
  createdAt: number;
}

/** Everything needed to reopen a caption project (minus the video bytes). */
export interface ProjectRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  language: string;
  style: CaptionStyle;
  cues: Cue[];
  notes: ProjectNote[];
  /** thumbnail data URL for the library card */
  thumb: string | null;
  video: { name: string; type: string; size: number } | null;
}

const LS = "cutpilot.projects.v1";
const DB_NAME = "cutpilot-media";
const STORE = "videos";
const vidKey = (id: string) => `vid:${id}`;

let DB: IDBDatabase | null = null;
let ready: Promise<void> | null = null;
const mem = new Map<string, Blob>(); // fallback when IndexedDB is unavailable

/** Resolves once the DB is open (or known-unavailable). Idempotent — safe to
 *  await from every op so a save that races app startup still hits IndexedDB. */
function ensureReady(): Promise<void> {
  return ready ?? initStore();
}

// ---- id / time helpers (ported from Daxio) ---------------------------------
let _i = 0;
export function uid(prefix = "id"): string {
  _i++;
  return `${prefix}${Date.now().toString(36)}${_i.toString(36)}`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** SMPTE timecode HH:MM:SS:FF (Daxio smpte()). */
export function smpte(t: number, fps = 30): string {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * fps);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

// ---- IndexedDB (video blobs) -----------------------------------------------
export function initStore(): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    try {
      const q = indexedDB.open(DB_NAME, 1);
      q.onupgradeneeded = () => {
        if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE);
      };
      q.onsuccess = () => {
        DB = q.result;
        resolve();
      };
      q.onerror = () => {
        DB = null;
        resolve();
      };
    } catch {
      resolve();
    }
  });
  return ready;
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  await ensureReady();
  return new Promise((resolve) => {
    if (!DB) {
      mem.set(key, blob);
      return resolve();
    }
    try {
      const tx = DB.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        mem.set(key, blob);
        resolve();
      };
    } catch {
      mem.set(key, blob);
      resolve();
    }
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  await ensureReady();
  return new Promise((resolve) => {
    if (mem.has(key)) return resolve(mem.get(key) ?? null);
    if (!DB) return resolve(null);
    try {
      const req = DB.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbDel(key: string): void {
  mem.delete(key);
  if (!DB) return;
  try {
    DB.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch {
    /* ignore */
  }
}

// ---- project records (localStorage) ----------------------------------------
export function listProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(arr)
      ? arr.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function getProject(id: string): ProjectRecord | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

/**
 * Insert or update a project record. Pass `blob` only when the source video
 * changed (first save of a new upload) to avoid rewriting large media.
 */
export async function saveProject(
  rec: ProjectRecord,
  blob?: Blob
): Promise<void> {
  if (blob) await idbPut(vidKey(rec.id), blob);
  const all = listProjects().filter((p) => p.id !== rec.id);
  all.push(rec);
  // localStorage can overflow on very long transcripts — degrade gracefully by
  // dropping the oldest projects until it fits, rather than throwing.
  let list = all;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      localStorage.setItem(LS, JSON.stringify(list));
      return;
    } catch {
      const sorted = [...list].sort((a, b) => a.updatedAt - b.updatedAt);
      const victim = sorted.find((p) => p.id !== rec.id);
      if (!victim) throw new Error("Could not save project (storage full).");
      idbDel(vidKey(victim.id));
      list = list.filter((p) => p.id !== victim.id);
    }
  }
}

export async function loadProjectVideo(id: string): Promise<Blob | null> {
  return idbGet(vidKey(id));
}

export function deleteProject(id: string): void {
  idbDel(vidKey(id));
  const remaining = listProjects().filter((p) => p.id !== id);
  try {
    localStorage.setItem(LS, JSON.stringify(remaining));
  } catch {
    /* ignore */
  }
}
