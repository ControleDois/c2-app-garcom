import { useState } from 'react'
import type { DeliveryInfo } from '../lib/food'
import { CloseIcon } from './icons'

interface Props {
  title: string
  confirmLabel: string
  initial?: Partial<DeliveryInfo>
  busy?: boolean
  error?: string | null
  onClose: () => void
  onConfirm: (info: DeliveryInfo) => void
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
}

const parseMoney = (value: string) => {
  const number = Number(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0
}

// Dados do cliente e da entrega para o delivery lançado pelo garçom.
export function DeliveryInfoSheet({ title, confirmLabel, initial, busy, error, onClose, onConfirm }: Props) {
  const [name, setName] = useState(initial?.customerName ?? '')
  const [phone, setPhone] = useState(formatPhone(initial?.customerPhone ?? ''))
  const [address, setAddress] = useState(initial?.deliveryAddress ?? '')
  const [fee, setFee] = useState(initial?.deliveryFee ? initial.deliveryFee.toFixed(2).replace('.', ',') : '')
  const [problem, setProblem] = useState<string | null>(null)

  const field =
    'w-full rounded-xl bg-[var(--page)] px-4 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--blue-300)]'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        className="sheet-up w-full max-w-[480px] rounded-t-[28px] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return setProblem('Informe o nome do cliente.')
          if (!address.trim()) return setProblem('Informe o endereço de entrega.')
          setProblem(null)
          onConfirm({
            customerName: name.trim(),
            customerPhone: phone.replace(/\D/g, ''),
            deliveryAddress: address.trim(),
            deliveryFee: parseMoney(fee),
          })
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-[var(--ink)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-[var(--muted)] active:bg-[var(--page)]">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--ink-soft)]">Nome do cliente</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value.slice(0, 120))} placeholder="Ex.: Maria" className={`${field} h-12`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--ink-soft)]">Telefone</span>
            <input
              value={phone}
              inputMode="tel"
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              placeholder="(65) 99999-9999"
              className={`${field} h-12`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--ink-soft)]">Endereço de entrega</span>
            <textarea
              value={address}
              rows={2}
              onChange={(event) => setAddress(event.target.value.slice(0, 500))}
              placeholder="Rua, número, bairro, referência"
              className={`${field} resize-none py-3`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-[var(--ink-soft)]">Taxa de entrega</span>
            <input
              value={fee}
              inputMode="decimal"
              onChange={(event) => setFee(event.target.value.replace(/[^\d,]/g, ''))}
              placeholder="0,00"
              className={`${field} h-12 w-40`}
            />
          </label>
        </div>
        {(problem || error) && (
          <p className="mt-3 rounded-xl bg-[var(--red-100)] px-3.5 py-2 text-[13px] font-semibold text-[var(--red-500)]">{problem || error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 h-[52px] w-full rounded-full bg-violet-600 text-[15px] font-extrabold text-white active:bg-violet-700 disabled:opacity-50"
        >
          {busy ? 'Salvando…' : confirmLabel}
        </button>
      </form>
    </div>
  )
}
