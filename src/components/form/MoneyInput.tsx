import type { ClipboardEvent, InputHTMLAttributes } from 'react'
import { formatMoneyDisplay, moneyFromPasted, moneyFromTyped } from '../../lib/money'

export interface MoneyChange {
  target: { value: string }
}

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: string | number | null | undefined
  // Recebe um "evento" com o valor já no formato do servidor ("1234.56").
  onChange?: (event: MoneyChange) => void
  allowNegative?: boolean
}

// Campo de dinheiro com máscara (1.234,56). Não deixa digitar letra nem
// separador errado; o valor guardado é sempre "1234.56".
export function MoneyInput({ value, onChange, allowNegative = false, placeholder = '0,00', ...rest }: MoneyInputProps) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = moneyFromPasted(event.clipboardData.getData('text'), allowNegative)
    if (pasted === null) return
    event.preventDefault()
    onChange?.({ target: { value: pasted } })
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={formatMoneyDisplay(value)}
      onChange={(event) => onChange?.({ target: { value: moneyFromTyped(event.target.value, allowNegative) } })}
      onPaste={handlePaste}
    />
  )
}
