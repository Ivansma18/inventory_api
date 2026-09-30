export class AuthorizationUserNotFoundError extends Error {
  constructor() {
    super("User was not found.");
    this.name = "AuthorizationUserNotFoundError";
  }
}

export class LastAdminRoleChangeError extends Error {
  constructor() {
    super("The last ADMIN cannot be demoted.");
    this.name = "LastAdminRoleChangeError";
  }
}
