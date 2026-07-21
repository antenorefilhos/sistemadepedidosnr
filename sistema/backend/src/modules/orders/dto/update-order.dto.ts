import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator'

export class UpdateOrderDto {
  @IsOptional()
  @IsArray()
  items?: Array<{ productId: string; quantity: number }>

  @IsOptional()
  @IsNumber()
  delivery?: number

  @IsOptional()
  @IsNumber()
  discount?: number

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  paymentStatus?: string

  @IsOptional()
  @IsString()
  paymentMethod?: string
}
