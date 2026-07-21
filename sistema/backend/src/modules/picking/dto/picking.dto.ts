import { IsArray, IsBoolean, IsDateString, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'

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
