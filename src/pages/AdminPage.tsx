import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { KitchenBoard, pendingOrderCount } from '../components/KitchenBoard'
import { readImageFile } from '../lib/image'
import { DEFAULT_PIN, formatBRL, parseReais, reaisInput } from '../seed'
import { useStore } from '../store'
import type { Category, Product } from '../types'

const emptyProduct = (categoryId: string): Product => ({
  id: crypto.randomUUID(),
  categoryId,
  name: '',
  description: '',
  price: 0,
  image: '',
  available: true,
  highlight: false,
})

type Tab = 'pedidos' | 'produtos' | 'categorias' | 'loja'

function playKitchenPing() {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  const ctx = new AudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 880
  gain.gain.value = 0.09
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.stop(ctx.currentTime + 0.4)
}

export function AdminPage() {
  const { data, setSettings, upsertProduct, removeProduct, upsertCategory, removeCategory, resetCatalog } =
    useStore()
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('pedidos')
  const [editing, setEditing] = useState<Product | null>(null)
  const [priceText, setPriceText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )
  const [categoryForm, setCategoryForm] = useState<Category>({
    id: '',
    name: '',
    order: data.categories.length + 1,
  })
  const knownOrderIds = useRef<Set<string> | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState('')

  const sortedCategories = useMemo(
    () => data.categories.slice().sort((a, b) => a.order - b.order),
    [data.categories],
  )
  const pending = pendingOrderCount(data.orders)

  useEffect(() => {
    if (!authed) {
      knownOrderIds.current = null
      document.title = data.settings.name
      return
    }
    document.title = pending > 0 ? `(${pending}) Pedidos · ${data.settings.name}` : `Painel · ${data.settings.name}`
    return () => {
      document.title = data.settings.name
    }
  }, [authed, pending, data.settings.name])

  useEffect(() => {
    if (!authed) return
    const ids = data.orders.map((order) => order.id)
    if (!knownOrderIds.current) {
      knownOrderIds.current = new Set(ids)
      return
    }
    const fresh = data.orders.filter((order) => !knownOrderIds.current!.has(order.id))
    ids.forEach((id) => knownOrderIds.current!.add(id))
    if (fresh.length === 0) return

    const newest = fresh[fresh.length - 1]
    const message =
      fresh.length === 1
        ? `Novo pedido #${newest.id} · ${formatBRL(newest.total)}`
        : `${fresh.length} pedidos novos na fila`
    setToast(message)
    setTab('pedidos')
    playKitchenPing()
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`${data.settings.name} · pedido #${newest.id}`, {
        body: `${newest.items.reduce((sum, line) => sum + line.qty, 0)} item(ns) · ${formatBRL(newest.total)}`,
        tag: `order-${newest.id}`,
      })
    }
  }, [authed, data.orders, data.settings.name])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!authed) {
    return (
      <div className="app-shell">
        <form
          className="admin-gate"
          onSubmit={(e) => {
            e.preventDefault()
            if (pin === data.settings.adminPin) {
              setAuthed(true)
              setError('')
              if (pendingOrderCount(data.orders) > 0) setTab('pedidos')
            } else {
              setError('PIN incorreto.')
            }
          }}
        >
          <h1>Área da loja</h1>
          <p style={{ color: 'var(--muted)' }}>
            PIN inicial de demonstração: <strong>{DEFAULT_PIN}</strong>
          </p>
          <label>
            PIN
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          </label>
          {error && <p className="warn">{error}</p>}
          <button className="btn" type="submit">
            Entrar
          </button>
          <Link className="footer-link" to="/">
            Voltar ao cardápio
          </Link>
        </form>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="admin">
        <header className="topbar">
          <div className="brand">
            {data.settings.logo && (
              <img className="brand-logo" src={data.settings.logo} alt="" />
            )}
            <div>
              <h1>Painel</h1>
              <p style={{ color: 'var(--muted)', margin: 0 }}>{data.settings.name}</p>
            </div>
          </div>
          <div className="admin-actions">
            <button
              className="order-bell"
              type="button"
              onClick={() => setTab('pedidos')}
              aria-label={
                pending > 0 ? `${pending} pedidos a atender` : 'Nenhum pedido pendente'
              }
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5L2 18v1h20v-1l-2-2Z"
                />
              </svg>
              {pending > 0 && <span className="tab-count">{pending}</span>}
            </button>
            <Link className="chip" to="/">
              Ver cardápio
            </Link>
          </div>
        </header>

        {notifyPerm === 'default' && (
          <button
            className="notify-banner"
            type="button"
            onClick={async () => {
              if (typeof Notification === 'undefined') return
              const perm = await Notification.requestPermission()
              setNotifyPerm(perm)
            }}
          >
            Ativar notificações de novos pedidos neste aparelho
          </button>
        )}

        <div className="tabs">
          {(['pedidos', 'produtos', 'categorias', 'loja'] as const).map((item) => (
            <button
              key={item}
              className={`chip ${tab === item ? 'active' : ''}`}
              type="button"
              onClick={() => setTab(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
              {item === 'pedidos' && pending > 0 && <span className="tab-count">{pending}</span>}
            </button>
          ))}
        </div>

        {tab === 'pedidos' && <KitchenBoard />}

        {tab === 'produtos' && (
          <div className="admin-grid">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!editing?.name.trim()) return
                upsertProduct({ ...editing, price: parseReais(priceText) })
                setEditing(null)
              }}
            >
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {editing ? 'Editar item' : 'Novo item'}
              </h2>
              {!editing && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const next = emptyProduct(sortedCategories[0]?.id ?? 'geral')
                    setEditing(next)
                    setPriceText(reaisInput(next.price))
                  }}
                >
                  Adicionar item
                </button>
              )}
              {editing && (
                <>
                  <label>
                    Nome
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Descrição
                    <textarea
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    />
                  </label>
                  <label>
                    Preço (R$)
                    <input
                      value={priceText}
                      onChange={(e) => setPriceText(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    Categoria
                    <select
                      value={editing.categoryId}
                      onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                    >
                      {sortedCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PhotoField
                    image={editing.image}
                    onChange={(image) => setEditing({ ...editing, image })}
                  />
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={editing.available}
                      onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                    />
                    Disponível
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={editing.highlight}
                      onChange={(e) => setEditing({ ...editing, highlight: e.target.checked })}
                    />
                    Destaque
                  </label>
                  <div className="row-actions">
                    <button className="btn" type="submit">
                      Salvar
                    </button>
                    <button className="btn ghost" type="button" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </form>

            <div>
              {data.products.map((product) => (
                <div className="product-row" key={product.id}>
                  <img src={product.image || undefined} alt="" />
                  <div>
                    <strong>{product.name}</strong>
                    <div>
                      <small>
                        {formatCategory(product.categoryId, data.categories)} · R$ {reaisInput(product.price)}
                        {!product.available ? ' · pausado' : ''}
                      </small>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setEditing(product)
                        setPriceText(reaisInput(product.price))
                      }}
                    >
                      Editar
                    </button>
                    <button className="btn ghost" type="button" onClick={() => removeProduct(product.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'categorias' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!categoryForm.name.trim()) return
              upsertCategory({
                ...categoryForm,
                id: categoryForm.id || slugify(categoryForm.name),
              })
              setCategoryForm({ id: '', name: '', order: data.categories.length + 1 })
            }}
          >
            <label>
              Nome da categoria
              <input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
            </label>
            <label>
              Ordem
              <input
                type="number"
                value={categoryForm.order}
                onChange={(e) => setCategoryForm({ ...categoryForm, order: Number(e.target.value) })}
              />
            </label>
            <button className="btn" type="submit">
              Salvar categoria
            </button>
            <div style={{ marginTop: 18 }}>
              {sortedCategories.map((category) => (
                <div className="product-row" key={category.id} style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <strong>{category.name}</strong>
                    <div>
                      <small>ordem {category.order}</small>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button className="btn ghost" type="button" onClick={() => setCategoryForm(category)}>
                      Editar
                    </button>
                    <button className="btn ghost" type="button" onClick={() => removeCategory(category.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </form>
        )}

        {tab === 'loja' && (
          <>
          <section className="logo-panel">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Logotipo
            </h2>
            <p className="muted">Aparece no topo do cardápio. Envie o arquivo da imagem.</p>
            {data.settings.logo ? (
              <img className="logo-preview" src={data.settings.logo} alt="Logotipo da loja" />
            ) : (
              <p className="muted">Nenhum logotipo cadastrado.</p>
            )}
            <div className="row-actions">
              <button
                className="btn"
                type="button"
                disabled={logoBusy}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoBusy ? 'Enviando…' : data.settings.logo ? 'Editar logotipo' : 'Incluir logotipo'}
              </button>
              {data.settings.logo && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setLogoError('')
                    setSettings({ logo: '' })
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              aria-label="Arquivo do logotipo"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setLogoBusy(true)
                setLogoError('')
                void readImageFile(file, 'logo')
                  .then((logo) => setSettings({ logo }))
                  .catch((err: unknown) => {
                    setLogoError(err instanceof Error ? err.message : 'Não foi possível enviar o logotipo.')
                  })
                  .finally(() => setLogoBusy(false))
              }}
            />
            {logoError && <p className="warn">{logoError}</p>}
          </section>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              setSettings({
                name: String(form.get('name') ?? ''),
                tagline: String(form.get('tagline') ?? ''),
                deliveryFee: parseReais(String(form.get('deliveryFee') ?? '0')),
                minOrder: parseReais(String(form.get('minOrder') ?? '0')),
                adminPin: String(form.get('adminPin') ?? DEFAULT_PIN),
                open: form.get('open') === 'on',
              })
            }}
          >
            <label>
              Nome da loja
              <input name="name" defaultValue={data.settings.name} />
            </label>
            <label>
              Frase de apoio
              <input name="tagline" defaultValue={data.settings.tagline} />
            </label>
            <label>
              Taxa de entrega (R$)
              <input name="deliveryFee" defaultValue={reaisInput(data.settings.deliveryFee)} />
            </label>
            <label>
              Pedido mínimo (R$)
              <input name="minOrder" defaultValue={reaisInput(data.settings.minOrder)} />
            </label>
            <label>
              PIN do painel
              <input name="adminPin" defaultValue={data.settings.adminPin} />
            </label>
            <label className="check">
              <input type="checkbox" name="open" defaultChecked={data.settings.open} />
              Loja aberta
            </label>
            <button className="btn" type="submit">
              Salvar loja
            </button>
            <button
              className="btn ghost"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => {
                if (confirm('Isso apaga suas alterações e volta o cardápio de exemplo.')) {
                  resetCatalog()
                }
              }}
            >
              Restaurar cardápio de exemplo
            </button>
          </form>
          </>
        )}
      </div>

      {toast && (
        <div className="kitchen-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function PhotoField({ image, onChange }: { image: string; onChange: (image: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const uploaded = image.startsWith('data:')

  return (
    <div className="image-field">
      <span className="image-field-label">Foto do item</span>
      {image ? (
        <img className="image-preview" src={image} alt="" />
      ) : (
        <p className="muted">Nenhuma foto.</p>
      )}
      <div className="row-actions">
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Enviando…' : image ? 'Trocar foto' : 'Enviar foto'}
        </button>
        {image && (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setError('')
              onChange('')
            }}
          >
            Remover
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept="image/*"
        aria-label="Arquivo da foto do item"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          void readImageFile(file, 'photo')
            .then(onChange)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.')
            })
            .finally(() => setBusy(false))
        }}
      />
      <label>
        Ou cole o link da foto
        <input
          value={uploaded ? '' : image}
          onChange={(e) => onChange(e.target.value)}
          placeholder={uploaded ? 'Foto enviada deste aparelho' : 'https://...'}
        />
      </label>
      {error && <p className="warn">{error}</p>}
    </div>
  )
}

function formatCategory(id: string, categories: Category[]) {
  return categories.find((item) => item.id === id)?.name ?? id
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
