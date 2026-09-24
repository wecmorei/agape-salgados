import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartPanel, CartSheet } from '../components/CartSheet'
import { formatBRL } from '../seed'
import { cartQty, cartTotals, useStore } from '../store'
import type { Product } from '../types'

function FoodImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return <div className={className} style={{ background: 'linear-gradient(135deg,#e8d5c4,#c7451b33)' }} />
  }
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />
}

function QtyControl({
  qty,
  onAdd,
  onDec,
  disabled,
}: {
  qty: number
  onAdd: () => void
  onDec: () => void
  disabled?: boolean
}) {
  if (qty === 0) {
    return (
      <div className="qty">
        <button type="button" onClick={onAdd} disabled={disabled} aria-label="Adicionar">
          +
        </button>
      </div>
    )
  }
  return (
    <div className="qty">
      <button type="button" onClick={onDec} aria-label="Diminuir">
        −
      </button>
      <span>{qty}</span>
      <button type="button" onClick={onAdd} disabled={disabled} aria-label="Aumentar">
        +
      </button>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const { data, addToCart, setQty } = useStore()
  const qty = cartQty(data.cart, product.id)
  return (
    <article className={`card ${product.available ? '' : 'unavailable'}`}>
      <div>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="price">{formatBRL(product.price)}</div>
        <QtyControl
          qty={qty}
          disabled={!product.available}
          onAdd={() => addToCart(product.id)}
          onDec={() => setQty(product.id, qty - 1)}
        />
      </div>
      <FoodImage className="thumb" src={product.image} alt="" />
    </article>
  )
}

export function MenuPage() {
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [startOnCheckout, setStartOnCheckout] = useState(false)
  const totals = cartTotals(data)

  useEffect(() => {
    document.title = data.settings.name
  }, [data.settings.name])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.products.filter((product) => {
      const matchCat = categoryId === 'all' || product.categoryId === categoryId
      const categoryName =
        data.categories.find((item) => item.id === product.categoryId)?.name.toLowerCase() ?? ''
      const matchQ =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        categoryName.includes(q)
      return matchCat && matchQ
    })
  }, [data.products, data.categories, categoryId, query])

  const highlights = data.products.filter((product) => product.highlight && product.available)
  const grouped = data.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      category,
      products: filtered.filter((product) => product.categoryId === category.id),
    }))
    .filter((group) => group.products.length > 0)

  function openSheet(checkout = false) {
    setStartOnCheckout(checkout)
    setSheetOpen(true)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          {data.settings.logo && (
            <img className="brand-logo" src={data.settings.logo} alt="" />
          )}
          <div>
            <h1>{data.settings.name}</h1>
            <p>{data.settings.tagline}</p>
          </div>
        </div>
        <span className={`badge ${data.settings.open ? '' : 'closed'}`}>
          {data.settings.open ? 'Aberto' : 'Fechado'}
        </span>
      </header>

      <div className="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no cardápio"
          aria-label="Buscar no cardápio"
        />
      </div>

      <nav className="chips" aria-label="Categorias">
        <button
          className={`chip ${categoryId === 'all' ? 'active' : ''}`}
          type="button"
          onClick={() => setCategoryId('all')}
        >
          Todos
        </button>
        {data.categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((category) => (
            <button
              key={category.id}
              className={`chip ${categoryId === category.id ? 'active' : ''}`}
              type="button"
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
      </nav>

      <div className="layout">
        <div>
          {categoryId === 'all' && !query && highlights.length > 0 && (
            <>
              <h2 className="section-title">Destaques</h2>
              <div className="grid">
                {highlights.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}

          {grouped.map((group) => (
            <section key={group.category.id}>
              <h2 className="section-title">{group.category.name}</h2>
              <div className="grid">
                {group.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}

          {filtered.length === 0 && <p className="empty">Nenhum item encontrado.</p>}
        </div>

        <aside className="cart-dock">
          <CartPanel onCheckout={() => openSheet(true)} />
        </aside>
      </div>

      {totals.items > 0 && (
        <button className="cart-bar" type="button" onClick={() => openSheet(false)}>
          <span>
            {totals.items} {totals.items === 1 ? 'item' : 'itens'}
          </span>
          <span>Ver carrinho · {formatBRL(totals.total)}</span>
        </button>
      )}

      <CartSheet open={sheetOpen} startOnCheckout={startOnCheckout} onClose={() => setSheetOpen(false)} />

      <Link className="footer-link" to="/admin">
        Área da loja
      </Link>
    </div>
  )
}
