/**
 * SERVER-SIDE ROLE HIERARCHY & PERMISSIONS
 */

export const ROLES = {
  SUPERADMIN: 'superadmin',
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

export const PERMISSIONS = {
  PRODUCTS_READ: 'products.read',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  ORDERS_READ: 'orders.read',
  ORDERS_UPDATE: 'orders.update',
  CMS_READ: 'cms.read',
  CMS_UPDATE: 'cms.update',
  TICKETS_READ: 'tickets.read',
  TICKETS_UPDATE: 'tickets.update',
  USERS_READ: 'users.read',
  ADMINS_MANAGE: 'admins.manage'
};

export const hasPermission = (user, requiredPermission) => {
  if (!user || !user.role) return false;

  const role = user.role.toLowerCase().trim();

  // 1. Superadmin always has access
  if (role === ROLES.SUPERADMIN || role === ROLES.SUPER_ADMIN) {
    return true;
  }

  // 2. Check specific permissions
  const userPermissions = user.permissions || [];
  
  // Wildcard permission
  if (userPermissions.includes('*')) {
    return true;
  }

  if (!requiredPermission) return true;

  return userPermissions.includes(requiredPermission);
};

export const canAccess = (user, resource, action) => {
  const permission = `${resource}.${action}`;
  return hasPermission(user, permission);
};
