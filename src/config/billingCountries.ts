/**
 * Pays facturables et devise d'abonnement.
 * Doit rester aligné avec bravo-api/app/Support/BillingCountries.php.
 */
export type BillingCountry = 'MA' | 'CI' | 'SN' | 'CD' | 'CG'
export type BillingCurrency = 'MAD' | 'XOF' | 'XAF' | 'USD'

export const DEFAULT_BILLING_COUNTRY: BillingCountry = 'MA'

export const BILLING_COUNTRIES: {
  code: BillingCountry
  name: string
  currency: BillingCurrency
  flag: string
  /** Identifiant fiscal de l'entreprise dans ce pays (stocké dans le champ ice). */
  taxIdLabel: string
}[] = [
  { code: 'MA', name: 'Maroc', currency: 'MAD', flag: '🇲🇦', taxIdLabel: 'ICE' },
  { code: 'CI', name: 'Côte d’Ivoire', currency: 'XOF', flag: '🇨🇮', taxIdLabel: 'NCC' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', flag: '🇸🇳', taxIdLabel: 'NINEA' },
  { code: 'CD', name: 'RD Congo', currency: 'USD', flag: '🇨🇩', taxIdLabel: 'NIF' },
  { code: 'CG', name: 'Congo-Brazzaville', currency: 'XAF', flag: '🇨🇬', taxIdLabel: 'NIU' },
]

export function billingCountry(code?: string | null) {
  return BILLING_COUNTRIES.find((item) => item.code === code) ?? BILLING_COUNTRIES[0]
}

export function countryCurrency(code?: string | null): BillingCurrency {
  return billingCountry(code).currency
}
