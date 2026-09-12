import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  addressKey,
  CART_STORAGE_KEY,
  createSeed,
  normalizeOrder,
  STORAGE_KEY,
} from './seed'
import {
  deleteCategory,
  deleteProduct,
  fetchRemoteCatalog,
  hasRemote,
  insertRemoteOrder,
  replaceCatalog,
  saveCategory,
  saveOrderStatus,
  saveProduct,
  saveSettings,
  subscribeRemote,
} from './lib/remote'
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
} from './types'

type PlaceOrderInput = {
  phone: string
  address: Address
  paymentMethod: PaymentMethod
  changeFor: number | null
}

type StoreContextValue = {
  data: StoreData
  ready: boolean
  setSettings: (patch: Partial<Settings>) => void
  upsertCategory: (category: Category) => void
  removeCategory: (id: string) => void
  upsertProduct: (product: Product) => void
  removeProduct: (id: string) => void
  addToCart: (productId: string, qty?: number, note?: string) => void
  setQty: (productId: string, qty: number) => void
  setNote: (productId: string, note: string) => void
  clearCart: () => void
  resetCatalog: () => void
  findCustomer: (phone: string) => Customer | undefined
  placeOrder: (input: PlaceOrderInput) => Promise<Order>
  setOrderStatus: (id: string, status: OrderStatus) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('agape-salgados') : null

type CartSnapshot = {
  cart: CartLine[]
  lastPhone: string
}

function readCart(): CartSnapshot {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
    if (!raw) return { cart: [], lastPhone: '' }
    const parsed = JSON.parse(raw) as Partial<StoreData>
    return {
      cart: parsed.cart ?? [],
      lastPhone: parsed.lastPhone ?? '',
    }
  } catch {
    return { cart: [], lastPhone: '' }
  }
}

function persistCart(data: StoreData) {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ cart: data.cart, lastPhone: data.lastPhone }),
  )
  if (!hasRemote) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    syncChannel?.postMessage('updated')
  }
}

function readStored(): StoreData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoreData
    if (!parsed.settings || !Array.isArray(parsed.products)) return null
    const seed = createSeed()
    return {
      ...seed,
      ...parsed,
      cart: parsed.cart ?? [],
      customers: parsed.customers ?? [],
      orders: (parsed.orders ?? []).map(normalizeOrder),
      lastPhone: parsed.lastPhone ?? '',
    }
  } catch {
    return null
  }
}

function loadData(): StoreData {
  const cart = readCart()
  const base = hasRemote ? createSeed() : (readStored() ?? createSeed())
  return { ...base, cart: cart.cart, lastPhone: cart.lastPhone }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(loadData)
  const [ready, setReady] = useState(!hasRemote)

  const mergeRemote = useCallback(async () => {
    const remote = await fetchRemoteCatalog()
    if (!remote) return
    setData((current) => ({
      ...current,
      ...remote,
      cart: current.cart,
      lastPhone: current.lastPhone,
    }))
  }, [])

  const update = useCallback((recipe: (current: StoreData) => StoreData) => {
    setData((current) => {
      const next = recipe(current)
      persistCart(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!hasRemote) return
    let cancelled = false
    void (async () => {
      try {
        await Promise.race([
          mergeRemote(),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 8000)),
        ])
      } catch {
        /* usa o cardápio local se o banco remoto não responder */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    const unsubscribe = subscribeRemote(() => {
      void mergeRemote()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [mergeRemote])

  useEffect(() => {
    if (hasRemote) return
    const applyRemote = () => {
      const stored = readStored()
      if (stored) setData(stored)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) applyRemote()
    }
    window.addEventListener('storage', onStorage)
    syncChannel?.addEventListener('message', applyRemote)
    return () => {
      window.removeEventListener('storage', onStorage)
      syncChannel?.removeEventListener('message', applyRemote)
    }
  }, [])

  const value = useMemo<StoreContextValue>(
    () => ({
      data,
      ready,
      setSettings: (patch) => {
        update((current) => ({
          ...current,
          settings: { ...current.settings, ...patch },
        }))
        void saveSettings(patch)
      },
      upsertCategory: (category) => {
        update((current) => {
          const exists = current.categories.some((item) => item.id === category.id)
          return {
            ...current,
            categories: exists
              ? current.categories.map((item) => (item.id === category.id ? category : item))
              : [...current.categories, category].sort((a, b) => a.order - b.order),
          }
        })
        void saveCategory(category)
      },
      removeCategory: (id) => {
        update((current) => ({
          ...current,
          categories: current.categories.filter((item) => item.id !== id),
          products: current.products.filter((item) => item.categoryId !== id),
        }))
        void deleteCategory(id)
      },
      upsertProduct: (product) => {
        update((current) => {
          const exists = current.products.some((item) => item.id === product.id)
          return {
            ...current,
            products: exists
              ? current.products.map((item) => (item.id === product.id ? product : item))
              : [product, ...current.products],
          }
        })
        void saveProduct(product)
      },
      removeProduct: (id) => {
        update((current) => ({
          ...current,
          products: current.products.filter((item) => item.id !== id),
          cart: current.cart.filter((item) => item.productId !== id),
        }))
        void deleteProduct(id)
      },
      addToCart: (productId, qty = 1, note) =>
        update((current) => {
          const existing = current.cart.find((item) => item.productId === productId)
          if (existing) {
            return {
              ...current,
              cart: current.cart.map((item) =>
                item.productId === productId
                  ? {
                      ...item,
                      qty: item.qty + qty,
                      note: note ?? item.note,
                    }
                  : item,
              ),
            }
          }
          return {
            ...current,
            cart: [...current.cart, { productId, qty, note: note ?? '' }],
          }
        }),
      setQty: (productId, qty) =>
        update((current) => ({
          ...current,
          cart:
            qty <= 0
              ? current.cart.filter((item) => item.productId !== productId)
              : current.cart.map((item) =>
                  item.productId === productId ? { ...item, qty } : item,
                ),
        })),
      setNote: (productId, note) =>
        update((current) => ({
          ...current,
          cart: current.cart.map((item) =>
            item.productId === productId ? { ...item, note } : item,
          ),
        })),
      clearCart: () => update((current) => ({ ...current, cart: [] })),
      resetCatalog: () => {
        update((current) => {
          const seed = createSeed()
          return {
            ...seed,
            cart: [],
            customers: current.customers,
            orders: current.orders,
            lastPhone: current.lastPhone,
          }
        })
        void replaceCatalog()
      },
      findCustomer: (phone) => data.customers.find((item) => item.phone === phone),
      placeOrder: async (input) => {
        const totals = cartTotals(data)
        const existingCustomer = data.customers.find((item) => item.phone === input.phone)
        if (hasRemote) {
          const created = await insertRemoteOrder({
            phone: input.phone,
            address: input.address,
            paymentMethod: input.paymentMethod,
            changeFor: input.changeFor,
            items: data.cart,
            subtotal: totals.subtotal,
            delivery: totals.delivery,
            total: totals.total,
            existing: existingCustomer,
          })
          const duplicate = existingCustomer?.addresses.find(
            (item) => addressKey(item) === addressKey(input.address),
          )
          const savedAddress = duplicate ?? created.address
          const addresses = existingCustomer
            ? duplicate
              ? existingCustomer.addresses
              : [...existingCustomer.addresses, savedAddress]
            : [savedAddress]
          const customer: Customer = {
            phone: input.phone,
            addresses,
            lastAddressId: savedAddress.id,
          }
          const next: StoreData = {
            ...data,
            cart: [],
            lastPhone: input.phone,
            customers: existingCustomer
              ? data.customers.map((item) => (item.phone === input.phone ? customer : item))
              : [...data.customers, customer],
            orders: data.orders.some((item) => item.id === created.id)
              ? data.orders
              : [...data.orders, created],
          }
          persistCart(next)
          setData(next)
          return created
        }

        const duplicate = existingCustomer?.addresses.find(
          (item) => addressKey(item) === addressKey(input.address),
        )
        const savedAddress = duplicate ?? { ...input.address, id: crypto.randomUUID() }
        const addresses = existingCustomer
          ? duplicate
            ? existingCustomer.addresses
            : [...existingCustomer.addresses, savedAddress]
          : [savedAddress]
        const customer: Customer = {
          phone: input.phone,
          addresses,
          lastAddressId: savedAddress.id,
        }
        const created: Order = {
          id: String(1001 + data.orders.length),
          phone: input.phone,
          address: savedAddress,
          paymentMethod: input.paymentMethod,
          changeFor: input.changeFor,
          items: data.cart,
          subtotal: totals.subtotal,
          delivery: totals.delivery,
          total: totals.total,
          createdAt: new Date().toISOString(),
          status: 'new',
        }
        const next: StoreData = {
          ...data,
          cart: [],
          lastPhone: input.phone,
          customers: existingCustomer
            ? data.customers.map((item) => (item.phone === input.phone ? customer : item))
            : [...data.customers, customer],
          orders: [...data.orders, created],
        }
        persistCart(next)
        setData(next)
        return created
      },
      setOrderStatus: (id, status) => {
        update((current) => ({
          ...current,
          orders: current.orders.map((item) => (item.id === id ? { ...item, status } : item)),
        }))
        void saveOrderStatus(id, status)
      },
    }),
    [data, ready, update],
  )

  if (!ready) {
    return (
      <div className="app-shell">
        <p className="empty">Carregando cardápio…</p>
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de StoreProvider')
  return ctx
}

export function cartQty(cart: CartLine[], productId: string) {
  return cart.find((item) => item.productId === productId)?.qty ?? 0
}

export function cartTotals(data: StoreData) {
  const subtotal = data.cart.reduce((sum, line) => {
    const product = data.products.find((item) => item.id === line.productId)
    if (!product) return sum
    return sum + product.price * line.qty
  }, 0)
  const items = data.cart.reduce((sum, line) => sum + line.qty, 0)
  const delivery = subtotal > 0 ? data.settings.deliveryFee : 0
  return {
    items,
    subtotal,
    delivery,
    total: subtotal + delivery,
    belowMin: subtotal > 0 && subtotal < data.settings.minOrder,
    missing: Math.max(0, data.settings.minOrder - subtotal),
  }
}
