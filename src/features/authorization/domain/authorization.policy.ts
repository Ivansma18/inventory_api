export const authorizationRoles = [
  "ADMIN",
  "MANAGER",
  "OPERATOR",
  "VIEWER",
] as const;

export type UserRole = (typeof authorizationRoles)[number];

export const authorizationPermissions = [
  "product:create",
  "product:update",
  "product:deactivate",
  "category:create",
  "category:update",
  "category:deactivate",
  "category:delete",
  "inventory:minimum-stock:update",
  "stock-movement:entry",
  "stock-movement:exit",
  "stock-movement:adjust",
  "users:list",
  "users:role:update",
] as const;

export type AuthorizationPermission = (typeof authorizationPermissions)[number];

const allPermissions = new Set<AuthorizationPermission>(
  authorizationPermissions,
);

const permissionsByRole = {
  ADMIN: allPermissions,
  MANAGER: new Set<AuthorizationPermission>([
    "product:create",
    "product:update",
    "product:deactivate",
    "category:create",
    "category:update",
    "category:deactivate",
    "category:delete",
    "inventory:minimum-stock:update",
    "stock-movement:entry",
    "stock-movement:exit",
    "stock-movement:adjust",
  ]),
  OPERATOR: new Set<AuthorizationPermission>([
    "stock-movement:entry",
    "stock-movement:exit",
    "stock-movement:adjust",
  ]),
  VIEWER: new Set<AuthorizationPermission>(),
} satisfies Record<UserRole, ReadonlySet<AuthorizationPermission>>;

export function hasPermission(
  role: UserRole,
  permission: AuthorizationPermission,
): boolean {
  return permissionsByRole[role].has(permission);
}
