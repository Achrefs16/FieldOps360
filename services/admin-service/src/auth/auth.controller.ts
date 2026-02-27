import {
    Controller,
    Post,
    Body,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from '../tenants/dto/tenant.dto';

@Controller()
export class AuthController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    // POST /api/admin/v1/login — Super Admin login
    @Post('login')
    async login(@Body() dto: LoginDto) {
        const admin = await this.prisma.platformAdmin.findUnique({
            where: { email: dto.email },
        });

        if (!admin) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = {
            sub: admin.id,
            email: admin.email,
            role: 'SUPER_ADMIN',
        };

        return {
            success: true,
            data: {
                access_token: this.jwtService.sign(payload),
                admin: {
                    id: admin.id,
                    email: admin.email,
                    first_name: admin.firstName,
                    last_name: admin.lastName,
                },
            },
        };
    }
}
