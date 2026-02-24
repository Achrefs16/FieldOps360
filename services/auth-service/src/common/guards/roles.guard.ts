import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RBAC Guard — checks if the authenticated user's role
 * matches the required roles set by @Roles() decorator.
 *
 * Role hierarchy: SUPER_ADMIN > MANAGER > PROJECT_MANAGER > SITE_LEADER > TEAM_MEMBER
 */
@Injectable()
export class RolesGuard implements CanActivate {
    private readonly roleHierarchy: Record<string, number> = {
        SUPER_ADMIN: 5,
        MANAGER: 4,
        PROJECT_MANAGER: 3,
        SITE_LEADER: 2,
        TEAM_MEMBER: 1,
    };

    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no @Roles() decorator, allow access (only JWT auth needed)
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.role) {
            return false;
        }

        // Check if user's role is in the required roles or higher in hierarchy
        const userLevel = this.roleHierarchy[user.role] || 0;

        return requiredRoles.some((role) => {
            const requiredLevel = this.roleHierarchy[role] || 0;
            return userLevel >= requiredLevel;
        });
    }
}
