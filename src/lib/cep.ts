export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export type BrazilianState = (typeof BRAZILIAN_STATES)[number]

export type CepAddress = {
  street: string
  neighborhood: string
  city: string
  state: string
}

export function zipDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatZip(value: string) {
  const digits = zipDigits(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function isValidZip(value: string) {
  return zipDigits(value).length === 8
}

type ViaCepResponse = {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = zipDigits(cep)
  if (digits.length !== 8) return null

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal })
  if (!response.ok) {
    throw new Error('cep-http')
  }

  const data = (await response.json()) as ViaCepResponse
  if (data.erro === true || data.erro === 'true') return null

  return {
    street: data.logradouro?.trim() ?? '',
    neighborhood: data.bairro?.trim() ?? '',
    city: data.localidade?.trim() ?? '',
    state: data.uf?.trim().toUpperCase() ?? '',
  }
}
