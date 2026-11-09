import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import { useCurrentUser } from './useAuth'
import { issuerBlock } from '@/utils/documents'

export function useIssuer() {
  const store = useDataStore()
  const { currentUser } = useCurrentUser()
  const company = computed(() => {
    const id = currentUser.value?.companyId ?? 'co-atlas'
    return store.db.companies.find((item) => item.id === id) ?? store.db.companies[0] ?? null
  })
  const issuer = computed(() => issuerBlock(company.value))
  return { company, issuer }
}
