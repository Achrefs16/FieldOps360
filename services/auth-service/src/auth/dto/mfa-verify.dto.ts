import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  code: string;
}
