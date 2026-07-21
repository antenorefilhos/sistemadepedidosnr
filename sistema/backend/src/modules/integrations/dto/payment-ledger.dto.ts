import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

export class CreatePaymentTransactionDto {
  @IsOptional()
  @IsString()
  provider?: string

  @IsOptional()
  @IsString()
  method?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number

  @IsOptional()
  @IsString()
  providerRef?: string

  @IsOptional()
  @IsString()
  idempotencyKey?: string

  @IsOptional()
  metadata?: Record<string, unknown>
}

export class CreateRefundDto {
  @IsString()
  orderId!: string

  @IsOptional()
  @IsString()
  transactionId?: string

  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsString()
  reason!: string

  @IsOptional()
  @IsString()
  providerRef?: string
}

export class RegisterChargebackDto {
  @IsOptional()
  @IsString()
  orderId?: string

  @IsOptional()
  @IsString()
  transactionId?: string

  @IsOptional()
  @IsString()
  providerRef?: string

  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsString()
  reason!: string
}

export class PaymentReconciliationRowDto {
  @IsString()
  providerRef!: string

  @IsNumber()
  amount!: number

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  metadata?: Record<string, unknown>
}

export class ReconcilePaymentsDto {
  @IsOptional()
  @IsString()
  provider?: string

  @IsDateString()
  from!: string

  @IsDateString()
  to!: string

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentReconciliationRowDto)
  providerRows?: PaymentReconciliationRowDto[]
}
