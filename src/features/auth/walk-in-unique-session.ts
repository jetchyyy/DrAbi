import type { WalkInUniqueLoginProfile } from "../../lib/supabase-clinic";

const WALK_IN_UNIQUE_SESSION_KEY = "cprmed-walk-in-unique-session-v1";

export interface WalkInUniqueSessionPayload {
  uniqueLoginId: string;
  profile: WalkInUniqueLoginProfile;
}

export function readWalkInUniqueSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(WALK_IN_UNIQUE_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as WalkInUniqueSessionPayload;
    if (!parsed?.uniqueLoginId || !parsed?.profile) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveWalkInUniqueSession(payload: WalkInUniqueSessionPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    WALK_IN_UNIQUE_SESSION_KEY,
    JSON.stringify(payload),
  );
}

export function clearWalkInUniqueSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(WALK_IN_UNIQUE_SESSION_KEY);
}
