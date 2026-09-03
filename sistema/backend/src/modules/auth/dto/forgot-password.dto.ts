import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class ForgotPasswordDto {
  @IsEmail()
  email: string
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
