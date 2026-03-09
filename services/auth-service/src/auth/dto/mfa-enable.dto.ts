import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MfaEnableDto {
  @ApiProperty({
    example: 'Manager@2026',
    description: 'Current password used to authorize MFA activation.',
  })
  @IsString()
  @IsNotEmpty()
  current_password: string;
}
