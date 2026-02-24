import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    IsOptional,
    IsIn,
    IsArray,
    MinLength,
    Matches,
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'john@company.com', description: 'User email (must be unique within tenant)' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Str0ng@Pass', description: 'Min 8 chars with uppercase, lowercase, number, special char' })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/, {
        message:
            'Password must contain uppercase, lowercase, number, and special character',
    })
    password: string;

    @ApiProperty({ example: 'John', description: 'First name' })
    @IsString()
    @IsNotEmpty()
    first_name: string;

    @ApiProperty({ example: 'Doe', description: 'Last name' })
    @IsString()
    @IsNotEmpty()
    last_name: string;

    @ApiProperty({ example: 'PROJECT_MANAGER', enum: ['MANAGER', 'PROJECT_MANAGER', 'SITE_LEADER', 'TEAM_MEMBER'] })
    @IsIn(['MANAGER', 'PROJECT_MANAGER', 'SITE_LEADER', 'TEAM_MEMBER'])
    role: string;

    @ApiPropertyOptional({ example: '+1555000100' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'Electrician' })
    @IsOptional()
    @IsString()
    position?: string;

    @ApiPropertyOptional({ example: ['Wiring', 'Installation'], type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    skills?: string[];
}
