// Server-side app user store backed by the Databricks Lakehouse.
// Mirrors Clerk identities into workspace.campus_explorer.app_users and
// owns the app-level role ('student' | 'admin') used across the UI and APIs.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";
import { executeLakehouseSql } from "@/lib/lakehouse";

export type AppUserRole = "student" | "admin";

export const DEFAULT_COLLEGE = "Databricks University";

/** Editable profile fields persisted in app_users.profile_json. */
export type AppUserProfile = {
  pronouns?: string;
  bio?: string;
  school?: string; // e.g. College of Engineering (campus selector lives in `college`)
  degree?: string;
  minor?: string;
  expectedGrad?: string;
  advisor?: string;
};

export type AppUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  role: AppUserRole;
  college: string | null;
  phoneNumber: string | null;
  profile: AppUserProfile;
  createdAt?: string;
  updatedAt?: string;
};

function sqlString(value: string | null | undefined): string {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function parseProfileJson(raw: unknown): AppUserProfile {
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AppUserProfile;
    }
  } catch {
    // malformed JSON — treat as empty so edits can repair it
  }
  return {};
}

function mapRowToAppUser(r: Record<string, any>): AppUser {
  const firstName = r.first_name || null;
  const lastName = r.last_name || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || r.email?.split("@")[0] || "Student";
  return {
    userId: r.user_id,
    email: r.email || null,
    firstName,
    lastName,
    fullName,
    role: r.role === "admin" ? "admin" : "student",
    college: r.college || null,
    phoneNumber: r.phone_number || null,
    profile: parseProfileJson(r.profile_json),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Fetch the app_users row for a Clerk user id, creating it (role 'student')
 * from Clerk profile data on first sight.
 */
export async function ensureAppUser(userId: string): Promise<AppUser | null> {
  const selectRes = await executeLakehouseSql(
    "SELECT * FROM workspace.campus_explorer.app_users WHERE user_id = :user_id",
    undefined,
    20,
    [{ name: "user_id", value: userId }]
  );

  if (selectRes.state === "SUCCEEDED" && selectRes.records && selectRes.records.length > 0) {
    return mapRowToAppUser(selectRes.records[0]);
  }

  // First login for this user — mirror the Clerk identity into the Lakehouse.
  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let phoneNumber: string | null = null;
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    firstName = clerkUser.firstName ?? null;
    lastName = clerkUser.lastName ?? null;
    phoneNumber = clerkUser.primaryPhoneNumber?.phoneNumber ?? null;
  } catch (err: any) {
    console.warn("[ensureAppUser] Clerk lookup failed:", err?.message);
  }

  // Tables provisioned before the college/phone columns existed need a lazy migration.
  // SQL warehouses reject `ADD COLUMN IF NOT EXISTS`, so use plain ALTERs and
  // tolerate FIELD_ALREADY_EXISTS on tables that already have the columns.
  try {
    await executeLakehouseSql(
      "ALTER TABLE workspace.campus_explorer.app_users ADD COLUMN college STRING"
    );
  } catch {
    // college column already exists (or migration otherwise skipped) — proceed.
  }
  try {
    await executeLakehouseSql(
      "ALTER TABLE workspace.campus_explorer.app_users ADD COLUMN phone_number STRING"
    );
  } catch {
    // phone_number column already exists (or migration otherwise skipped) — proceed.
  }
  try {
    await executeLakehouseSql(
      "ALTER TABLE workspace.campus_explorer.app_users ADD COLUMN profile_json STRING"
    );
  } catch {
    // profile_json column already exists (or migration otherwise skipped) — proceed.
  }

  const insertRes = await executeLakehouseSql(`
    INSERT INTO workspace.campus_explorer.app_users (user_id, email, first_name, last_name, role, college, phone_number, profile_json, created_at, updated_at)
    VALUES (:user_id, :email, :first_name, :last_name, 'student', :college, :phone_number, NULL, current_timestamp(), current_timestamp())
  `, undefined, 30, [
    { name: "user_id", value: userId },
    { name: "email", value: email },
    { name: "first_name", value: firstName },
    { name: "last_name", value: lastName },
    { name: "college", value: DEFAULT_COLLEGE },
    { name: "phone_number", value: phoneNumber },
  ]);

  if (insertRes.state !== "SUCCEEDED") {
    // Lost a race with a concurrent first-login insert; read the winner's row.
    const retry = await executeLakehouseSql(
      "SELECT * FROM workspace.campus_explorer.app_users WHERE user_id = :user_id",
      undefined,
      20,
      [{ name: "user_id", value: userId }]
    );
    if (retry.state === "SUCCEEDED" && retry.records && retry.records.length > 0) {
      return mapRowToAppUser(retry.records[0]);
    }
    console.error("[ensureAppUser] insert failed:", insertRes.error);
    return null;
  }

  return {
    userId,
    email,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || email?.split("@")[0] || "Student",
    role: "student",
    college: DEFAULT_COLLEGE,
    phoneNumber,
    profile: {},
  };
}

/**
 * Current signed-in user with their Lakehouse role. Deduped per request.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  return ensureAppUser(userId);
});

export async function getUserRole(userId: string): Promise<AppUserRole | null> {
  const res = await executeLakehouseSql(
    "SELECT role FROM workspace.campus_explorer.app_users WHERE user_id = :user_id",
    undefined,
    20,
    [{ name: "user_id", value: userId }]
  );
  if (res.state === "SUCCEEDED" && res.records && res.records.length > 0) {
    return res.records[0].role === "admin" ? "admin" : "student";
  }
  return null;
}

export async function setUserCollege(userId: string, college: string): Promise<boolean> {
  const res = await executeLakehouseSql(
    "UPDATE workspace.campus_explorer.app_users SET college = :college, updated_at = current_timestamp() WHERE user_id = :user_id",
    undefined,
    30,
    [{ name: "college", value: college }, { name: "user_id", value: userId }]
  );
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserCollege] failed:", res.error);
    return false;
  }
  return true;
}

export async function setUserPhoneNumber(userId: string, phone: string | null): Promise<boolean> {
  const res = await executeLakehouseSql(
    "UPDATE workspace.campus_explorer.app_users SET phone_number = :phone_number, updated_at = current_timestamp() WHERE user_id = :user_id",
    undefined,
    30,
    [{ name: "phone_number", value: phone }, { name: "user_id", value: userId }]
  );
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserPhoneNumber] failed:", res.error);
    return false;
  }
  return true;
}

/** Update the display name columns (our Lakehouse mirror owns it after first login). */
export async function setUserNames(userId: string, firstName: string | null, lastName: string | null): Promise<boolean> {
  const res = await executeLakehouseSql(
    `UPDATE workspace.campus_explorer.app_users SET first_name = ${firstName ? sqlString(firstName) : "NULL"}, last_name = ${lastName ? sqlString(lastName) : "NULL"}, updated_at = current_timestamp() WHERE user_id = ${sqlString(userId)}`
  );
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserNames] failed:", res.error);
    return false;
  }
  return true;
}

/** Merge a partial profile patch into app_users.profile_json and return the merged value. */
export async function patchUserProfile(userId: string, patch: AppUserProfile): Promise<AppUserProfile | null> {
  const select = await executeLakehouseSql(
    `SELECT profile_json FROM workspace.campus_explorer.app_users WHERE user_id = ${sqlString(userId)}`,
    undefined,
    20
  );
  if (select.state !== "SUCCEEDED") {
    console.error("[patchUserProfile] select failed:", select.error);
    return null;
  }
  const current: AppUserProfile =
    select.records && select.records.length > 0 ? parseProfileJson(select.records[0].profile_json) : {};

  const merged: AppUserProfile = { ...current };
  for (const key of Object.keys(patch) as Array<keyof AppUserProfile>) {
    const value = patch[key];
    if (typeof value === "string") {
      if (value.trim().length > 0) {
        (merged as Record<string, string>)[key] = value.trim();
      } else {
        // explicit empty string clears the field
        delete (merged as Record<string, string>)[key];
      }
    }
  }

  const json = JSON.stringify(merged).replace(/'/g, "''");
  const update = await executeLakehouseSql(
    `UPDATE workspace.campus_explorer.app_users SET profile_json = '${json}', updated_at = current_timestamp() WHERE user_id = ${sqlString(userId)}`
  );
  if (update.state !== "SUCCEEDED") {
    console.error("[patchUserProfile] update failed:", update.error);
    return null;
  }
  return merged;
}

/**
 * Guard result for API routes: either an authenticated admin, or a ready-to-
 * return error response (401 unauthenticated / 403 wrong role).
 */
export async function requireAdminUser(): Promise<
  { user: AppUser; error?: undefined } | { user?: undefined; error: { status: number; message: string } }
> {
  const user = await getCurrentUser();
  if (!user) return { error: { status: 401, message: "Sign in required" } };
  if (user.role !== "admin") return { error: { status: 403, message: "Admin access required" } };
  return { user };
}
