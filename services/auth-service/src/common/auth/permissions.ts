export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'project:read',
    'project:write',
    'resource:manage',
    'report:export',
    'admin:users',
  ],
  MANAGER: ['project:read', 'project:write', 'resource:manage', 'report:export'],
  PROJECT_MANAGER: ['project:write', 'incident:write', 'report:export'],
  SITE_LEADER: ['checkin:write', 'incident:write', 'report:export'],
  TEAM_MEMBER: ['checkin:write', 'incident:write'],
};

export function resolvePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}
