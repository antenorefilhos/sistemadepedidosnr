import { ArrayUnique, IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export const STAFF_MODULES = ['admin', 'picking', 'delivery'] as const

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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_MODULES, { each: true })
  moduleAccess?: string[]

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[]
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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_MODULES, { each: true })
  moduleAccess?: string[]

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[]
}
