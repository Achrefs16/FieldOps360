import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password for verification' })
    @IsString()
    @IsNotEmpty()
    current_password: string;

    @ApiProperty({ example: 'NewStr0ng@Pass', description: 'New password (min 8 chars, uppercase, lowercase, number, special char)' })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/, {
        message:
            'Password must contain uppercase, lowercase, number, and special character',
    })
    new_password: string;

    @ApiProperty({ example: 'NewStr0ng@Pass', description: 'Must match new_password' })
    @IsString()
    @IsNotEmpty()
    new_password_confirmation: string;
}
