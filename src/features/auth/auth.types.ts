export interface PublicAuthUser {
  id: string;
  email: string;
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
