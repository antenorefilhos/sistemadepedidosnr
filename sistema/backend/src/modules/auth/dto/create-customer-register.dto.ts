import { IsEmail, IsString, IsOptional, MinLength, Matches } from 'class-validator'

export class CreateCustomerRegisterDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  cpf: string

  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'WhatsApp inválido. Use DDD + número, ex: 11987654321' })
  whatsapp: string

  @IsString()
  @MinLength(6)
  password: string

  @IsOptional()
  @IsString()
  origin?: string
}
