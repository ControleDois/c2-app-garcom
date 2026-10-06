import { apiGet, apiPost } from './api'
import { connectSocket, getSocketId } from './socket'

export type TableStatus = 'open_empty' | 'open_with_items' | 'closed' | 'canceled'

export interface TableItem {
  id: string
  item: number
  product_id: string
  product_code: string
  name: string
  quantity: number
  unit_price: number
  total: number
  removed: boolean
  pending_print: boolean
  observation: string | null
  food_order_id: string | null
  user_id: string | null
  moment: string | null
}

export interface TablePayment {
  form_payment: number
  amount: number
}

export interface TablePartial {
  id: string
  received: number
  description: string
  moment: string | null
  payments: TablePayment[]
}

export type AuditType = 'default' | 'success' | 'danger' | 'warning'

export interface TableAudit {
  id: string
  description: string
  reason: string
  type: AuditType
  moment: string | null
}

export interface FoodTable {
  id: string
  number: number
  status: TableStatus
  opened_at: string
  closed_at: string | null
  items: TableItem[]
  orders: { id: string; moment: string | null }[]
  partials: TablePartial[]
  sales: { id: string; total: number }[]
  audit: TableAudit[]
  isDelivery: boolean
}

export const DELIVERY_TABLE_MIN = 9000
export const DELIVERY_TABLE_MAX = 9999
export const BILL_REQUESTED = 'CONTA SOLICITADA'

export const PAYMENT_METHODS: { value: number; label: string }[] = [
  { value: 9, label: 'Dinheiro' },
  { value: 2, label: 'Débito' },
  { value: 1, label: 'Crédito' },
  { value: 10, label: 'PIX' },
]

export function paymentLabel(method: number): string {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? 'Outro'
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const nowIso = () => new Date().toISOString()

// Formato cru do servidor (preloads Lucid, snake_case) -> modelo do app.
export function normalizeRemoteTable(raw: any): FoodTable {
  const items: TableItem[] = (raw.items || []).map((item: any) => ({
    id: item.id,
    item: Number(item.item || 0),
    product_id: item.product_id,
    product_code: item.product_code || '',
    name: item.name || '',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total: Number(item.total || 0),
    removed: Boolean(item.is_removed ?? item.removed),
    pending_print: Boolean(item.pending_print),
    observation: item.observation || null,
    food_order_id: item.food_order_id ?? null,
    user_id: item.user_id ?? null,
    moment: item.moment || item.created_at || null,
  }))

  const activeCount = items.filter((item) => !item.removed).length
  let status: TableStatus
  if (raw.status === 2 || raw.status === '2') status = 'closed'
  else if (raw.status === 3 || raw.status === '3') status = 'canceled'
  else status = activeCount > 0 ? 'open_with_items' : 'open_empty'

  const number = Number(raw.number || 0)
  const delivery = raw.delivery_order || raw.$extras?.delivery_order

  return {
    id: raw.id,
    number,
    status,
    opened_at: raw.opened_at || nowIso(),
    closed_at: raw.closed_at || null,
    items,
    orders: (raw.orders || []).map((order: any) => ({
      id: order.id,
      moment: order.moment || order.created_at || null,
    })),
    partials: (raw.partial_receipts || raw.partials || []).map((partial: any) => ({
      id: partial.id,
      received: Number(partial.received_amount ?? partial.received ?? 0),
      description: partial.description || '',
      moment: partial.moment || partial.created_at || null,
      payments: partial.payments || [],
    })),
    sales: (raw.sales || []).map((sale: any) => ({ id: sale.id, total: Number(sale.total || 0) })),
    audit: (raw.audits || raw.audit || []).map((audit: any) => ({
      id: audit.id,
      description: audit.history || audit.description || '',
      reason: audit.reason || '',
      type: (audit.type as AuditType) || 'default',
      moment: audit.moment || audit.created_at || null,
    })),
    isDelivery: Boolean(delivery) || (number >= DELIVERY_TABLE_MIN && number <= DELIVERY_TABLE_MAX),
  }
}

export function activeItems(table: FoodTable): TableItem[] {
  return table.items.filter((item) => !item.removed)
}

export function tableSubtotal(table: FoodTable): number {
  return activeItems(table).reduce((sum, item) => sum + item.total, 0)
}

export function tablePartialTotal(table: FoodTable): number {
  return table.partials.reduce((sum, partial) => sum + partial.received, 0)
}

export function tableRemaining(table: FoodTable): number {
  return Math.max(0, Math.round((tableSubtotal(table) - tablePartialTotal(table)) * 100) / 100)
}

// "CONTA SOLICITADA" depois do último lançamento = o cliente já pediu a conta.
export function billRequested(table: FoodTable): boolean {
  const lastOrder =
    table.orders
      .map((order) => order.moment)
      .filter(Boolean)
      .sort()
      .pop() ?? ''
  return table.audit.some((entry) => entry.description === BILL_REQUESTED && (entry.moment ?? '') >= lastOrder)
}

export function lastActivity(table: FoodTable): string {
  const moments = [table.opened_at, ...table.orders.map((order) => order.moment ?? '')].filter(Boolean).sort()
  return moments[moments.length - 1] ?? table.opened_at
}

// ---------- API ----------

export async function fetchTables(token: string, companyId: string): Promise<FoodTable[]> {
  const raw = await apiGet<unknown[]>('/food/sync/pull', { companyId }, token)
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeRemoteTable)
    .filter((table) => !table.isDelivery && (table.status === 'open_empty' || table.status === 'open_with_items'))
    .sort((a, b) => a.number - b.number)
}

interface SyncPayload {
  device_id: string
  id: string
  companyId: string
  number: number
  status: TableStatus
  opened_at: string
  closed_at: string | null
  items: unknown[]
  orders: unknown[]
  partials: unknown[]
  sales: unknown[]
  audit: unknown[]
}

export function syncTable(token: string, companyId: string, payload: SyncPayload) {
  return apiPost<{ success: boolean }>('/food/sync', payload, token, { companyId })
}

function basePayload(table: Pick<FoodTable, 'id' | 'number' | 'opened_at'>, companyId: string): SyncPayload {
  return {
    device_id: getSocketId() || '',
    id: table.id,
    companyId,
    number: table.number,
    status: 'open_with_items',
    opened_at: table.opened_at,
    closed_at: null,
    items: [],
    orders: [],
    partials: [],
    sales: [],
    audit: [],
  }
}

function auditEntry(author: Author, description: string, type: AuditType, reason = '', requestedByClient = false) {
  return {
    id: newId(),
    user_id: author.id,
    moment: nowIso(),
    description,
    reason,
    author: author.id,
    author_name: author.name,
    type,
    requested_by_client: requestedByClient,
  }
}

export interface Author {
  id: string
  name: string
}

export interface CartLine {
  product_id: string
  code: string
  name: string
  unit_price: number
  quantity: number
  observation: string
}

// Abre uma mesa nova (vazia). O servidor só grava as mesas que o app manda.
export async function openTable(token: string, companyId: string, number: number): Promise<FoodTable> {
  const table = { id: newId(), number, opened_at: nowIso() }
  await syncTable(token, companyId, { ...basePayload(table, companyId), status: 'open_empty' })
  return {
    ...table,
    status: 'open_empty',
    closed_at: null,
    items: [],
    orders: [],
    partials: [],
    sales: [],
    audit: [],
    isDelivery: false,
  }
}

// Lança um pedido (vários itens de uma vez): 1 pedido + os itens ligados a ele.
// Só os registros novos vão; o servidor grava por id sem mexer no resto da mesa.
export function sendOrder(token: string, companyId: string, table: FoodTable, lines: CartLine[], author: Author) {
  const orderId = newId()
  const moment = nowIso()
  const firstNumber = table.items.reduce((max, item) => Math.max(max, item.item), 0) + 1

  const items = lines.map((line, index) => ({
    id: newId(),
    food_order_id: orderId,
    user_id: author.id,
    item: firstNumber + index,
    product_id: line.product_id,
    code: line.code,
    product_code: line.code,
    name: line.name,
    quantity: line.quantity,
    unit_value: line.unit_price,
    unit_price: line.unit_price,
    sub_total: line.unit_price * line.quantity,
    total: line.unit_price * line.quantity,
    removed: false,
    pending_print: true,
    observation: line.observation || undefined,
    author: author.id,
    author_name: author.name,
    moment,
  }))

  const audit = lines.map((line) =>
    auditEntry(
      author,
      `LANÇOU ${line.quantity} ${line.name}${line.observation ? ` (${line.observation})` : ''}`,
      'default'
    )
  )

  return syncTable(token, companyId, {
    ...basePayload(table, companyId),
    status: 'open_with_items',
    orders: [
      {
        id: orderId,
        user_id: author.id,
        moment,
        author: author.id,
        author_name: author.name,
        items: items.map((item) => ({
          item: item.item,
          code: item.code,
          product_code: item.product_code,
          name: item.name,
          quantity: item.quantity,
        })),
      },
    ],
    items,
    audit,
  })
}

export function cancelItem(
  token: string,
  companyId: string,
  table: FoodTable,
  item: TableItem,
  reason: string,
  requestedByClient: boolean,
  author: Author
) {
  const stillActive = activeItems(table).filter((other) => other.id !== item.id).length
  return syncTable(token, companyId, {
    ...basePayload(table, companyId),
    status: stillActive > 0 ? 'open_with_items' : 'open_empty',
    items: [
      {
        id: item.id,
        food_order_id: item.food_order_id,
        user_id: item.user_id,
        item: item.item,
        product_id: item.product_id,
        code: item.product_code,
        product_code: item.product_code,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        removed: true,
        pending_print: false,
        observation: item.observation || undefined,
        moment: item.moment,
      },
    ],
    audit: [auditEntry(author, `CANCELOU ${item.quantity} ${item.name}`, 'danger', reason, requestedByClient)],
  })
}

export function requestBill(token: string, companyId: string, table: FoodTable, author: Author) {
  return syncTable(token, companyId, {
    ...basePayload(table, companyId),
    status: table.status === 'open_empty' ? 'open_empty' : 'open_with_items',
    audit: [auditEntry(author, BILL_REQUESTED, 'warning', '', true)],
  })
}

export function cancelEmptyTable(token: string, companyId: string, table: FoodTable, reason: string, author: Author) {
  return syncTable(token, companyId, {
    ...basePayload(table, companyId),
    status: 'canceled',
    closed_at: nowIso(),
    audit: [auditEntry(author, 'CANCELOU A MESA', 'danger', reason, false)],
  })
}

// Recebimento: parcial (a mesa continua aberta) ou total (fecha a mesa e gera a
// venda no servidor, igual ao PDV).
export function receivePayment(
  token: string,
  companyId: string,
  table: FoodTable,
  payments: TablePayment[],
  closeTable: boolean,
  author: Author
) {
  const received = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100
  const subtotal = tableSubtotal(table)
  const partialBefore = tablePartialTotal(table)
  const moment = nowIso()
  const description = closeTable ? 'RECEBIMENTO TOTAL' : 'RECEBIMENTO PARCIAL'

  const partial = {
    id: newId(),
    user_id: author.id,
    moment,
    description,
    received,
    received_amount: received,
    author: author.id,
    author_name: author.name,
    item_ids: [],
    payments,
  }

  const payload: SyncPayload = {
    ...basePayload(table, companyId),
    status: closeTable ? 'closed' : 'open_with_items',
    closed_at: closeTable ? moment : null,
    partials: [partial],
    audit: [auditEntry(author, description, 'success')],
  }

  if (closeTable) {
    payload.sales = [
      {
        id: newId(),
        user_id: author.id,
        moment,
        table_number: table.number,
        subtotal,
        partial: partialBefore,
        total: received,
        author: author.id,
        author_name: author.name,
        payment_method: payments[payments.length - 1]?.form_payment ?? 9,
        payments,
      },
    ]
  }

  return syncTable(token, companyId, payload)
}

// ---------- Cardápio ----------

export interface MenuCategory {
  id: string
  name: string
}

export interface MenuProduct {
  id: string
  code: number | string
  internal_code?: number | null
  name: string
  description: string | null
  sale_value: number
  unit: string | null
  image_url: string | null
  category_ids: string[]
}

export interface Menu {
  categories: MenuCategory[]
  products: MenuProduct[]
}

export function fetchMenu(token: string, companyId: string) {
  return apiGet<Menu>('/food/menu', { companyId }, token)
}

export { connectSocket }
