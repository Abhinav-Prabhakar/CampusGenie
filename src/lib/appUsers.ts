// Server-side app user store backed by the Databricks Lakehouse.
// Mirrors Clerk identities into workspace.campus_explorer.app_users and
// owns the app-level role ('student' | 'admin') used across the UI and APIs.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";
import { executeLakehouseSql } from "@/lib/lakehouse";

export type AppUserRole = "student" | "admin";

export const DEFAULT_COLLEGE = "Databricks University";

export type AppUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  role: AppUserRole;
  college: string | null;
  phoneNumber: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function isValidRole(role: unknown): role is AppUserRole {
  return role === "student" || role === "admin";
}

function sqlString(value: string | null | undefined): string {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
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
    `SELECT * FROM workspace.campus_explorer.app_users WHERE user_id = ${sqlString(userId)}`,
    undefined,
    20
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

  const insertRes = await executeLakehouseSql(`
    INSERT INTO workspace.campus_explorer.app_users (user_id, email, first_name, last_name, role, college, phone_number, created_at, updated_at)
    VALUES (${sqlString(userId)}, ${sqlString(email)}, ${sqlString(firstName)}, ${sqlString(lastName)}, 'student', ${sqlString(DEFAULT_COLLEGE)}, ${phoneNumber ? sqlString(phoneNumber) : "NULL"}, current_timestamp(), current_timestamp())
  `);

  if (insertRes.state !== "SUCCEEDED") {
    // Lost a race with a concurrent first-login insert; read the winner's row.
    const retry = await executeLakehouseSql(
      `SELECT * FROM workspace.campus_explorer.app_users WHERE user_id = ${sqlString(userId)}`,
      undefined,
      20
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
    `SELECT role FROM workspace.campus_explorer.app_users WHERE user_id = ${sqlString(userId)}`,
    undefined,
    20
  );
  if (res.state === "SUCCEEDED" && res.records && res.records.length > 0) {
    return res.records[0].role === "admin" ? "admin" : "student";
  }
  return null;
}

export async function setUserRole(userId: string, role: AppUserRole): Promise<boolean> {
  const res = await executeLakehouseSql(`
    MERGE INTO workspace.campus_explorer.app_users AS target
    USING (SELECT ${sqlString(userId)} AS user_id, ${sqlString(role)} AS role) AS src
    ON target.user_id = src.user_id
    WHEN MATCHED THEN UPDATE SET target.role = src.role, target.updated_at = current_timestamp()
    WHEN NOT MATCHED THEN INSERT (user_id, email, first_name, last_name, role, created_at, updated_at)
      VALUES (src.user_id, NULL, NULL, NULL, src.role, current_timestamp(), current_timestamp())
  `);
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserRole] failed:", res.error);
    return false;
  }
  return true;
}

export async function setUserCollege(userId: string, college: string): Promise<boolean> {
  const res = await executeLakehouseSql(
    `UPDATE workspace.campus_explorer.app_users SET college = ${sqlString(college)}, updated_at = current_timestamp() WHERE user_id = ${sqlString(userId)}`
  );
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserCollege] failed:", res.error);
    return false;
  }
  return true;
}

export async function setUserPhoneNumber(userId: string, phone: string | null): Promise<boolean> {
  const res = await executeLakehouseSql(
    `UPDATE workspace.campus_explorer.app_users SET phone_number = ${phone ? sqlString(phone) : "NULL"}, updated_at = current_timestamp() WHERE user_id = ${sqlString(userId)}`
  );
  if (res.state !== "SUCCEEDED") {
    console.error("[setUserPhoneNumber] failed:", res.error);
    return false;
  }
  return true;
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
