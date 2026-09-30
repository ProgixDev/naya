import { DomainError, type AdminPermission, type AdminUser } from '@naya/domain';

export function requirePermission(admin: AdminUser, permission: AdminPermission) {
  if (!admin.permissions.includes(permission)) {
    throw new DomainError('FORBIDDEN', 'Votre rôle ne permet pas cette action.', { permission });
  }
}
