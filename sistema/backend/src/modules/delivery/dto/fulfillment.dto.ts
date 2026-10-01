import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

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
