/** Editable profile sub-fields persisted in app_users.profile_json. */
export type SelfProfileFields = {
  pronouns?: string;
  bio?: string;
  school?: string;
  degree?: string;
  minor?: string;
  expectedGrad?: string;
  advisor?: string;
};

export type SelfProfileUpdate = {
  college?: string;
  phoneNumber?: string | null;
  firstName?: string;
  lastName?: string;
  profile?: SelfProfileFields;
};

export type SelfProfileUpdateResult =
  | { ok: true; update: SelfProfileUpdate }
  | { ok: false; status: 400 | 403; error: string };

const PROFILE_FIELD_LIMITS: Record<keyof SelfProfileFields, number> = {
  pronouns: 40,
  bio: 600,
  school: 120,
  degree: 120,
  minor: 120,
  expectedGrad: 60,
  advisor: 120,
};

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

  const firstName =
    typeof input.firstName === "string" ? input.firstName.trim().slice(0, 60) : undefined;
  const lastName =
    typeof input.lastName === "string" ? input.lastName.trim().slice(0, 60) : undefined;
  const wantsNames = firstName !== undefined || lastName !== undefined;

  let profile: SelfProfileFields | undefined;
  if (input.profile !== undefined) {
    if (!input.profile || typeof input.profile !== "object" || Array.isArray(input.profile)) {
      return { ok: false, status: 400, error: "'profile' must be an object of profile fields" };
    }
    const raw = input.profile as Record<string, unknown>;
    profile = {};
    for (const key of Object.keys(PROFILE_FIELD_LIMITS) as Array<keyof SelfProfileFields>) {
      const value = raw[key];
      if (value === undefined) continue; // field not being updated
      if (value === null || typeof value === "string") {
        const str = typeof value === "string" ? value.trim().slice(0, PROFILE_FIELD_LIMITS[key]) : "";
        profile[key] = str;
      } else {
        return { ok: false, status: 400, error: `'profile.${key}' must be a string` };
      }
    }
    if (Object.keys(profile).length === 0) {
      return { ok: false, status: 400, error: "'profile' contained no editable fields" };
    }
  }
  const wantsProfile = profile !== undefined;

  if (!wantsCollege && !wantsPhone && !wantsNames && !wantsProfile) {
    return {
      ok: false,
      status: 400,
      error: "nothing to update — send 'college', 'phoneNumber', 'firstName'/'lastName', and/or 'profile'",
    };
  }

  return {
    ok: true,
    update: {
      ...(wantsCollege ? { college } : {}),
      ...(wantsPhone ? { phoneNumber } : {}),
      ...(wantsNames
        ? {
            ...(firstName !== undefined ? { firstName } : {}),
            ...(lastName !== undefined ? { lastName } : {}),
          }
        : {}),
      ...(wantsProfile ? { profile } : {}),
    },
  };
}
