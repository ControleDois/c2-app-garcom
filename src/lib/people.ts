import { apiGet } from './api'

export interface MyPerson {
  id: string
  name: string
}

// A pessoa (cadastro) do usuário logado nesta empresa: é quem assina os
// lançamentos e os recebimentos da mesa.
export function fetchMyPerson(token: string, companyId: string) {
  return apiGet<MyPerson>('/people/me', { companyId }, token)
}
