import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator'

export class CreateApiClientDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsArray()
  @IsString({ each: true })
  scopes: string[]

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerMinute?: number
}

export class CreateWebhookEndpointDto {
  @IsUrl({ require_tld: false })
  url: string

  @IsArray()
  @IsString({ each: true })
  events: string[]

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  description?: string
}

export class EmitWebhookEventDto {
  @IsString()
  @IsNotEmpty()
  eventType: string

  @IsObject()
  payload: Record<string, unknown>
}

export class RunWebhookDeliveriesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}
