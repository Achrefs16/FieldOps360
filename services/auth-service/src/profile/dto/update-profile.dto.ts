import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'Ahmed' })
    @IsOptional()
    @IsString()
    first_name?: string;

    @ApiPropertyOptional({ example: 'Benali' })
    @IsOptional()
    @IsString()
    last_name?: string;

    @ApiPropertyOptional({ example: '+1555000300' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'fr', enum: ['fr', 'en', 'ar'] })
    @IsOptional()
    @IsIn(['fr', 'en', 'ar'])
    language?: string;

    @ApiPropertyOptional({ example: 'Africa/Algiers' })
    @IsOptional()
    @IsString()
    timezone?: string;
}
