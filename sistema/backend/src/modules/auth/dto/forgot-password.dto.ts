import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class ForgotPasswordDto {
  @IsEmail()
  email: string
}

/**
 * Cliente (07/10/2026): pede o link pelo mesmo dado com que entra -- e-mail,
 * CPF ou celular. `email` continua aceito para o site antigo em cache.
 */
export class CustomerForgotPasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  identifier?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string
}

/** Checkout convidado (08/10/2026): os dados digitados ja sao de uma conta? */
export class CustomerAccountCheckDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string
}

export class ResetPasswordDto {
  @IsString()
  token: string

  @IsString()
  @MinLength(6)
  newPassword: string
}

export class SetPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string

  /** Obrigatoria so quando a conta ja tem senha (ver customerSetPassword). */
  @IsOptional()
  @IsString()
  currentPassword?: string
}

/** Dados que o proprio cliente muda na conta. CPF nao: e a identidade fiscal. */
export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  /** Vazio apaga o e-mail (e opcional no cadastro). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string
}
