import { IsEmail, IsString, MinLength } from 'class-validator'

export class CreateAdminDto {
  @IsEmail()
  email: string

  @IsString()
  name: string

  @IsString()
  @MinLength(6)
  password: string
}