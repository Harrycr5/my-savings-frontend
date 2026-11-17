export const permissions = {
  tillsRead: "tills.read",
  tillsCreate: "tills.create",
  movementsRead: "till_movements.read",
  movementsCreate: "till_movements.create",
  conceptsRead: "till_concepts.read",
  conceptsCreate: "till_concepts.create",
  assetsRead: "inheritance_assets.read",
  assetsCreate: "inheritance_assets.create",
  assetsUpdate: "inheritance_assets.update",
  assetsDelete: "inheritance_assets.delete",
  debtsRead: "debts.read",
  debtsCreate: "debts.create",
  debtsUpdate: "debts.update",
  debtPaymentsRead: "debt_payments.read",
  debtPaymentsCreate: "debt_payments.create",
  usersRead: "users.read",
  profilesRead: "profiles.read",
  profilesCreate: "profiles.create",
  profilesUpdate: "profiles.update",
  permissionsRead: "permissions.read",
} as const

export function hasPermission(
  userPermissions: readonly string[],
  permission: string,
  isSuperAdmin = false,
) {
  return isSuperAdmin || userPermissions.includes(permission)
}

export function hasAllPermissions(
  userPermissions: readonly string[],
  requiredPermissions: readonly string[],
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true
  return requiredPermissions.every((permission) =>
    hasPermission(userPermissions, permission),
  )
}
