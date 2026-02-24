import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ description: 'Reset token received via email' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewPass@2026', description: 'New password (min 8 chars, must contain uppercase, lowercase, number, special char)' })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/, {
        message:
            'Password must contain uppercase, lowercase, number, and special character',
    })
    new_password: string;

    @ApiProperty({ example: 'NewPass@2026', description: 'Must match new_password' })
    @IsString()
    @IsNotEmpty()
    new_password_confirmation: string;
}
