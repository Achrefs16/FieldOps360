import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SsoLoginDto {
  @ApiProperty({
    example: 'ya29.a0AfH6SM...',
    description: 'OAuth provider access token issued by Google/Microsoft.',
  })
  @IsString()
  @IsNotEmpty()
  access_token: string;
}
