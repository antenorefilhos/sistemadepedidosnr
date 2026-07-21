import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

export class CreateDeliveryAreaDto {
  @IsString()
  name: string

  @IsOptional()
  @IsIn(['CEP_RANGE', 'POLYGON', 'GEO_POLYGON'])
  type?: string

  @IsObject()
  rule: Record<string, unknown>

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fee: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumOrder?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  freeAbove?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priority?: number

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string
}

export class UpdateDeliveryAreaDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsIn(['CEP_RANGE', 'POLYGON', 'GEO_POLYGON'])
  type?: string

  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fee?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumOrder?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  freeAbove?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priority?: number

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string
}

export class CreateFulfillmentSlotDto {
  @IsIn(['DELIVERY', 'PICKUP'])
  type: string

  @IsDateString()
  startsAt: string

  @IsDateString()
  endsAt: string

  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacityOrders: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacityItems?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cutoffMinutes?: number

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'BLOCKED'])
  status?: string
}

export class UpdateFulfillmentSlotDto {
  @IsOptional()
  @IsIn(['DELIVERY', 'PICKUP'])
  type?: string

  @IsOptional()
  @IsDateString()
  startsAt?: string

  @IsOptional()
  @IsDateString()
  endsAt?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacityOrders?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacityItems?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cutoffMinutes?: number

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'BLOCKED'])
  status?: string
}

export class CreateDriverDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string
}

export class CreateDeliveryRouteDto {
  @IsOptional()
  @IsString()
  driverId?: string

  @IsOptional()
  @IsDateString()
  startsAt?: string
}

export class AddDeliveryStopDto {
  @IsString()
  orderId: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  sequence?: number

  @IsOptional()
  @IsDateString()
  eta?: string
}

export class DeliveryStopSequenceDto {
  @IsString()
  stopId: string

  @IsInt()
  @Min(1)
  @Type(() => Number)
  sequence: number
}

export class ReorderDeliveryStopsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryStopSequenceDto)
  stops: DeliveryStopSequenceDto[]
}

export class UpdateDeliveryStopStatusDto {
  @IsIn(['PENDING', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'FAILED'])
  status: string

  @IsOptional()
  @IsString()
  notes?: string
}
