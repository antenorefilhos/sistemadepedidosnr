import React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface AccessibleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
}

export function AccessibleInput({
  label,
  error,
  helperText,
  required,
  id,
  placeholder,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  ...props
}: AccessibleInputProps) {
  const generatedId = React.useId().replace(/:/g, '')
  const inputId = id || `input-${generatedId}`
  const describedBy = [ariaDescribedBy, error ? `${inputId}-error` : undefined, helperText && !error ? `${inputId}-helper` : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label
          htmlFor={inputId}
          className="flex items-center gap-1 text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500" aria-label="obrigatório">*</span>}
        </Label>
      )}
      <Input
        id={inputId}
        placeholder={placeholder}
        aria-label={label || placeholder || ariaLabel}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        required={required}
        className={cn(
          'h-auto w-full rounded-lg border px-3 py-2.5 transition-colors duration-150 focus-visible:ring-[#5d082a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 hover:border-gray-400',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600 flex items-center gap-1">
          ⚠️ {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  )
}

interface AccessibleSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
  required?: boolean
}

export function AccessibleSelect({
  label,
  error,
  options,
  required,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  ...props
}: AccessibleSelectProps) {
  const generatedId = React.useId().replace(/:/g, '')
  const selectId = id || `select-${generatedId}`
  const describedBy = [ariaDescribedBy, error ? `${selectId}-error` : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label
          htmlFor={selectId}
          className="flex items-center gap-1 text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500" aria-label="obrigatório">*</span>}
        </Label>
      )}
      <Select
        id={selectId}
        aria-label={label || ariaLabel}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        required={required}
        className={cn(
          'h-auto w-full rounded-lg border bg-white px-3 py-2.5 transition-colors duration-150 focus-visible:ring-[#5d082a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      {error && (
        <p id={`${selectId}-error`} className="flex items-center gap-1 text-xs text-red-600">
          ⚠️ {error}
        </p>
      )}
    </div>
  )
}

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: React.ReactNode
}

export function AccessibleButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  disabled,
  className,
  ...props
}: AccessibleButtonProps) {
  const sizeStyles = {
    sm: 'min-h-[32px] px-3 py-1.5 text-xs',
    md: 'min-h-[40px] px-4 py-2 text-sm',
    lg: 'min-h-[44px] px-6 py-2.5 text-base',
  }

  const variantStyles = {
    primary:
      'bg-[#5d082a] text-white hover:bg-[#4a0622] focus:ring-[#5d082a] disabled:bg-gray-400',
    secondary:
      'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 disabled:bg-gray-300',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:bg-red-400',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400 disabled:text-gray-400',
  }

  return (
    <Button
      disabled={disabled || isLoading}
      className={cn(
        'rounded-lg font-medium transition-colors duration-150 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  )
}
