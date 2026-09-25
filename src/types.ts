export type Category = {
  id: string
  name: string
  order: number
}

export type Product = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string
  available: boolean
  highlight: boolean
}

export type CartLine = {
  productId: string
  qty: number
  note: string
}

export type Settings = {
  name: string
  tagline: string
  deliveryFee: number
  minOrder: number
  adminPin: string
  open: boolean
  logo: string
}

export type Address = {
  id: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip: string
}

export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash'

export type OrderStatus = 'new' | 'preparing' | 'out' | 'done'

export type Customer = {
  phone: string
  addresses: Address[]
  lastAddressId: string | null
}

export type Order = {
  id: string
  phone: string
  address: Address
  paymentMethod: PaymentMethod
  changeFor: number | null
  items: CartLine[]
  subtotal: number
  delivery: number
  total: number
  createdAt: string
  status: OrderStatus
}

export type StoreData = {
  settings: Settings
  categories: Category[]
  products: Product[]
  cart: CartLine[]
  customers: Customer[]
  orders: Order[]
  lastPhone: string
}
