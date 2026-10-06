import { useState } from 'react'
import { ScreenHeader } from '../components/ScreenHeader'
import { MoneyInput } from '../components/form/MoneyInput'
import {
  PAYMENT_METHODS,
  paymentLabel,
  receivePayment,
  tablePartialTotal,
  tableRemaining,
  tableSubtotal,
  type FoodTable,
  type TablePayment,
} from '../lib/food'
import { parseMoney } from '../lib/money'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { TrashIcon } from '../components/icons'
import type { MyPerson } from '../lib/people'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface CheckoutPageProps {
  session: AuthSession
  company: AuthCompany
  person: MyPerson | null
  table: FoodTable | undefined
  onRefresh: () => Promise<void>
  navigate: (path: string, options?: { replace?: boolean }) => void
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function CheckoutPage({ session, company, person, table, onRefresh, navigate }: CheckoutPageProps) {
  const [payments, setPayments] = useState<TablePayment[]>([])
  const [method, setMethod] = useState(9)
  const [amount, setAmount] = useState('')
  const [people, setPeople] = useState('')
  const [cashGiven, setCashGiven] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!table) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="Fechar conta" onBack={() => navigate('/mesas', { replace: true })} />
        <p className="px-6 py-16 text-center text-[14px] text-[var(--ink-soft)]">Esta mesa não está mais aberta.</p>
      </div>
    )
  }

  const current = table
  const subtotal = tableSubtotal(current)
  const partial = tablePartialTotal(current)
  const total = tableRemaining(current)
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const remaining = round2(Math.max(0, total - paid))
  const typedAmount = parseMoney(amount) ?? 0
  const peopleCount = Math.max(1, Number(people) || 1)
  const splitValue = round2(total / peopleCount)
  const cash = parseMoney(cashGiven) ?? 0
  const change = method === 9 && cash > typedAmount ? round2(cash - typedAmount) : 0

  function addPayment() {
    const value = typedAmount > 0 ? typedAmount : remaining
    if (value <= 0 || value > remaining + 0.009) {
      setError(`O valor precisa estar entre R$ 0,01 e ${formatCurrency(remaining)}.`)
      return
    }
    setError(null)
    setPayments([...payments, { form_payment: method, amount: round2(value) }])
    setAmount('')
    setCashGiven('')
  }

  async function submit(closeTable: boolean) {
    if (!person || payments.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await receivePayment(session.token.token, company.id, current, payments, closeTable, {
        id: person.id,
        name: person.name,
      })
      await onRefresh()
      navigate('/mesas', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar o recebimento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title={`Fechar mesa ${current.number}`} onBack={() => navigate(`/mesas/${current.id}`)} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--ink-soft)]">Consumo</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {partial > 0 && (
            <div className="mt-1 flex justify-between text-[14px]">
              <span className="text-[var(--ink-soft)]">Já recebido</span>
              <span className="font-semibold text-[var(--green-600)]">- {formatCurrency(partial)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-[18px] font-extrabold">
            <span>Total a receber</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
          <p className="text-[13px] font-bold text-[var(--ink)]">Dividir a conta</p>
          <div className="mt-2 flex items-center gap-3">
            <input
              value={people}
              onChange={(event) => setPeople(event.target.value.replace(/\D/g, '').slice(0, 2))}
              inputMode="numeric"
              placeholder="Nº de pessoas"
              className="h-11 w-32 rounded-xl bg-[var(--page)] px-3.5 text-center text-[14px] outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
            />
            {peopleCount > 1 && (
              <button
                type="button"
                onClick={() => setAmount(splitValue.toFixed(2))}
                className="rounded-xl bg-[var(--blue-100)] px-3.5 py-2.5 text-[13px] font-bold text-[var(--blue-700)]"
              >
                {formatCurrency(splitValue)} por pessoa — usar
              </button>
            )}
          </div>
        </div>

        {remaining > 0 && (
          <div className="mt-3 rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
            <p className="text-[13px] font-bold text-[var(--ink)]">Forma de pagamento</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={`h-12 rounded-xl text-[14px] font-bold ${
                    method === option.value
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'bg-[var(--page)] text-[var(--ink-soft)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Valor desta forma (vazio = tudo que falta)
              </span>
              <MoneyInput
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={remaining.toFixed(2).replace('.', ',')}
                className="mt-1 h-12 w-full rounded-xl bg-[var(--page)] px-4 text-[18px] font-extrabold outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
              />
            </label>
            {method === 9 && (
              <label className="mt-3 block">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                  Valor entregue pelo cliente (para o troco)
                </span>
                <MoneyInput
                  value={cashGiven}
                  onChange={(event) => setCashGiven(event.target.value)}
                  className="mt-1 h-12 w-full rounded-xl bg-[var(--page)] px-4 text-[16px] font-bold outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                />
                {change > 0 && (
                  <p className="mt-1.5 text-[14px] font-extrabold text-[var(--green-600)]">
                    Troco: {formatCurrency(change)}
                  </p>
                )}
              </label>
            )}
            <button
              type="button"
              onClick={addPayment}
              className="mt-3 h-12 w-full rounded-xl border-2 border-[var(--blue-500)] text-[14px] font-bold text-[var(--blue-700)]"
            >
              Lançar {paymentLabel(method)} · {formatCurrency(typedAmount > 0 ? typedAmount : remaining)}
            </button>
          </div>
        )}

        {payments.length > 0 && (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]">
            {payments.map((payment, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--ink)]">
                  {paymentLabel(payment.form_payment)}
                </span>
                <span className="text-[14.5px] font-extrabold">{formatCurrency(payment.amount)}</span>
                <button
                  type="button"
                  onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                  aria-label="Remover pagamento"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] active:bg-[var(--red-100)] active:text-[var(--red-500)]"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="px-1 pt-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}
        {!person && (
          <p className="px-1 pt-3 text-[12.5px] text-[var(--amber-500)]">
            Seu usuário não tem cadastro de pessoa nesta empresa — peça ao administrador para vincular.
          </p>
        )}
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-1 text-[14px]">
          <span className="text-[var(--ink-soft)]">{remaining > 0 ? 'Falta lançar' : 'Pagamentos completos'}</span>
          <span
            className={`text-[16px] font-extrabold ${
              remaining > 0 ? 'text-[var(--amber-500)]' : 'text-[var(--green-600)]'
            }`}
          >
            {formatCurrency(remaining)}
          </span>
        </div>
        <button
          type="button"
          disabled={busy || !person || payments.length === 0 || remaining > 0.009}
          onClick={() => submit(true)}
          className="h-13 rounded-xl bg-[var(--green-600)] text-[15px] font-extrabold text-white disabled:opacity-50"
        >
          {busy ? 'Registrando…' : 'Receber e fechar a mesa'}
        </button>
        {remaining > 0.009 && payments.length > 0 && (
          <button
            type="button"
            disabled={busy || !person}
            onClick={() => submit(false)}
            className="h-12 rounded-xl border border-[var(--border)] text-[13.5px] font-bold text-[var(--ink-soft)] disabled:opacity-50"
          >
            Receber parcial (a mesa continua aberta)
          </button>
        )}
      </div>
    </div>
  )
}
