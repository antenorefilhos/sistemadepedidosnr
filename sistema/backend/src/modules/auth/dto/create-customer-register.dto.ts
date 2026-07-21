import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator'

export class CreateCustomerRegisterDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  cpf: string

  @IsString()
  whatsapp: string

  @IsString()
  @MinLength(6)
  password: string

  @IsOptional()
  @IsString()
  origin?: string
}
