import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsOptional,
    IsString,
    IsIn,
    IsArray,
} from 'class-validator';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'john.new@company.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsOptional()
    @IsString()
    first_name?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsOptional()
    @IsString()
    last_name?: string;

    @ApiPropertyOptional({ example: 'SITE_LEADER', enum: ['MANAGER', 'PROJECT_MANAGER', 'SITE_LEADER', 'TEAM_MEMBER'] })
    @IsOptional()
    @IsIn(['MANAGER', 'PROJECT_MANAGER', 'SITE_LEADER', 'TEAM_MEMBER'])
    role?: string;

    @ApiPropertyOptional({ example: '+1555000200' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'Senior Engineer' })
    @IsOptional()
    @IsString()
    position?: string;

    @ApiPropertyOptional({ example: ['Plumbing', 'HVAC'], type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    skills?: string[];
}
