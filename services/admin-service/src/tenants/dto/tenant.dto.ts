import {
    IsString,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    ValidateNested,
    MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class AdminUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    @IsNotEmpty()
    first_name: string;

    @IsString()
    @IsNotEmpty()
    last_name: string;
}

export class CreateTenantDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    subdomain: string;

    @IsString()
    @IsNotEmpty()
    sector: string;

    @IsUUID()
    plan_id: string;

    @IsString()
    @IsNotEmpty()
    contact_name: string;

    @IsEmail()
    contact_email: string;

    @IsOptional()
    @IsString()
    contact_phone?: string;

    @ValidateNested()
    @Type(() => AdminUserDto)
    admin_user: AdminUserDto;
}

export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;
}
