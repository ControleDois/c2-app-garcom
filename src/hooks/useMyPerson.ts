import { useEffect, useState } from 'react'
import { fetchMyPerson, type MyPerson } from '../lib/people'
import type { AuthCompany, AuthSession } from '../lib/auth'

export function useMyPerson(session: AuthSession, company: AuthCompany) {
  const [person, setPerson] = useState<MyPerson | null>(null)

  useEffect(() => {
    let cancelled = false
    setPerson(null)
    fetchMyPerson(session.token.token, company.id)
      .then((result) => {
        if (!cancelled) setPerson({ id: result.id, name: result.name })
      })
      .catch(() => {
        if (!cancelled) setPerson(null)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

  return person
}
