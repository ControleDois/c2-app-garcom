import { useMemo, useState } from 'react'
import {
  activeItems,
  billRequested,
  lastActivity,
  openTable,
  tableRemaining,
  tableSubtotal,
  type FoodTable,
} from '../lib/food'
import { ApiError } from '../lib/api'
import { formatCurrency, timeAgo } from '../lib/format'
import { RefreshIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface TablesPageProps {
  session: AuthSession
  company: AuthCompany
  personId: string | null
  tables: FoodTable[]
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  navigate: (path: string) => void
}

export function TablesPage({
  session,
  company,
  personId,
  tables,
  loading,
  error,
  onRefresh,
  navigate,
}: TablesPageProps) {
  const [number, setNumber] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const visible = useMemo(
    () =>
      onlyMine && personId ? tables.filter((table) => table.items.some((item) => item.user_id === personId)) : tables,
    [tables, onlyMine, personId]
  )

  async function handleOpen() {
    const target = Number(number)
    if (!target) return
    setOpenError(null)
    const existing = tables.find((table) => table.number === target)
    if (existing) {
      setNumber('')
      navigate(`/mesas/${existing.id}`)
      return
    }
    setOpening(true)
    try {
      const created = await openTable(session.token.token, company.id, target)
      await onRefresh()
      setNumber('')
      navigate(`/mesas/${created.id}`)
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : 'Não foi possível abrir a mesa.')
    } finally {
      setOpening(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none border-b border-[var(--border)] bg-[var(--surface)] p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleOpen()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            inputMode="numeric"
            value={number}
            onChange={(event) => setNumber(event.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Nº da mesa"
            className="h-12 min-w-0 flex-1 rounded-xl bg-[var(--page)] px-4 text-center text-[20px] font-extrabold text-[var(--ink)] outline-none placeholder:text-[14px] placeholder:font-normal placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--blue-300)]"
          />
          <button
            type="submit"
            disabled={!number || opening}
            className="h-12 flex-none rounded-xl bg-[var(--blue-500)] px-5 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {opening ? 'Abrindo…' : 'Abrir mesa'}
          </button>
        </form>
        {openError && <p className="mt-2 text-[12.5px] font-medium text-[var(--red-500)]">{openError}</p>}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5 rounded-full bg-[var(--page)] p-1">
            {[
              { label: 'Todas', value: false },
              { label: 'Minhas', value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setOnlyMine(option.value)}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${
                  onlyMine === option.value
                    ? 'bg-[var(--surface)] text-[var(--blue-700)] shadow-sm'
                    : 'text-[var(--ink-soft)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Atualizar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] active:bg-[var(--page)]"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="flex-none bg-[var(--red-100)] px-4 py-2 text-center text-[12.5px] font-medium text-[var(--red-500)]">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="py-16 text-center text-[14px] text-[var(--muted)]">Carregando mesas…</p>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[var(--ink-soft)]">
            {onlyMine
              ? 'Você ainda não lançou nada em nenhuma mesa.'
              : 'Nenhuma mesa aberta. Digite o número para abrir uma.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((table) => {
              const count = activeItems(table).length
              const bill = billRequested(table)
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => navigate(`/mesas/${table.id}`)}
                  className={`flex flex-col items-start rounded-2xl bg-[var(--surface)] p-3.5 text-left shadow-[var(--card-shadow)] ring-2 transition active:scale-[0.98] ${
                    bill ? 'ring-[var(--red-500)]' : count > 0 ? 'ring-[var(--green-600)]' : 'ring-[var(--amber-500)]'
                  }`}
                >
                  <div className="flex w-full items-start justify-between">
                    <span className="text-[26px] leading-none font-extrabold text-[var(--ink)]">{table.number}</span>
                    {bill && (
                      <span className="rounded-full bg-[var(--red-100)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--red-500)]">
                        CONTA
                      </span>
                    )}
                  </div>
                  <span className="mt-2 text-[15px] font-bold text-[var(--ink)]">
                    {count > 0 ? formatCurrency(tableRemaining(table) || tableSubtotal(table)) : 'Sem itens'}
                  </span>
                  <span className="text-[11.5px] text-[var(--muted)]">
                    {count > 0 ? `${count} ${count === 1 ? 'item' : 'itens'} · ` : ''}
                    {timeAgo(lastActivity(table))}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
