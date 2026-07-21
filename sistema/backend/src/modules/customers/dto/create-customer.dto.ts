import { IsString, IsEmail, IsOptional } from 'class-validator'

export class CreateCustomerDto {
  @IsString()
  name: string

  @IsString()
  cpf: string

  @IsString()
  whatsapp: string

  @IsOptional()
  @IsEmail()
  email?: string
}
