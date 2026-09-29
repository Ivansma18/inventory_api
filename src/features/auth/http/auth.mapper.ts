import type {
  PublicAuthResponse,
  PublicAuthSession,
  PublicAuthUser,
} from "../auth.types.js";

interface AuthUserRecord {
  id: string;
  email: string;
  [key: string]: unknown;
}

interface AuthSessionRecord {
  id: string;
  createdAt: Date | string;
  [key: string]: unknown;
}

export function toPublicAuthUser(user: AuthUserRecord): PublicAuthUser {
  return {
    id: user.id,
    email: user.email,
  };
}

export function toPublicAuthSession(
  session: AuthSessionRecord,
): PublicAuthSession {
  return {
    id: session.id,
    createdAt:
      session.createdAt instanceof Date
        ? session.createdAt.toISOString()
        : session.createdAt,
  };
}

export function toAuthResponse(
  user: AuthUserRecord,
  session: AuthSessionRecord,
): PublicAuthResponse {
  return {
    data: {
      user: toPublicAuthUser(user),
      session: toPublicAuthSession(session),
    },
  };
}
