import { useTranslation } from '@forethread/i18n';
import { useCallback } from 'react';

/** The role-bearing shape both Pool members and nominees share. */
interface RoleBearer {
  role: string;
  customRoleName: string | null;
}

/**
 * Label a Pool member by role.
 *
 * A custom role's grant *replaced* the built-in one (FOR-253), so the custom
 * name is what actually decided their place in the Pool and is what we show —
 * "Junior Buyer" never hides inside "Foreman".
 *
 * Plurals for the built-in roles are spelled out in i18n rather than derived,
 * because "Foreman" does not pluralise by appending an "s". Custom role names
 * are user-authored and have no declared plural, so they take the naive "+s" —
 * accepted as the pragmatic limit of what we can know about a free-text name.
 */
export function useRoleLabel() {
  const { t } = useTranslation('roles');

  return useCallback(
    (member: RoleBearer, count = 1): string => {
      if (member.customRoleName) {
        return count > 1 ? `${member.customRoleName}s` : member.customRoleName;
      }
      const key = count > 1 ? 'roleNamesPlural' : 'roleNames';
      // Unknown role enum values fall back to the raw value rather than the key
      // path, so a role added to the backend before i18n never renders as
      // "roles.roleNames.NEW_ROLE".
      const label = t(`${key}.${member.role}` as never, { defaultValue: '' }) as string;
      return label || member.role;
    },
    [t],
  );
}
