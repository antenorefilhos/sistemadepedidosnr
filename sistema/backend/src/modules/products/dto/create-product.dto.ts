import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator'

export class CreateProductDto {
  @IsString()
  ean: string

  @IsString()
  name: string

  @IsOptional()
  @IsString()
  alternativeDescription?: string

  @IsOptional()
  @IsString()
  classification01?: string

  @IsOptional()
  @IsString()
  classification02?: string

  @IsOptional()
  @IsString()
  classification03?: string

  @IsOptional()
  @IsString()
  classification04?: string

  @IsNumber()
  price: number

  @IsOptional()
  @IsNumber()
  promotionalPrice?: number | null

  @IsOptional()
  stock?: number

  @IsOptional()
  @IsBoolean()
  isFractional?: boolean

  @IsOptional()
  @IsNumber()
  fractionStep?: number

  @IsOptional()
  @IsString()
  unit?: string

  @IsOptional()
  @IsString()
  badges?: string

  @IsOptional()
  @IsString()
  titleMask?: string

  @IsOptional()
  @IsString()
  titleMaskShort?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  origin?: string

  @IsOptional()
  @IsString()
  videoUrl?: string

  @IsOptional()
  @IsString()
  syncOption?: 'ESTOQUE' | 'SEMPRE' | 'NUNCA'
}
