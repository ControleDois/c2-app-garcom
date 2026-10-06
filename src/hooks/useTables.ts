import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSocket, fetchTables, type FoodTable } from '../lib/food'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'

const POLL_MS = 20000

// Mesas abertas da empresa. Atualiza na hora quando outro aparelho (PDV ou
// outro garçom) mexe numa mesa (evento do servidor), e de tempos em tempos
// por garantia.
export function useTables(session: AuthSession, company: AuthCompany) {
  const [tables, setTables] = useState<FoodTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const refreshTimer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await fetchTables(session.token.token, company.id)
      setTables(list)
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as mesas.')
    } finally {
      setLoading(false)
    }
  }, [session.token.token, company.id])

  useEffect(() => {
    setLoading(true)
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    const socket = connectSocket(company.id)
    const onUpdated = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(refresh, 400)
    }
    socket.on('food:table:updated', onUpdated)
    return () => {
      socket.off('food:table:updated', onUpdated)
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    }
  }, [company.id, refresh])

  return { tables, loading, error, updatedAt, refresh }
}
