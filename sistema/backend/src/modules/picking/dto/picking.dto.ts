import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'

export class CreatePickingTaskDto {
  @IsString()
  orderId: string

  @IsOptional()
  @IsString()
  assignedToId?: string

  @IsOptional()
  @IsDateString()
  slaDueAt?: string

  @IsOptional()
  @IsNumber()
  priority?: number
}

export class AssignPickingTaskDto {
  @IsString()
  pickerId: string
}

export class PickPickingItemDto {
  @IsNumber()
  @Min(0.000001)
  quantity: number

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  finalWeight?: number

  @IsOptional()
  @IsString()
  barcode?: string

  /** Como o separador confirmou: camera, EAN digitado ou marcado a mao (08/10/2026). */
  @IsOptional()
  @IsIn(['CAMERA', 'TYPED', 'MANUAL'])
  method?: 'CAMERA' | 'TYPED' | 'MANUAL'

  @IsOptional()
  @IsString()
  notes?: string
}

export class MissingPickingItemDto {
  @IsString()
  reason: string

  @IsOptional()
  @IsBoolean()
  requestSubstitution?: boolean

  @IsOptional()
  @IsString()
  notes?: string
}

/** Troca sugerida para item em falta (08/10/2026). */
export class SuggestSubstitutionDto {
  @IsString()
  productId: string

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number

  @IsOptional()
  @IsIn(['CAMERA', 'TYPED', 'MANUAL'])
  method?: 'CAMERA' | 'TYPED' | 'MANUAL'

  @IsOptional()
  @IsString()
  barcode?: string
}

export class DecideSuggestionDto {
  @IsBoolean()
  accept: boolean
}

export class SubstitutePickingItemDto {
  @IsString()
  substituteProductId: string

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number

  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class AddItemToOrderDto {
  @IsString()
  productId: string

  @IsNumber()
  @Min(0.000001)
  quantity: number

  @IsOptional()
  @IsString()
  notes?: string
}

export class ResetPickedItemDto {
  @IsOptional()
  @IsString()
  reason?: string
}

export class FinishPickingTaskDto {
  @IsOptional()
  @IsString()
  notes?: string
}

export class ConferencePickingTaskDto {
  @IsOptional()
  @IsString()
  justification?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class PackingChecklistDto {
  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsArray()
  items?: Array<Record<string, unknown>>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
