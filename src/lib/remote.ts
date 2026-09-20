import { addressKey, createSeed, normalizeAddress, normalizeOrder } from '../seed'
import type {
  Address,
  CartLine,
  Category,
  Customer,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  Settings,
  StoreData,
} from '../types'
import { supabase } from './supabase'

type SettingsRow = {
  id: number
  name: string
  tagline: string
  delivery_fee: number
  min_order: number
  admin_pin: string
  open: boolean
}

type CategoryRow = {
  id: string
  name: string
  sort_order: number
}

type ProductRow = {
  id: string
  category_id: string
  name: string
  description: string
  price: number
  image: string
  available: boolean
  highlight: boolean
}

type CustomerRow = {
  phone: string
  last_address_id: string | null
}

type AddressRow = {
  id: string
  phone: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state?: string | null
  zip: string
}

type OrderRow = {
  id: number
  phone: string
  address: Address
  payment_method: PaymentMethod
  change_for: number | null
  items: CartLine[]
  subtotal: number
  delivery: number
  total: number
  created_at: string
  status: OrderStatus
}

export const hasRemote = Boolean(supabase)

function mapSettings(row: SettingsRow): Settings {
  return {
    name: row.name,
    tagline: row.tagline,
    deliveryFee: row.delivery_fee,
    minOrder: row.min_order,
    adminPin: row.admin_pin,
    open: row.open,
  }
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, order: row.sort_order }
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    image: row.image,
    available: row.available,
    highlight: row.highlight,
  }
}

function mapOrder(row: OrderRow): Order {
  return normalizeOrder({
    id: String(row.id),
    phone: row.phone,
    address: normalizeAddress(row.address),
    paymentMethod: row.payment_method,
    changeFor: row.change_for,
    items: row.items ?? [],
    subtotal: row.subtotal,
    delivery: row.delivery,
    total: row.total,
    createdAt: row.created_at,
    status: row.status,
  })
}

function mapCustomers(rows: CustomerRow[], addresses: AddressRow[]): Customer[] {
  return rows.map((row) => {
    const list = addresses
      .filter((item) => item.phone === row.phone)
      .map((item) =>
        normalizeAddress({
          id: item.id,
          street: item.street,
          number: item.number,
          complement: item.complement,
          neighborhood: item.neighborhood,
          city: item.city,
          state: item.state ?? '',
          zip: item.zip,
        }),
      )
    return {
      phone: row.phone,
      addresses: list,
      lastAddressId: row.last_address_id,
    }
  })
}

export async function fetchRemoteCatalog(): Promise<Omit<StoreData, 'cart' | 'lastPhone'> | null> {
  if (!supabase) return null
  try {
    const [settingsRes, categoriesRes, productsRes, customersRes, addressesRes, ordersRes] = await Promise.all([
      supabase.from('store_settings').select('*').eq('id', 1).single(),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('addresses').select('*'),
      supabase.from('orders').select('*').order('id'),
    ])

    if (settingsRes.error || categoriesRes.error || productsRes.error || customersRes.error || addressesRes.error || ordersRes.error) {
      console.error('Falha ao carregar o cardápio remoto', {
        settings: settingsRes.error,
        categories: categoriesRes.error,
        products: productsRes.error,
        customers: customersRes.error,
        addresses: addressesRes.error,
        orders: ordersRes.error,
      })
      return null
    }

    return {
      settings: mapSettings(settingsRes.data as SettingsRow),
      categories: (categoriesRes.data as CategoryRow[]).map(mapCategory),
      products: (productsRes.data as ProductRow[]).map(mapProduct),
      customers: mapCustomers(customersRes.data as CustomerRow[], addressesRes.data as AddressRow[]),
      orders: (ordersRes.data as OrderRow[]).map(mapOrder),
    }
  } catch (error) {
    console.error('Falha ao carregar o cardápio remoto', error)
    return null
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  if (!supabase) return
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.tagline !== undefined) row.tagline = patch.tagline
  if (patch.deliveryFee !== undefined) row.delivery_fee = patch.deliveryFee
  if (patch.minOrder !== undefined) row.min_order = patch.minOrder
  if (patch.adminPin !== undefined) row.admin_pin = patch.adminPin
  if (patch.open !== undefined) row.open = patch.open
  const { error } = await supabase.from('store_settings').update(row).eq('id', 1)
  if (error) throw error
}

export async function saveCategory(category: Category) {
  if (!supabase) return
  const { error } = await supabase.from('categories').upsert({
    id: category.id,
    name: category.name,
    sort_order: category.order,
  })
  if (error) throw error
}

export async function deleteCategory(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function saveProduct(product: Product) {
  if (!supabase) return
  const { error } = await supabase.from('products').upsert({
    id: product.id,
    category_id: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    image: product.image,
    available: product.available,
    highlight: product.highlight,
  })
  if (error) throw error
}

export async function deleteProduct(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function replaceCatalog() {
  if (!supabase) return
  const seed = createSeed()
  const { error: productError } = await supabase.from('products').delete().neq('id', '')
  if (productError) throw productError
  const { error: categoryError } = await supabase.from('categories').delete().neq('id', '')
  if (categoryError) throw categoryError
  const { error: catInsert } = await supabase.from('categories').insert(
    seed.categories.map((category) => ({
      id: category.id,
      name: category.name,
      sort_order: category.order,
    })),
  )
  if (catInsert) throw catInsert
  const { error: prodInsert } = await supabase.from('products').insert(
    seed.products.map((product) => ({
      id: product.id,
      category_id: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      available: product.available,
      highlight: product.highlight,
    })),
  )
  if (prodInsert) throw prodInsert
  await saveSettings(seed.settings)
}

export async function saveOrderStatus(id: string, status: OrderStatus) {
  if (!supabase) return
  const { error } = await supabase.from('orders').update({ status }).eq('id', Number(id))
  if (error) throw error
}

export async function insertRemoteOrder(input: {
  phone: string
  address: Address
  paymentMethod: PaymentMethod
  changeFor: number | null
  items: CartLine[]
  subtotal: number
  delivery: number
  total: number
  existing?: Customer
}): Promise<Order> {
  if (!supabase) throw new Error('Supabase não configurado')

  const { error: customerError } = await supabase.from('customers').upsert({
    phone: input.phone,
    last_address_id: input.existing?.lastAddressId ?? null,
  })
  if (customerError) throw customerError

  const duplicate = input.existing?.addresses.find((item) => addressKey(item) === addressKey(input.address))
  let savedAddress = duplicate ?? { ...input.address, id: crypto.randomUUID() }

  if (!duplicate) {
    const { data, error } = await supabase
      .from('addresses')
      .insert({
        id: savedAddress.id,
        phone: input.phone,
        street: savedAddress.street,
        number: savedAddress.number,
        complement: savedAddress.complement,
        neighborhood: savedAddress.neighborhood,
        city: savedAddress.city,
        zip: savedAddress.zip,
      })
      .select('id')
      .single()
    if (error) throw error
    savedAddress = { ...savedAddress, id: data.id }
  }

  const { error: lastAddrError } = await supabase
    .from('customers')
    .update({ last_address_id: savedAddress.id })
    .eq('phone', input.phone)
  if (lastAddrError) throw lastAddrError

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      phone: input.phone,
      address: savedAddress,
      payment_method: input.paymentMethod,
      change_for: input.changeFor,
      items: input.items,
      subtotal: input.subtotal,
      delivery: input.delivery,
      total: input.total,
      status: 'new',
    })
    .select('*')
    .single()
  if (orderError) throw orderError

  return mapOrder(order as OrderRow)
}

export function subscribeRemote(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase
    .channel('agape-store')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'addresses' }, onChange)
    .subscribe()

  return () => {
    void supabase?.removeChannel(channel)
  }
}
