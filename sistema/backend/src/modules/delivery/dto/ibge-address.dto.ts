import { Type } from 'class-transformer'
import { IsNumber, IsOptional } from 'class-validator'

export class IbgeReverseGeocodeDto {
  @IsNumber()
  @Type(() => Number)
  latitude: number

  @IsNumber()
  @Type(() => Number)
  longitude: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radiusMeters?: number
}
