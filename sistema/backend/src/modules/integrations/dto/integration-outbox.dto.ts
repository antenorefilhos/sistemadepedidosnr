import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateIntegrationConnectorDto {
  @IsString()
  @IsNotEmpty()
  type: string

  @IsString()
  @IsNotEmpty()
  provider: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>
}

export class EnqueueOutboxEventDto {
  @IsOptional()
  @IsString()
  connectorId?: string

  @IsOptional()
  @IsString()
  connectorType?: string

  @IsOptional()
  @IsString()
  provider?: string

  @IsString()
  @IsNotEmpty()
  aggregate: string

  @IsString()
  @IsNotEmpty()
  aggregateId: string

  @IsString()
  @IsNotEmpty()
  type: string

  @IsObject()
  payload: Record<string, unknown>

  @IsOptional()
  @IsString()
  idempotencyKey?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number
}

export class RunOutboxWorkerDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}
