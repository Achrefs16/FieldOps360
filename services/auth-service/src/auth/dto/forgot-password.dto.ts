import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'manager@demo.com', description: 'Email address of the account to reset' })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
