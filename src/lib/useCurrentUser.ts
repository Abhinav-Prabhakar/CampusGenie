"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  role: "student" | "admin";
};

export function initialsFor(user: CurrentUser | null): string {
  if (!user) return "CG";
  const a = user.firstName?.[0] ?? "";
  const b = user.lastName?.[0] ?? user.email?.[0] ?? "";
  const mono = (a + b).toUpperCase();
  return mono || "CG";
}

let userCache: CurrentUser | null = null;
let inflight: Promise<CurrentUser | null> | null = null;

export function refreshCurrentUser(): Promise<CurrentUser | null> {
  if (inflight) return inflight;
  inflight = fetch("/api/users", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      userCache = data.user ?? null;
      window.dispatchEvent(new Event("cg-user-updated"));
      return userCache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function setCurrentUserCached(user: CurrentUser | null) {
  userCache = user;
  window.dispatchEvent(new Event("cg-user-updated"));
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(userCache);
  const [loading, setLoading] = useState(userCache === null);

  useEffect(() => {
    const sync = () => {
      setUser(userCache);
      setLoading(false);
    };
    sync();
    if (userCache === null) {
      refreshCurrentUser().then(() => setLoading(false));
    }
    window.addEventListener("cg-user-updated", sync);
    return () => window.removeEventListener("cg-user-updated", sync);
  }, []);

  return { user, loading };
}
