import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard — validates Bearer token on protected endpoints.
 * Uses the JwtStrategy to verify the RS256 signature.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
