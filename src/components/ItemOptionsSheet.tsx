import { useMemo, useState } from 'react'
import type { MenuComplementOption, MenuProduct } from '../lib/food'
import { formatCurrency } from '../lib/format'
import { CloseIcon, MinusIcon, PlusIcon } from './icons'

interface Chosen {
  groupId: string
  option: MenuComplementOption
  quantity: number
}

export interface ItemOptionsResult {
  quantity: number
  unitPrice: number
  options: string
  observation: string
}

interface Props {
  product: MenuProduct
  onClose: () => void
  onConfirm: (result: ItemOptionsResult) => void
}

// Monta o item com adicionais: escolhe as opções de cada grupo, a quantidade e a observação.
// O preço dos adicionais soma no item (igual ao cardápio online).
export function ItemOptionsSheet({ product, onClose, onConfirm }: Props) {
  const groups = product.complements ?? []
  const [chosen, setChosen] = useState<Chosen[]>([])
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const extras = useMemo(() => chosen.reduce((sum, item) => sum + item.option.sale_value * item.quantity, 0), [chosen])
  const unitPrice = product.sale_value + extras

  const countOf = (groupId: string, optionId: string) =>
    chosen.find((item) => item.groupId === groupId && item.option.id === optionId)?.quantity ?? 0

  function set(groupId: string, option: MenuComplementOption, value: number, single: boolean) {
    setError(null)
    const previous = countOf(groupId, option.id)
    let list = chosen.filter((item) => !(item.groupId === groupId && item.option.id === option.id))
    if (single) list = list.filter((item) => item.groupId !== groupId)
    if (value > 0) list.push({ groupId, option, quantity: value })
    setChosen(list)
    navigator.vibrate?.(8)
    // Chegou no limite do grupo: rola sozinho para o próximo (ou para a observação).
    const group = groups.find((item) => item.id === groupId)
    const total = list.filter((item) => item.groupId === groupId).reduce((sum, item) => sum + item.quantity, 0)
    if (group && value > previous && group.maximum > 0 && total >= group.maximum) {
      const next = groups[groups.findIndex((item) => item.id === groupId) + 1]
      const element = document.getElementById(next ? `grupo-${next.id}` : 'grupo-observacao')
      if (element) setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180)
    }
  }

  function confirm() {
    const parts: string[] = []
    for (const group of groups) {
      const picked = chosen.filter((item) => item.groupId === group.id)
      const total = picked.reduce((sum, item) => sum + item.quantity, 0)
      const free = picked.filter((item) => !item.option.sale_value).reduce((sum, item) => sum + item.quantity, 0)
      const minimum = group.required ? Math.max(group.minimum, 1) : group.minimum
      if (total < minimum) {
        setError(`Escolha ${minimum === 1 ? 'uma opção' : `ao menos ${minimum}`} em "${group.name}".`)
        document.getElementById(`grupo-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (group.maximum > 0 && free > group.maximum) {
        setError(`No máximo ${group.maximum} grátis em "${group.name}".`)
        return
      }
      if (picked.length > 0) {
        parts.push(
          `${group.name}: ${picked.map((item) => (item.quantity > 1 ? `${item.option.description} x${item.quantity}` : item.option.description)).join(', ')}`
        )
      }
    }
    onConfirm({ quantity, unitPrice, options: parts.join(' | '), observation: note.trim().slice(0, 120) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="sheet-up flex max-h-[94svh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--surface)] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {product.image_url ? (
          <div className="relative h-40 flex-none">
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mx-auto mt-2.5 h-1.5 w-10 flex-none rounded-full bg-[var(--border)]" />
        )}

        <div className="flex flex-none items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-[19px] leading-tight font-extrabold text-[var(--ink)]">{product.name}</h2>
            {product.description && <p className="mt-1 line-clamp-2 text-[13px] text-[var(--muted)]">{product.description}</p>}
            <p className="mt-1 text-[15px] font-extrabold text-[var(--green-600)]">{formatCurrency(product.sale_value)}</p>
          </div>
          {!product.image_url && (
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-[var(--muted)] active:bg-[var(--page)]">
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {groups.map((group) => {
            const single = group.maximum === 1
            const minimum = group.required ? Math.max(group.minimum, 1) : group.minimum
            const picked = chosen.filter((item) => item.groupId === group.id).reduce((sum, item) => sum + item.quantity, 0)
            const done = minimum > 0 && picked >= minimum
            return (
              <section key={group.id} id={`grupo-${group.id}`} className="mt-3 scroll-mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-extrabold text-[var(--ink)]">{group.name}</p>
                    <p className="text-[12px] text-[var(--muted)]">
                      {single ? 'Escolha 1' : group.maximum > 1 ? `Escolha até ${group.maximum}` : 'Escolha quantos quiser'}
                    </p>
                  </div>
                  {minimum > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        done ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--ink)] text-[var(--surface)]'
                      }`}
                    >
                      {done ? 'OK' : 'OBRIGATÓRIO'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {group.options.map((option) => {
                    const count = countOf(group.id, option.id)
                    const active = count > 0
                    const paidMulti = !single && option.sale_value > 0
                    return (
                      <div
                        key={option.id}
                        className={`flex min-h-[54px] items-center gap-3 rounded-2xl border-2 px-4 transition ${
                          active ? 'border-[var(--blue-500)] bg-[var(--blue-100)]' : 'border-[var(--border)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => set(group.id, option, active ? (single && minimum > 0 ? 1 : 0) : 1, single)}
                          className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                        >
                          <span
                            className={`flex h-6 w-6 flex-none items-center justify-center border-2 transition ${single ? 'rounded-full' : 'rounded-lg'} ${
                              active ? 'border-[var(--blue-500)] bg-[var(--blue-500)]' : 'border-[var(--border)]'
                            }`}
                          >
                            {active && <span className={`h-2.5 w-2.5 bg-white ${single ? 'rounded-full' : 'rounded-[3px]'}`} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14.5px] font-bold text-[var(--ink)]">{option.description}</span>
                            {option.sale_value > 0 && (
                              <span className="text-[12.5px] font-bold text-[var(--green-600)]">+ {formatCurrency(option.sale_value)}</span>
                            )}
                          </span>
                        </button>
                        {paidMulti && active && (
                          <div className="flex flex-none items-center gap-0.5 rounded-full bg-[var(--surface)] p-0.5">
                            <button
                              type="button"
                              onClick={() => set(group.id, option, count - 1, false)}
                              aria-label="Menos"
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--blue-500)]"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className="w-5 text-center text-[14px] font-extrabold">{count}</span>
                            <button
                              type="button"
                              onClick={() => set(group.id, option, count + 1, false)}
                              aria-label="Mais"
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--blue-500)]"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <p id="grupo-observacao" className="mt-5 mb-2 scroll-mt-3 text-[15px] font-extrabold text-[var(--ink)]">Alguma observação?</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {['Sem cebola', 'Sem gelo', 'Para viagem'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNote((current) => (current.toLowerCase().includes(chip.toLowerCase()) ? current : [current.trim(), chip.toLowerCase()].filter(Boolean).join(', ')))}
                className="rounded-full bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] active:bg-[var(--blue-100)]"
              >
                + {chip}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 120))}
            rows={2}
            placeholder="Ex.: molho à parte"
            className="w-full rounded-2xl bg-[var(--page)] px-4 py-3 text-[14px] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--blue-300)]"
          />
        </div>

        <div className="flex-none border-t border-[var(--border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-2.5 rounded-xl bg-[var(--red-100)] px-3.5 py-2 text-[13px] font-semibold text-[var(--red-500)]">{error}</p>}
          <div className="flex items-center gap-3">
            <div className="flex flex-none items-center gap-1 rounded-full bg-[var(--page)] p-1">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                aria-label="Diminuir"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--blue-500)] active:bg-[var(--surface)]"
              >
                <MinusIcon className="h-5 w-5" />
              </button>
              <span className="w-7 text-center text-[17px] font-extrabold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
                aria-label="Aumentar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--blue-500)] active:bg-[var(--surface)]"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={confirm}
              className="flex h-[52px] flex-1 items-center justify-between rounded-full bg-[var(--blue-500)] px-5 text-white active:bg-[var(--blue-700)]"
            >
              <span className="text-[15px] font-extrabold">Adicionar</span>
              <span className="text-[15px] font-extrabold">{formatCurrency(unitPrice * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
