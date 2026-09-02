export type SelfProfileUpdate = {
  college?: string;
  phoneNumber?: string | null;
};

export type SelfProfileUpdateResult =
  | { ok: true; update: SelfProfileUpdate }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Validate fields a signed-in user may change on their own profile.
 * Authorization fields are intentionally rejected instead of ignored.
 */
export function parseSelfProfileUpdate(body: unknown): SelfProfileUpdateResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Request body must be an object" };
  }

  const input = body as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(input, "role")) {
    return {
      ok: false,
      status: 403,
      error: "Role changes must be performed by a campus administrator",
    };
  }

  const college = typeof input.college === "string" ? input.college.trim().slice(0, 120) : undefined;
  const wantsCollege = college !== undefined && college.length > 0;
  const wantsPhone =
    Object.prototype.hasOwnProperty.call(input, "phoneNumber") &&
    (input.phoneNumber === null || typeof input.phoneNumber === "string");
  const phoneNumber =
    typeof input.phoneNumber === "string"
      ? input.phoneNumber.trim().slice(0, 24) || null
      : null;

  if (!wantsCollege && !wantsPhone) {
    return {
      ok: false,
      status: 400,
      error: "nothing to update — send 'college' and/or 'phoneNumber'",
    };
  }

  return {
    ok: true,
    update: {
      ...(wantsCollege ? { college } : {}),
      ...(wantsPhone ? { phoneNumber } : {}),
    },
  };
}
