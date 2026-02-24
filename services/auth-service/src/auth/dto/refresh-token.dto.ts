import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
    @ApiProperty({ description: 'The refresh token received during login or last refresh' })
    @IsString()
    @IsNotEmpty()
    refresh_token: string;
}
