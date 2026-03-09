import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface JwtPayload {
    sub: string; // userId
    email: string;
    role: string;
    permissions: string[];
    jti: string;
    tenantId: string;
    tenantSubdomain: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const publicKeyPath =
            process.env.JWT_PUBLIC_KEY_PATH ||
            path.join(process.cwd(), 'keys', 'public.pem');

        let publicKey: string;
        try {
            publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        } catch {
            // Fallback for development — generate a warning
            console.warn(
                'WARNING: JWT public key not found. Run: npm run generate:keys',
            );
            publicKey = 'fallback-secret-for-dev-only';
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            algorithms: ['RS256'],
            secretOrKey: publicKey,
        });
    }

    /**
     * Passport calls this after verifying the JWT signature.
     * The returned object is attached to request.user.
     */
    validate(payload: JwtPayload): JwtPayload {
        if (!payload.sub || !payload.role) {
            throw new UnauthorizedException('Invalid token payload');
        }
        return payload;
    }
}
