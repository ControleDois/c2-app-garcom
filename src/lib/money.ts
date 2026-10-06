// Dinheiro nos formulários: o campo mostra "1.234,56" e guarda, por baixo, o
// valor "1234.56" (ponto decimal) — o formato que o servidor aceita. Aceita
// também valores que já venham formatados com vírgula.

export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const text = String(value).replace(/R\$|\s/g, '')
  if (!text) return null

  let normalized = text
  if (text.includes(',')) {
    normalized = text.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.234" / "12.345.678": pontos de milhar, sem centavos
    normalized = text.replace(/\./g, '')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const displayFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatMoneyDisplay(value: string | number | null | undefined): string {
  const parsed = parseMoney(value)
  return parsed === null ? '' : displayFormatter.format(parsed)
}

export function toCanonicalMoney(value: number): string {
  return value.toFixed(2)
}

const MAX_DIGITS = 13

// O que o usuário digitou no campo vira o valor guardado: só os dígitos
// contam e preenchem da direita para a esquerda (7 5 0 0 → 75,00).
export function moneyFromTyped(typed: string, allowNegative = false): string {
  const digits = typed.replace(/\D/g, '').slice(0, MAX_DIGITS)
  if (!digits) return ''
  const amount = Number(digits) / 100
  const negative = allowNegative && typed.includes('-') && amount > 0
  return toCanonicalMoney(negative ? -amount : amount)
}

// Colar "75,00", "75.00", "R$ 1.234,56" ou "75" mantém o valor colado.
export function moneyFromPasted(text: string, allowNegative = false): string | null {
  const parsed = parseMoney(text)
  if (parsed === null) return null
  const value = allowNegative ? parsed : Math.abs(parsed)
  return toCanonicalMoney(value)
}
