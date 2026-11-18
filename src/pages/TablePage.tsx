import { useEffect, useState } from 'react'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  activeItems,
  billRequested,
  cancelEmptyTable,
  cancelItem,
  formatMinutes,
  idleAlert,
  lastOrderAt,
  minutesSince,
  requestBill,
  tablePartialTotal,
  tableRemaining,
  tableSubtotal,
  type FoodTable,
  type TableItem,
} from '../lib/food'
import { ApiError } from '../lib/api'
import { formatCurrency, formatTime } from '../lib/format'
import { ChevronDownIcon, ClockIcon, TrashIcon } from '../components/icons'
import type { MyPerson } from '../lib/people'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface TablePageProps {
  session: AuthSession
  company: AuthCompany
  person: MyPerson | null
  table: FoodTable | undefined
  loading: boolean
  onRefresh: () => Promise<void>
  navigate: (path: string, options?: { replace?: boolean }) => void
}

type Dialog = { kind: 'cancel-item'; item: TableItem } | { kind: 'cancel-table' } | null

const SORT_KEY = 'garcom/mesa/ordem'

const AUDIT_TONE: Record<string, string> = {
  success: 'bg-[var(--green-600)]',
  danger: 'bg-[var(--red-500)]',
  warning: 'bg-[var(--amber-500)]',
  default: 'bg-[var(--blue-500)]',
}

const firstName = (name: string | null) => (name ? name.trim().split(' ')[0] : '')

export function TablePage({ session, company, person, table, loading, onRefresh, navigate }: TablePageProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [reason, setReason] = useState('')
  const [byClient, setByClient] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newestFirst, setNewestFirst] = useState(() => {
    try {
      return localStorage.getItem(SORT_KEY) === 'recentes'
    } catch {
      return false
    }
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  function toggleSort() {
    const next = !newestFirst
    setNewestFirst(next)
    try {
      localStorage.setItem(SORT_KEY, next ? 'recentes' : 'antigos')
    } catch {
      // sem armazenamento: vale só agora
    }
  }

  if (!table) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="Mesa" onBack={() => navigate('/mesas', { replace: true })} />
        <p className="px-6 py-16 text-center text-[14px] text-[var(--ink-soft)]">
          {loading ? 'Carregando…' : 'Esta mesa não está mais aberta (pode ter sido fechada no caixa).'}
        </p>
      </div>
    )
  }

  const current = table
  const items = [...activeItems(current)].sort((a, b) =>
    newestFirst ? (b.moment ?? '').localeCompare(a.moment ?? '') || b.item - a.item : (a.moment ?? '').localeCompare(b.moment ?? '') || a.item - b.item
  )
  const limit = Number(company.config?.food_table_idle_alert_minutes ?? 30)
  const idle = idleAlert(current, limit, now)
  const sinceOrder = minutesSince(lastOrderAt(current), now)
  const history = [...current.audit].sort((a, b) => (b.moment ?? '').localeCompare(a.moment ?? ''))
  const subtotal = tableSubtotal(current)
  const partial = tablePartialTotal(current)
  const remaining = tableRemaining(current)
  const bill = billRequested(current)
  const author = person ? { id: person.id, name: person.name } : null

  async function run(action: () => Promise<unknown>, successMessage?: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onRefresh()
      if (successMessage) setNotice(successMessage)
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function closeDialog() {
    setDialog(null)
    setReason('')
    setByClient(false)
  }

  async function confirmDialog() {
    if (!author || !dialog || !reason.trim()) return
    if (dialog.kind === 'cancel-item') {
      const ok = await run(
        () => cancelItem(session.token.token, company.id, current, dialog.item, reason.trim(), byClient, author),
        'Item cancelado.'
      )
      if (ok) closeDialog()
    } else {
      const ok = await run(() => cancelEmptyTable(session.token.token, company.id, current, reason.trim(), author))
      if (ok) {
        closeDialog()
        navigate('/mesas', { replace: true })
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title={`Mesa ${current.number}`}
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : 'Sem itens'}
        onBack={() => navigate('/mesas', { replace: true })}
        right={
          bill ? (
            <span className="rounded-full bg-[var(--red-100)] px-3 py-1 text-[11px] font-extrabold text-[var(--red-500)]">
              CONTA PEDIDA
            </span>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2 p-3 pb-0">
          <div className="rounded-2xl bg-[var(--surface)] px-3 py-2.5 shadow-[var(--card-shadow)]">
            <p className="text-[11px] font-semibold text-[var(--muted)]">Chegou</p>
            <p className="text-[15px] font-extrabold text-[var(--ink)]">{formatTime(current.opened_at)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface)] px-3 py-2.5 shadow-[var(--card-shadow)]">
            <p className="text-[11px] font-semibold text-[var(--muted)]">De casa</p>
            <p className="text-[15px] font-extrabold text-[var(--ink)]">{formatMinutes(minutesSince(current.opened_at, now))}</p>
          </div>
          <div
            className={`rounded-2xl px-3 py-2.5 shadow-[var(--card-shadow)] ${
              idle ? 'bg-[var(--red-500)] text-white' : 'bg-[var(--surface)]'
            }`}
          >
            <p className={`text-[11px] font-semibold ${idle ? 'text-white/85' : 'text-[var(--muted)]'}`}>
              {items.length ? 'Sem pedir' : 'Aberta há'}
            </p>
            <p className={`text-[15px] font-extrabold ${idle ? '' : 'text-[var(--ink)]'}`}>
              {idle ? '⚠ ' : ''}
              {formatMinutes(sinceOrder)}
            </p>
          </div>
        </div>
        {idle && (
          <p className="mx-3 mt-2 rounded-xl bg-[var(--red-100)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--red-500)]">
            Mesa há {formatMinutes(idle)} sem pedir nada — passe para oferecer algo.
          </p>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <p className="text-[12px] font-extrabold tracking-wide text-[var(--muted)] uppercase">Itens da mesa</p>
            <button
              type="button"
              onClick={toggleSort}
              className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--blue-700)] shadow-[var(--card-shadow)]"
            >
              {newestFirst ? 'Últimos primeiro' : 'Primeiros primeiro'}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition ${newestFirst ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-[15px] font-bold text-[var(--ink)]">Mesa aberta, sem pedidos ainda</p>
            <button
              type="button"
              onClick={() => navigate(`/mesas/${current.id}/cardapio`)}
              className="h-12 rounded-full bg-[var(--blue-500)] px-8 text-[14.5px] font-bold text-white"
            >
              Fazer o primeiro pedido
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)] bg-[var(--surface)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span className="flex h-8 min-w-8 flex-none items-center justify-center rounded-lg bg-[var(--blue-100)] px-1.5 text-[13px] font-extrabold text-[var(--blue-700)]">
                  {item.quantity}x
                </span>
                <div className={`min-w-0 flex-1 ${item.received ? 'opacity-60' : ''}`}>
                  <p className="text-[14.5px] leading-snug font-bold text-[var(--ink)]">{item.name}</p>
                  {item.observation && <p className="text-[12.5px] text-[var(--ink-soft)]">{item.observation}</p>}
                  <p className="flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
                    <ClockIcon className="h-3 w-3" />
                    {formatTime(item.moment)}
                    {item.author_name ? ` · ${firstName(item.author_name)}` : ''}
                    {item.received && (
                      <span className="ml-1 rounded-full bg-[var(--green-100)] px-1.5 text-[10.5px] font-extrabold text-[var(--green-600)]">PAGO</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[14px] font-extrabold text-[var(--ink)]">{formatCurrency(item.total)}</span>
                  {!item.received && <button
                    type="button"
                    onClick={() => setDialog({ kind: 'cancel-item', item })}
                    aria-label={`Cancelar ${item.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] active:bg-[var(--red-100)] active:text-[var(--red-500)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="m-3 flex flex-col gap-1.5 rounded-2xl bg-[var(--surface)] p-4 text-[14px] shadow-[var(--card-shadow)]">
            <div className="flex justify-between">
              <span className="text-[var(--ink-soft)]">Consumo</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {partial > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Já recebido</span>
                <span className="font-semibold text-[var(--green-600)]">- {formatCurrency(partial)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-[17px] font-extrabold">
              <span>A receber</span>
              <span>{formatCurrency(remaining)}</span>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="m-3 rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[14px] font-extrabold text-[var(--ink)]">Histórico da mesa</span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--muted)]">
                {history.length}
                <ChevronDownIcon className={`h-4 w-4 transition ${historyOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {historyOpen && (
              <ol className="border-t border-[var(--border)] px-4 py-3">
                {history.map((entry) => (
                  <li key={entry.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${AUDIT_TONE[entry.type] ?? AUDIT_TONE.default}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug font-bold text-[var(--ink)]">{entry.description}</p>
                      {entry.reason && <p className="text-[12px] text-[var(--ink-soft)]">Motivo: {entry.reason}</p>}
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {formatTime(entry.moment)}
                        {entry.author_name ? ` · ${entry.author_name}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {notice && <p className="px-4 text-center text-[13px] font-semibold text-[var(--green-600)]">{notice}</p>}
        {error && <p className="px-4 py-2 text-center text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        {!author && (
          <p className="px-4 py-2 text-center text-[12.5px] text-[var(--amber-500)]">
            Seu usuário não tem cadastro de pessoa nesta empresa — peça ao administrador para vincular, senão não dá
            para lançar.
          </p>
        )}

        {items.length === 0 && (
          <div className="px-4 pb-6 text-center">
            <button
              type="button"
              onClick={() => setDialog({ kind: 'cancel-table' })}
              className="text-[12.5px] font-semibold text-[var(--red-500)]"
            >
              Cancelar esta mesa
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-none flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !author || bill}
              onClick={() =>
                author &&
                run(
                  () => requestBill(session.token.token, company.id, current, author),
                  'Conta pedida — o caixa foi avisado.'
                )
              }
              className="h-12 flex-1 rounded-xl border border-[var(--border)] text-[13.5px] font-bold text-[var(--ink-soft)] disabled:opacity-50"
            >
              {bill ? 'Conta já pedida' : 'Pedir conta'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/mesas/${current.id}/fechar`)}
              className="h-12 flex-1 rounded-xl bg-[var(--green-600)] text-[13.5px] font-bold text-white"
            >
              Fechar conta
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/mesas/${current.id}/cardapio`)}
            className="h-12 rounded-xl bg-[var(--blue-500)] text-[14.5px] font-bold text-white"
          >
            + Adicionar itens
          </button>
        </div>
      )}

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-[460px] rounded-t-3xl bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[16px] font-extrabold text-[var(--ink)]">
              {dialog.kind === 'cancel-item'
                ? `Cancelar ${dialog.item.quantity}x ${dialog.item.name}?`
                : `Cancelar a mesa ${current.number}?`}
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Informe o motivo — fica registrado no histórico da mesa.
            </p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              autoFocus
              placeholder="Motivo do cancelamento"
              className="mt-3 w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
            />
            {dialog.kind === 'cancel-item' && (
              <label className="mt-3 flex items-center gap-2.5 text-[13.5px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={byClient}
                  onChange={(event) => setByClient(event.target.checked)}
                  className="h-5 w-5 accent-[var(--blue-500)]"
                />
                Foi pedido pelo cliente
              </label>
            )}
            {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-12 flex-1 rounded-xl border border-[var(--border)] text-[14px] font-bold text-[var(--ink-soft)]"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={confirmDialog}
                className="h-12 flex-1 rounded-xl bg-[var(--red-500)] text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
