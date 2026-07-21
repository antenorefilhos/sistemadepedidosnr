import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, Min } from 'class-validator'

export enum DeliveryZoneType {
  CEP_RANGE = 'CEP_RANGE',
  GEO_POLYGON = 'GEO_POLYGON',
}

export class CreateDeliveryZoneDto {
  @IsString()
  name: string

  @IsEnum(DeliveryZoneType)
  @IsOptional()
  type?: DeliveryZoneType

  @IsString()
  @IsOptional()
  cepStart?: string

  @IsString()
  @IsOptional()
  cepEnd?: string

  @IsString()
  @IsOptional()
  polygonGeoJSON?: string

  @IsNumber()
  @Min(0)
  fee: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  freeAbove?: number | null

  @IsBoolean()
  @IsOptional()
  active?: boolean

  @IsNumber()
  @IsOptional()
  priority?: number
}

export class UpdateDeliveryZoneDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsEnum(DeliveryZoneType)
  @IsOptional()
  type?: DeliveryZoneType

  @IsString()
  @IsOptional()
  cepStart?: string

  @IsString()
  @IsOptional()
  cepEnd?: string

  @IsString()
  @IsOptional()
  polygonGeoJSON?: string

  @IsNumber()
  @IsOptional()
  @Min(0)
  fee?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  freeAbove?: number | null

  @IsBoolean()
  @IsOptional()
  active?: boolean

  @IsNumber()
  @IsOptional()
  priority?: number
}

export class CalculateDeliveryDto {
  @IsString()
  @IsOptional()
  cep?: string

  @IsNumber()
  @IsOptional()
  lat?: number

  @IsNumber()
  @IsOptional()
  lng?: number
}
