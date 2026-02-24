import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            useFactory: () => {
                const privateKeyPath =
                    process.env.JWT_PRIVATE_KEY_PATH ||
                    path.join(process.cwd(), 'keys', 'private.pem');

                let privateKey: string;
                try {
                    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
                } catch {
                    console.warn(
                        'WARNING: JWT private key not found. Run: npm run generate:keys',
                    );
                    privateKey = 'fallback-secret-for-dev-only';
                }

                return {
                    privateKey,
                    signOptions: {
                        algorithm: 'RS256' as const,
                        expiresIn: Number(process.env.JWT_ACCESS_EXPIRY || 900),
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService, JwtModule],
})
export class AuthModule { }
