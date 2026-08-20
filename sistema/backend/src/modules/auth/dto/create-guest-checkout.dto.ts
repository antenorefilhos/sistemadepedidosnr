import { IsEmail, IsOptional, IsString } from 'class-validator'

export class CreateGuestCheckoutDto {
  @IsString()
  name: string

  @IsString()
  whatsapp: string

  @IsString()
  cpf: string

  @IsOptional()
  @IsEmail()
  email?: string
}
