export type PublicAuthRole = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export interface PublicAuthUser {
  id: string;
  email: string;
  role: PublicAuthRole;
}

export interface PublicAuthSession {
  id: string;
  createdAt: string;
}

export interface PublicAuthResponse {
  data: {
    user: PublicAuthUser;
    session: PublicAuthSession;
  };
}

export type AuthIdentity = PublicAuthUser;
