import { createSeed, normalizeAddress, normalizeOrder } from '../seed'
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

const LOGO_STORAGE_KEY = 'agape-salgados:logo'

type SettingsRow = {
  id: number
  name: string
  tagline: string
  delivery_fee: number
  min_order: number
  admin_pin: string
  open: boolean
  logo?: string | null
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
  cost?: number | null
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

function readStoredLogo() {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStoredLogo(logo: string) {
  try {
    if (logo) localStorage.setItem(LOGO_STORAGE_KEY, logo)
    else localStorage.removeItem(LOGO_STORAGE_KEY)
  } catch {
    /* o cardápio local ainda guarda o logotipo */
  }
}

function mapSettings(row: SettingsRow): Settings {
  const hasLogoColumn = Object.prototype.hasOwnProperty.call(row, 'logo')
  const logo = hasLogoColumn ? (row.logo ?? '') : readStoredLogo()
  if (hasLogoColumn) writeStoredLogo(logo)
  return {
    name: row.name,
    tagline: row.tagline,
    deliveryFee: row.delivery_fee,
    minOrder: row.min_order,
    adminPin: row.admin_pin ?? '',
    open: row.open,
    logo,
  }
}

function missingColumn(error: { message?: string; code?: string }, column: string) {
  const message = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return (
    message.includes(column) &&
    (message.includes('column') || message.includes('schema') || message.includes('pgrst204'))
  )
}

function missingLogoColumn(error: { message?: string; code?: string }) {
  return missingColumn(error, 'logo')
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
    cost: row.cost ?? 0,
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

export type PublicCatalog = Pick<StoreData, 'settings' | 'categories' | 'products'>
export type AdminData = Pick<StoreData, 'orders' | 'customers'>

// Cardápio público: só o que o cliente pode ver (sem pedidos/clientes e sem o PIN).
export async function fetchPublicCatalog(): Promise<PublicCatalog | null> {
  if (!supabase) return null
  try {
    const [settingsRes, categoriesRes, productsRes] = await Promise.all([
      supabase
        .from('store_settings')
        .select('id,name,tagline,delivery_fee,min_order,open,logo')
        .eq('id', 1)
        .maybeSingle(),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*'),
    ])

    if (categoriesRes.error || productsRes.error) {
      console.error('Falha ao carregar o cardápio remoto', {
        categories: categoriesRes.error,
        products: productsRes.error,
      })
      return null
    }

    return {
      settings: settingsRes.data
        ? mapSettings(settingsRes.data as SettingsRow)
        : createSeed().settings,
      categories: (categoriesRes.data as CategoryRow[]).map(mapCategory),
      products: (productsRes.data as ProductRow[]).map(mapProduct),
    }
  } catch (error) {
    console.error('Falha ao carregar o cardápio remoto', error)
    return null
  }
}

// Dados sensíveis (pedidos + clientes): só para a loja autenticada.
export async function fetchAdminData(): Promise<AdminData | null> {
  if (!supabase) return null
  try {
    const [customersRes, addressesRes, ordersRes] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('addresses').select('*'),
      supabase.from('orders').select('*').order('id'),
    ])
    if (customersRes.error || addressesRes.error || ordersRes.error) {
      console.error('Falha ao carregar os pedidos', {
        customers: customersRes.error,
        addresses: addressesRes.error,
        orders: ordersRes.error,
      })
      return null
    }
    return {
      customers: mapCustomers(customersRes.data as CustomerRow[], addressesRes.data as AddressRow[]),
      orders: (ordersRes.data as OrderRow[]).map(mapOrder),
    }
  } catch (error) {
    console.error('Falha ao carregar os pedidos', error)
    return null
  }
}

// Cliente acompanha os próprios pedidos pelo telefone (via função no banco).
export async function fetchOrdersByPhone(phone: string): Promise<Order[]> {
  if (!supabase || !phone) return []
  const { data, error } = await supabase.rpc('get_orders_by_phone', { p_phone: phone })
  if (error || !data) return []
  return (data as OrderRow[]).map(mapOrder)
}

export async function fetchCustomerByPhone(phone: string): Promise<Customer | null> {
  if (!supabase || !phone) return null
  const { data, error } = await supabase.rpc('get_customer_by_phone', { p_phone: phone })
  if (error || !data) return null
  const row = data as { phone: string; lastAddressId: string | null; addresses: Address[] }
  return {
    phone: row.phone,
    lastAddressId: row.lastAddressId,
    addresses: (row.addresses ?? []).map((item) => normalizeAddress(item)),
  }
}

export async function signInAdmin(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOutAdmin() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getAdminSession(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

export function onAdminAuthChange(cb: (signedIn: boolean) => void) {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(Boolean(session)))
  return () => data.subscription.unsubscribe()
}

export async function saveSettings(patch: Partial<Settings>) {
  if (!supabase) return
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.tagline !== undefined) row.tagline = patch.tagline
  if (patch.deliveryFee !== undefined) row.delivery_fee = patch.deliveryFee
  if (patch.minOrder !== undefined) row.min_order = patch.minOrder
  if (patch.open !== undefined) row.open = patch.open
  if (patch.logo !== undefined) {
    writeStoredLogo(patch.logo)
    row.logo = patch.logo
  }
  const { error } = await supabase.from('store_settings').update(row).eq('id', 1)
  if (error && patch.logo !== undefined && missingLogoColumn(error)) {
    delete row.logo
    if (Object.keys(row).length === 0) return
    const retry = await supabase.from('store_settings').update(row).eq('id', 1)
    if (retry.error) throw retry.error
    return
  }
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
  const row = {
    id: product.id,
    category_id: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    cost: product.cost,
    image: product.image,
    available: product.available,
    highlight: product.highlight,
  }
  const { error } = await supabase.from('products').upsert(row)
  if (error && missingColumn(error, 'cost')) {
    const { cost: _cost, ...rest } = row
    const retry = await supabase.from('products').upsert(rest)
    if (retry.error) throw retry.error
    return
  }
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
  const productRows = seed.products.map((product) => ({
    id: product.id,
    category_id: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    cost: product.cost,
    image: product.image,
    available: product.available,
    highlight: product.highlight,
  }))
  let { error: prodInsert } = await supabase.from('products').insert(productRows)
  if (prodInsert && missingColumn(prodInsert, 'cost')) {
    const rows = productRows.map(({ cost: _cost, ...rest }) => rest)
    const retry = await supabase.from('products').insert(rows)
    prodInsert = retry.error
  }
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
}): Promise<Order> {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data, error } = await supabase.rpc('place_order', {
    p_phone: input.phone,
    p_address: {
      street: input.address.street,
      number: input.address.number,
      complement: input.address.complement,
      neighborhood: input.address.neighborhood,
      city: input.address.city,
      state: input.address.state,
      zip: input.address.zip,
    },
    p_payment: input.paymentMethod,
    p_change: input.changeFor,
    p_items: input.items,
    p_subtotal: input.subtotal,
    p_delivery: input.delivery,
    p_total: input.total,
  })
  if (error) throw error
  return mapOrder(data as OrderRow)
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
