import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateAdminDto {
  @IsEmail()
  email: string

  @IsString()
  name: string

  @IsString()
  @MinLength(6)
  password: string

  @IsOptional()
  @IsString()
  role?: string
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string
}