import type { Address, Order, OrderStatus, PaymentMethod, StoreData } from './types'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
  cash: 'Dinheiro',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Novo',
  preparing: 'Em preparo',
  out: 'Saiu para entrega',
  done: 'Entregue',
}

export function isOpenOrder(status: OrderStatus) {
  return status !== 'done'
}

export function normalizeOrder(order: Order): Order {
  return {
    ...order,
    status: order.status ?? 'new',
    address: normalizeAddress(order.address),
  }
}

export const STORAGE_KEY = 'agape-salgados:v1'
export const CART_STORAGE_KEY = 'agape-salgados:cart:v1'
export const DEFAULT_PIN = '1234'

export function createSeed(): StoreData {
  return {
    settings: {
      name: 'Ágape Salgados',
      tagline: 'Salgados artesanais · delivery em cerca de 40 min',
      deliveryFee: 699,
      minOrder: 2500,
      adminPin: DEFAULT_PIN,
      open: true,
    },
    categories: [
      { id: 'fritos', name: 'Fritos', order: 1 },
      { id: 'assados', name: 'Assados', order: 2 },
      { id: 'combos', name: 'Kits festa', order: 3 },
      { id: 'drinks', name: 'Bebidas', order: 4 },
      { id: 'doces', name: 'Doces', order: 5 },
    ],
    products: [
      {
        id: 'coxinha-frango',
        categoryId: 'fritos',
        name: 'Coxinha de frango',
        description: 'Massa crocante, recheio cremoso de frango desfiado.',
        price: 850,
        image:
          'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: true,
      },
      {
        id: 'kibe',
        categoryId: 'fritos',
        name: 'Kibe',
        description: 'Trigo, carne e hortelã — crocante por fora.',
        price: 750,
        image:
          'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'bolinha-queijo',
        categoryId: 'fritos',
        name: 'Bolinha de queijo',
        description: 'Queijo derretido na massa sequinha.',
        price: 700,
        image:
          'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'risole-palmito',
        categoryId: 'fritos',
        name: 'Risole de palmito',
        description: 'Clássico de festa, recheio de palmito.',
        price: 800,
        image:
          'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'pastel-carne',
        categoryId: 'fritos',
        name: 'Pastel de carne',
        description: 'Massa fina, carne moída temperada. Unidade.',
        price: 900,
        image:
          'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: true,
      },
      {
        id: 'esfirra-carne',
        categoryId: 'assados',
        name: 'Esfirra de carne',
        description: 'Aberta, carne suculenta e toque de limão.',
        price: 850,
        image:
          'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: true,
      },
      {
        id: 'esfirra-queijo',
        categoryId: 'assados',
        name: 'Esfirra de queijo',
        description: 'Muçarela gratinada na massa fofinha.',
        price: 850,
        image:
          'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'enroladinho',
        categoryId: 'assados',
        name: 'Enroladinho de salsicha',
        description: 'Massa amanteigada, salsicha e orégano.',
        price: 700,
        image:
          'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'pao-queijo',
        categoryId: 'assados',
        name: 'Pão de queijo',
        description: 'Mineiro, quentinho, com queijo da casa.',
        price: 600,
        image:
          'https://images.unsplash.com/photo-1598146411979-27a585ca0329?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: true,
      },
      {
        id: 'mini-pizza',
        categoryId: 'assados',
        name: 'Mini pizza',
        description: 'Molho, muçarela e orégano. Unidade.',
        price: 950,
        image:
          'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'kit-50',
        categoryId: 'combos',
        name: 'Kit festa 50 salgados',
        description: 'Mix de coxinhas, kibes, risolés e esfirras.',
        price: 8990,
        image:
          'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: true,
      },
      {
        id: 'kit-100',
        categoryId: 'combos',
        name: 'Kit festa 100 salgados',
        description: 'Para reunião ou aniversário. Mix da casa.',
        price: 16990,
        image:
          'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'combo-tarde',
        categoryId: 'combos',
        name: 'Combo café da tarde',
        description: '10 salgados sortidos, pão de queijo e suco.',
        price: 4590,
        image:
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'coca',
        categoryId: 'drinks',
        name: 'Coca-Cola 350 ml',
        description: 'Lata gelada.',
        price: 690,
        image:
          'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'guarana',
        categoryId: 'drinks',
        name: 'Guaraná 350 ml',
        description: 'Lata gelada.',
        price: 650,
        image:
          'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'agua',
        categoryId: 'drinks',
        name: 'Água 500 ml',
        description: 'Sem gás.',
        price: 400,
        image:
          'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'suco',
        categoryId: 'drinks',
        name: 'Suco natural 500 ml',
        description: 'Laranja, limão ou maracujá — indique na observação.',
        price: 1290,
        image:
          'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'brigadeiro',
        categoryId: 'doces',
        name: 'Brigadeiro',
        description: 'Unidade. Chocolate belga e granulado.',
        price: 450,
        image:
          'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
      {
        id: 'beijinho',
        categoryId: 'doces',
        name: 'Beijinho',
        description: 'Unidade. Coco, leite condensado e cravo.',
        price: 450,
        image:
          'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
        available: true,
        highlight: false,
      },
    ],
    cart: [],
    customers: [],
    orders: [],
    lastPhone: '',
  }
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function isValidPhone(value: string) {
  const digits = normalizePhone(value)
  return digits.length === 10 || digits.length === 11
}

export function emptyAddress(): Address {
  return {
    id: crypto.randomUUID(),
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip: '',
  }
}

export function normalizeAddress(address: Partial<Address> & Pick<Address, 'id'>): Address {
  return {
    id: address.id,
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    neighborhood: address.neighborhood ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zip: address.zip ?? '',
  }
}

export function formatAddress(address: Address) {
  const line = `${address.street}, ${address.number}`
  const extra = address.complement ? ` — ${address.complement}` : ''
  const city = address.state ? `${address.city}/${address.state}` : address.city
  const zip = address.zip ? ` · CEP ${address.zip}` : ''
  return `${line}${extra} · ${address.neighborhood}, ${city}${zip}`
}

export function addressKey(
  address: Pick<Address, 'street' | 'number' | 'neighborhood' | 'city' | 'state' | 'zip'>,
) {
  return [address.street, address.number, address.neighborhood, address.city, address.state, address.zip]
    .map((part) => part.trim().toLowerCase())
    .join('|')
}

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function parseReais(value: string) {
  const normalized = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function reaisInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}
