import { useEffect, useMemo, useState } from 'react'
import { ScreenHeader } from '../components/ScreenHeader'
import { cartCount, cartTotal, loadCart, saveCart } from '../lib/cart'
import { fetchMenu, sendOrder, type CartLine, type FoodTable, type Menu, type MenuProduct } from '../lib/food'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { MinusIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import type { MyPerson } from '../lib/people'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface MenuPageProps {
  session: AuthSession
  company: AuthCompany
  person: MyPerson | null
  table: FoodTable | undefined
  onRefresh: () => Promise<void>
  navigate: (path: string, options?: { replace?: boolean }) => void
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

let menuCache: { companyId: string; menu: Menu } | null = null

export function MenuPage({ session, company, person, table, onRefresh, navigate }: MenuPageProps) {
  const tableId = table?.id ?? ''
  const [menu, setMenu] = useState<Menu | null>(menuCache?.companyId === company.id ? menuCache.menu : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [cart, setCart] = useState<CartLine[]>(() => (tableId ? loadCart(tableId) : []))
  const [reviewOpen, setReviewOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (menu) return
    let cancelled = false
    fetchMenu(session.token.token, company.id)
      .then((result) => {
        if (cancelled) return
        menuCache = { companyId: company.id, menu: result }
        setMenu(result)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o cardápio.')
      })
    return () => {
      cancelled = true
    }
  }, [menu, session.token.token, company.id])

  // Sempre a partir do valor mais recente (vários toques seguidos não se perdem).
  function mutateCart(change: (previous: CartLine[]) => CartLine[]) {
    setCart((previous) => {
      const next = change(previous)
      if (tableId) saveCart(tableId, next)
      return next
    })
  }

  function updateCart(next: CartLine[]) {
    mutateCart(() => next)
  }

  const categories = useMemo(() => {
    if (!menu) return []
    const used = new Set(menu.products.flatMap((product) => product.category_ids))
    return menu.categories.filter((category) => used.has(category.id))
  }, [menu])

  const filtered = useMemo(() => {
    if (!menu) return []
    const term = normalize(query.trim())
    return menu.products.filter((product) => {
      if (categoryId !== 'all' && !product.category_ids.includes(categoryId)) return false
      if (!term) return true
      return (
        normalize(product.name).includes(term) ||
        String(product.internal_code ?? '').includes(term) ||
        String(product.code).includes(term)
      )
    })
  }, [menu, query, categoryId])

  const quantityOf = (productId: string) =>
    cart
      .filter((line) => line.product_id === productId && !line.observation)
      .reduce((sum, line) => sum + line.quantity, 0)

  function changeQuantity(product: MenuProduct, delta: number) {
    mutateCart((previous) => {
      const index = previous.findIndex((line) => line.product_id === product.id && !line.observation)
      if (index === -1) {
        if (delta <= 0) return previous
        return [
          ...previous,
          {
            product_id: product.id,
            code: String(product.code ?? ''),
            name: product.name,
            unit_price: product.sale_value,
            quantity: 1,
            observation: '',
          },
        ]
      }
      const quantity = previous[index].quantity + delta
      return quantity <= 0
        ? previous.filter((_, i) => i !== index)
        : previous.map((line, i) => (i === index ? { ...line, quantity } : line))
    })
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    mutateCart((previous) => previous.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function handleSend() {
    if (!table || !person || cart.length === 0) return
    setSending(true)
    setSendError(null)
    try {
      await sendOrder(session.token.token, company.id, table, cart, { id: person.id, name: person.name })
      updateCart([])
      await onRefresh()
      navigate(`/mesas/${table.id}`, { replace: true })
    } catch (err) {
      setSendError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível enviar o pedido. O pedido continua aqui — tente de novo.'
      )
    } finally {
      setSending(false)
    }
  }

  if (!table) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="Cardápio" onBack={() => navigate('/mesas', { replace: true })} />
        <p className="px-6 py-16 text-center text-[14px] text-[var(--ink-soft)]">Esta mesa não está mais aberta.</p>
      </div>
    )
  }

  const count = cartCount(cart)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={`Mesa ${table.number}`}
        subtitle="Escolha os itens do pedido"
        onBack={() => navigate(`/mesas/${table.id}`)}
      />

      <div className="flex-none border-b border-[var(--border)] bg-[var(--surface)] px-3 pt-3">
        <label className="flex items-center gap-2.5 rounded-full bg-[var(--page)] px-4 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar produto ou código"
            className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <div className="no-scrollbar -mx-3 mt-2.5 flex gap-2 overflow-x-auto px-3 pb-2.5">
          {[{ id: 'all', name: 'Todos' }, ...categories].map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`flex-none rounded-full px-4 py-2 text-[13px] font-bold whitespace-nowrap ${
                categoryId === category.id
                  ? 'bg-[var(--blue-500)] text-white'
                  : 'bg-[var(--page)] text-[var(--ink-soft)]'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        {loadError ? (
          <p className="px-6 py-16 text-center text-[14px] font-medium text-[var(--red-500)]">{loadError}</p>
        ) : !menu ? (
          <p className="py-16 text-center text-[14px] text-[var(--muted)]">Carregando cardápio…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-16 text-center text-[14px] text-[var(--ink-soft)]">Nenhum produto encontrado.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {filtered.map((product) => {
              const quantity = quantityOf(product.id)
              return (
                <li key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 flex-none rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] leading-snug font-bold text-[var(--ink)]">{product.name}</p>
                    <p className="text-[13px] font-extrabold text-[var(--green-600)]">
                      {formatCurrency(product.sale_value)}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    {quantity > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => changeQuantity(product, -1)}
                          aria-label="Diminuir"
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--page)] text-[var(--blue-500)] active:bg-[var(--blue-100)]"
                        >
                          <MinusIcon className="h-5 w-5" />
                        </button>
                        <span className="w-6 text-center text-[16px] font-extrabold">{quantity}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => changeQuantity(product, 1)}
                      aria-label={`Adicionar ${product.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--blue-500)] text-white active:bg-[var(--blue-700)]"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="pointer-events-auto mx-auto flex h-14 w-full max-w-[560px] items-center justify-between rounded-full bg-[var(--blue-500)] px-6 text-white shadow-xl"
          >
            <span className="text-[14.5px] font-bold">
              Revisar pedido · {count} {count === 1 ? 'item' : 'itens'}
            </span>
            <span className="text-[15px] font-extrabold">{formatCurrency(cartTotal(cart))}</span>
          </button>
        </div>
      )}

      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => !sending && setReviewOpen(false)}
        >
          <div
            className="flex max-h-[92svh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-[var(--surface)] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex-none border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-[16px] font-extrabold text-[var(--ink)]">Pedido da mesa {table.number}</h2>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto px-5">
              {cart.map((line, index) => (
                <li key={`${line.product_id}-${index}`} className="py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] leading-snug font-bold text-[var(--ink)]">{line.name}</p>
                      <p className="text-[12.5px] text-[var(--muted)]">{formatCurrency(line.unit_price)} cada</p>
                    </div>
                    <div className="flex flex-none items-center gap-1 rounded-full bg-[var(--page)] p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          line.quantity <= 1
                            ? mutateCart((previous) => previous.filter((_, i) => i !== index))
                            : updateLine(index, { quantity: line.quantity - 1 })
                        }
                        aria-label="Diminuir"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--blue-500)]"
                      >
                        {line.quantity <= 1 ? <TrashIcon className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" />}
                      </button>
                      <span className="w-6 text-center text-[15px] font-extrabold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateLine(index, { quantity: line.quantity + 1 })}
                        aria-label="Aumentar"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--blue-500)]"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    value={line.observation}
                    onChange={(event) => updateLine(index, { observation: event.target.value.slice(0, 120) })}
                    placeholder="Observação (ex.: sem gelo, ao ponto…)"
                    className="mt-2 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--blue-300)]"
                  />
                </li>
              ))}
            </ul>
            <div className="flex-none border-t border-[var(--border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {sendError && <p className="mb-2 text-[13px] font-medium text-[var(--red-500)]">{sendError}</p>}
              {!person && (
                <p className="mb-2 text-[12.5px] text-[var(--amber-500)]">
                  Seu usuário não tem cadastro de pessoa nesta empresa — peça ao administrador para vincular.
                </p>
              )}
              <div className="mb-3 flex items-center justify-between text-[15px]">
                <span className="text-[var(--ink-soft)]">Total do pedido</span>
                <span className="text-[17px] font-extrabold">{formatCurrency(cartTotal(cart))}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setReviewOpen(false)}
                  className="h-13 flex-1 rounded-xl border border-[var(--border)] text-[14px] font-bold text-[var(--ink-soft)]"
                >
                  Continuar escolhendo
                </button>
                <button
                  type="button"
                  disabled={sending || !person || cart.length === 0}
                  onClick={handleSend}
                  className="h-13 flex-1 rounded-xl bg-[var(--green-600)] text-[14.5px] font-extrabold text-white disabled:opacity-50"
                >
                  {sending ? 'Enviando…' : 'Enviar pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
