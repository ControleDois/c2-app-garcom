import type { CartLine } from './food'

const key = (tableId: string) => `garcom/cart/${tableId}`

// O pedido em montagem fica guardado no aparelho: se o app fechar ou a rede
// cair antes de enviar, o garçom não perde o que já tinha lançado.
export function loadCart(tableId: string): CartLine[] {
  try {
    const raw = localStorage.getItem(key(tableId))
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

export function saveCart(tableId: string, lines: CartLine[]) {
  try {
    if (lines.length === 0) localStorage.removeItem(key(tableId))
    else localStorage.setItem(key(tableId), JSON.stringify(lines))
  } catch {
    // sem armazenamento: o carrinho vale só nesta tela
  }
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}
