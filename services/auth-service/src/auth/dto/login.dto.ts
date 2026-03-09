import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'manager@demo.com', description: 'User email address' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Manager@2026', description: 'User password' })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({
        example: '123456',
        required: false,
        description: 'Optional 6-digit MFA TOTP code when MFA is enabled.',
    })
    @IsOptional()
    @IsString()
    @Matches(/^\d{6}$/)
    mfa_code?: string;
}
