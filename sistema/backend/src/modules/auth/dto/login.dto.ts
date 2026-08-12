import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  password: string
}

/**
 * Login do storefront: um unico campo que pode ser e-mail, CPF ou celular
 * (com ou sem mascara). AuthService.customerLogin detecta o tipo e normaliza.
 */
export class CustomerLoginDto {
  @IsString()
  identifier: string

  @IsString()
  @MinLength(6)
  password: string

  // aceito por compat com o admin, que ainda manda { email, password }
  @IsOptional()
  @IsString()
  email?: string
}