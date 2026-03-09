import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistService } from '../security/token-blacklist.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * JWT Authentication Guard — validates Bearer token on protected endpoints.
 * Uses the JwtStrategy to verify the RS256 signature.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly tokenBlacklistService: TokenBlacklistService) {
		super();
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const activated = (await super.canActivate(context)) as boolean;
		if (!activated) {
			return false;
		}

		const request = context.switchToHttp().getRequest();
		const user = request.user as JwtPayload | undefined;

		if (await this.tokenBlacklistService.isBlacklisted(user?.jti)) {
			throw new UnauthorizedException('Token revoked');
		}

		return true;
	}
}
