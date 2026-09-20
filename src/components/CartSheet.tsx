import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BRAZILIAN_STATES,
  formatZip,
  isValidZip,
  lookupCep,
  zipDigits,
} from '../lib/cep'
import {
  emptyAddress,
  formatAddress,
  formatBRL,
  formatPhone,
  isValidPhone,
  normalizeAddress,
  normalizePhone,
  parseReais,
  reaisInput,
} from '../seed'
import { cartTotals, useStore } from '../store'
import type { Address, Order, PaymentMethod } from '../types'

type CepStatus = 'idle' | 'loading' | 'ok' | 'not-found' | 'error'

type Step = 'cart' | 'phone' | 'address' | 'payment' | 'done'

const PAYMENTS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'pix', label: 'Pix', hint: 'Pagamento na entrega ou pelo app da loja' },
  { id: 'credit', label: 'Cartão de crédito', hint: 'Máquina na entrega' },
  { id: 'debit', label: 'Cartão de débito', hint: 'Máquina na entrega' },
  { id: 'cash', label: 'Dinheiro', hint: 'Informe se precisa de troco' },
]

export function CartSheet({
  open,
  onClose,
  startOnCheckout = false,
}: {
  open: boolean
  onClose: () => void
  startOnCheckout?: boolean
}) {
  const { data, clearCart, findCustomer, placeOrder } = useStore()
  const totals = cartTotals(data)
  const [step, setStep] = useState<Step>('cart')
  const [phone, setPhone] = useState('')
  const [returning, setReturning] = useState(false)
  const [address, setAddress] = useState<Address>(emptyAddress())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod>('pix')
  const [needsChange, setNeedsChange] = useState(false)
  const [changeText, setChangeText] = useState('')
  const [error, setError] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const lastCepLookup = useRef('')

  const customer = useMemo(
    () => findCustomer(normalizePhone(phone)),
    [findCustomer, phone],
  )

  useEffect(() => {
    if (!open) return
    setStep(startOnCheckout ? 'phone' : 'cart')
    setPhone(formatPhone(data.lastPhone))
    setError('')
    setOrder(null)
    setPayment('pix')
    setNeedsChange(false)
    setChangeText('')
    setAddingNew(false)
    setCepStatus('idle')
    lastCepLookup.current = ''
  }, [open, startOnCheckout])

  useEffect(() => {
    if (step !== 'address') return
    const digits = zipDigits(address.zip)
    if (digits.length !== 8 || digits === lastCepLookup.current) return

    const controller = new AbortController()
    setCepStatus('loading')

    void lookupCep(digits, controller.signal)
      .then((result) => {
        lastCepLookup.current = digits
        if (!result) {
          setCepStatus('not-found')
          return
        }
        setCepStatus('ok')
        setAddress((current) => {
          if (zipDigits(current.zip) !== digits) return current
          return {
            ...current,
            street: result.street,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
            zip: formatZip(digits),
          }
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        lastCepLookup.current = digits
        setCepStatus('error')
      })

    return () => controller.abort()
  }, [address.zip, step])

  if (!open) return null

  function close() {
    setStep('cart')
    onClose()
  }

  function fillSavedAddress(item: Address) {
    const next = normalizeAddress({ ...item, zip: formatZip(item.zip ?? '') })
    setAddress(next)
    if (next.state && isValidZip(next.zip)) {
      lastCepLookup.current = zipDigits(next.zip)
      setCepStatus('ok')
      return
    }
    lastCepLookup.current = ''
    setCepStatus('idle')
  }

  function fillNewAddress() {
    setAddress(emptyAddress())
    lastCepLookup.current = ''
    setCepStatus('idle')
  }

  function goAddress() {
    if (!isValidPhone(phone)) {
      setError('Informe um telefone válido com DDD.')
      return
    }
    const found = findCustomer(normalizePhone(phone))
    setError('')
    setReturning(Boolean(found))
    if (found && found.addresses.length > 0) {
      const last =
        found.addresses.find((item) => item.id === found.lastAddressId) ?? found.addresses[0]
      fillSavedAddress(last)
      setSelectedId(last.id)
      setAddingNew(false)
    } else {
      fillNewAddress()
      setSelectedId(null)
      setAddingNew(true)
    }
    setStep('address')
  }

  function goPayment() {
    if (!isValidZip(address.zip)) {
      setError('Informe um CEP válido.')
      return
    }
    if (
      !address.street.trim() ||
      !address.number.trim() ||
      !address.neighborhood.trim() ||
      !address.city.trim() ||
      !address.state.trim()
    ) {
      setError('Preencha rua, número, bairro, cidade e estado.')
      return
    }
    setError('')
    setStep('payment')
  }

  async function confirm() {
    if (totals.belowMin || totals.items === 0) {
      setError('Seu carrinho não atinge o pedido mínimo.')
      return
    }
    let changeFor: number | null = null
    if (payment === 'cash' && needsChange) {
      changeFor = parseReais(changeText)
      if (changeFor < totals.total) {
        setError(`O troco precisa ser pelo menos ${formatBRL(totals.total)}.`)
        return
      }
    }
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const placed = await placeOrder({
        phone: normalizePhone(phone),
        address,
        paymentMethod: payment,
        changeFor,
      })
      setOrder(placed)
      setStep('done')
    } catch {
      setError('Não foi possível enviar o pedido. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = {
    cart: 'Carrinho',
    phone: 'Seu telefone',
    address: 'Entrega',
    payment: 'Pagamento',
    done: 'Pedido confirmado',
  }[step]

  const shownCepStatus = isValidZip(address.zip) ? cepStatus : 'idle'

  return (
    <>
      <button className="sheet-backdrop" type="button" aria-label="Fechar" onClick={close} />
      <div className="sheet" role="dialog" aria-label={title}>
        <p className="step-hint">
          {step === 'cart' && 'Revise os itens e finalize quando quiser'}
          {step === 'phone' && 'Passo 1 de 3 · usamos o telefone para reconhecer você'}
          {step === 'address' && 'Passo 2 de 3 · onde entregar'}
          {step === 'payment' && 'Passo 3 de 3 · como pagar'}
          {step === 'done' && `Pedido #${order?.id}`}
        </p>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {title}
        </h2>

        {step === 'cart' && (
          <>
            <CartLines onClear={clearCart} />
            <div className="checkout-actions">
              <button
                className="btn dark"
                type="button"
                disabled={totals.items === 0 || totals.belowMin || !data.settings.open}
                onClick={() => {
                  setError('')
                  setStep('phone')
                }}
              >
                Finalizar pedido
              </button>
              <button className="btn ghost" type="button" onClick={close}>
                Adicionar mais itens
              </button>
            </div>
            {!data.settings.open && <p className="warn">A loja está fechada no momento.</p>}
          </>
        )}

        {step === 'phone' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              goAddress()
            }}
          >
            <p className="muted">
              Com o mesmo número, na próxima compra o endereço volta preenchido.
            </p>
            <label>
              Telefone com DDD
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                autoFocus
              />
            </label>
            {error && <p className="warn">{error}</p>}
            <div className="checkout-actions">
              <button className="btn dark" type="submit">
                Continuar
              </button>
              <button className="btn ghost" type="button" onClick={() => setStep('cart')}>
                Voltar ao carrinho
              </button>
            </div>
          </form>
        )}

        {step === 'address' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              goPayment()
            }}
          >
            {returning && customer && customer.addresses.length > 0 && (
              <>
                <p className="welcome">Encontramos seus dados. O endereço já veio preenchido — confirme ou adicione outro.</p>
                {customer.addresses.length > 1 && (
                  <div className="address-list">
                    {customer.addresses.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`address-card ${!addingNew && selectedId === item.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedId(item.id)
                          fillSavedAddress(item)
                          setAddingNew(false)
                          setError('')
                        }}
                      >
                        {formatAddress(item)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="btn ghost"
                  type="button"
                  style={{ marginBottom: 12 }}
                  onClick={() => {
                    setAddingNew(true)
                    setSelectedId(null)
                    fillNewAddress()
                    setError('')
                  }}
                >
                  Adicionar outro endereço
                </button>
              </>
            )}

            <div className="address-form">
              <label>
                CEP
                <input
                  value={address.zip}
                  onChange={(e) => setAddress({ ...address, zip: formatZip(e.target.value) })}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  autoFocus={addingNew}
                  maxLength={9}
                />
              </label>
              {shownCepStatus === 'loading' && <p className="cep-status">Buscando endereço…</p>}
              {shownCepStatus === 'ok' && (
                <p className="cep-status ok">Endereço encontrado. Confira e informe o número.</p>
              )}
              {shownCepStatus === 'not-found' && (
                <p className="cep-status warn">CEP não encontrado. Preencha o endereço manualmente.</p>
              )}
              {shownCepStatus === 'error' && (
                <p className="cep-status warn">Não foi possível consultar o CEP. Preencha o endereço manualmente.</p>
              )}
              {shownCepStatus === 'idle' && (
                <p className="field-hint">Ao preencher o CEP, rua, bairro, cidade e estado entram sozinhos.</p>
              )}
              <label>
                Rua
                <input
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  autoComplete="street-address"
                />
              </label>
              <div className="field-row">
                <label>
                  Número
                  <input
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    autoComplete="address-line2"
                  />
                </label>
                <label>
                  Complemento
                  <input
                    value={address.complement}
                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                    placeholder="Apto, bloco..."
                  />
                </label>
              </div>
              <label>
                Bairro
                <input
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                />
              </label>
              <div className="field-row city-state">
                <label>
                  Cidade
                  <input
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    autoComplete="address-level2"
                  />
                </label>
                <label>
                  Estado
                  <select
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    autoComplete="address-level1"
                  >
                    <option value="">UF</option>
                    {BRAZILIAN_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {error && <p className="warn">{error}</p>}
            <div className="checkout-actions">
              <button className="btn dark" type="submit" disabled={shownCepStatus === 'loading'}>
                Continuar
              </button>
              <button className="btn ghost" type="button" onClick={() => setStep('phone')}>
                Voltar
              </button>
            </div>
          </form>
        )}

        {step === 'payment' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirm()
            }}
          >
            <div className="pay-grid">
              {PAYMENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pay-option ${payment === item.id ? 'selected' : ''}`}
                  onClick={() => {
                    setPayment(item.id)
                    if (item.id !== 'cash') {
                      setNeedsChange(false)
                      setChangeText('')
                    }
                  }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>

            {payment === 'cash' && (
              <div className="change-box">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={needsChange}
                    onChange={(e) => setNeedsChange(e.target.checked)}
                  />
                  Preciso de troco
                </label>
                {needsChange && (
                  <label>
                    Troco para quanto?
                    <input
                      value={changeText}
                      onChange={(e) => setChangeText(e.target.value)}
                      inputMode="decimal"
                      placeholder={reaisInput(totals.total)}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="totals">
              <div className="grand">
                <span>Total</span>
                <span>{formatBRL(totals.total)}</span>
              </div>
            </div>
            {error && <p className="warn">{error}</p>}
            <div className="checkout-actions">
              <button className="btn dark" type="submit" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Confirmar pedido'}
              </button>
              <button className="btn ghost" type="button" onClick={() => setStep('address')}>
                Voltar
              </button>
            </div>
          </form>
        )}

        {step === 'done' && order && (
          <div>
            <p className="welcome">Recebemos o seu pedido. Guarde o telefone para as próximas compras.</p>
            <div className="order-summary">
              <p>
                <strong>Telefone</strong>
                <br />
                {formatPhone(order.phone)}
              </p>
              <p>
                <strong>Entrega</strong>
                <br />
                {formatAddress(order.address)}
              </p>
              <p>
                <strong>Pagamento</strong>
                <br />
                {PAYMENTS.find((item) => item.id === order.paymentMethod)?.label}
                {order.paymentMethod === 'cash' &&
                  (order.changeFor
                    ? ` · troco para ${formatBRL(order.changeFor)}`
                    : ' · sem troco')}
              </p>
              <p>
                <strong>Total</strong>
                <br />
                {formatBRL(order.total)}
              </p>
            </div>
            <button className="btn dark" type="button" onClick={close}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function CartLines({ onClear }: { onClear: () => void }) {
  const { data, setQty, setNote } = useStore()
  const totals = cartTotals(data)

  if (totals.items === 0) {
    return <p className="empty">Seu carrinho está vazio. Escolha um item do cardápio.</p>
  }

  return (
    <>
      {data.cart.map((line) => {
        const product = data.products.find((item) => item.id === line.productId)
        if (!product) return null
        return (
          <div className="cart-line" key={line.productId}>
            <div>
              <strong>{product.name}</strong>
              <div>
                <small>
                  {line.qty} × {formatBRL(product.price)}
                </small>
              </div>
              <input
                className="note-input"
                placeholder="Observação (ex.: sem cebola)"
                value={line.note}
                onChange={(e) => setNote(line.productId, e.target.value)}
              />
            </div>
            <div>
              <QtyMini
                qty={line.qty}
                onAdd={() => setQty(line.productId, line.qty + 1)}
                onDec={() => setQty(line.productId, line.qty - 1)}
              />
              <div className="price">{formatBRL(product.price * line.qty)}</div>
            </div>
          </div>
        )
      })}
      <div className="totals">
        <div>
          <span>Subtotal</span>
          <span>{formatBRL(totals.subtotal)}</span>
        </div>
        <div>
          <span>Entrega</span>
          <span>{formatBRL(totals.delivery)}</span>
        </div>
        <div className="grand">
          <span>Total</span>
          <span>{formatBRL(totals.total)}</span>
        </div>
      </div>
      {totals.belowMin && (
        <p className="warn">
          Pedido mínimo: {formatBRL(data.settings.minOrder)}. Faltam {formatBRL(totals.missing)}.
        </p>
      )}
      <button className="btn ghost" type="button" style={{ marginTop: 12 }} onClick={onClear}>
        Limpar carrinho
      </button>
    </>
  )
}

function QtyMini({
  qty,
  onAdd,
  onDec,
}: {
  qty: number
  onAdd: () => void
  onDec: () => void
}) {
  return (
    <div className="qty">
      <button type="button" onClick={onDec} aria-label="Diminuir">
        −
      </button>
      <span>{qty}</span>
      <button type="button" onClick={onAdd} aria-label="Aumentar">
        +
      </button>
    </div>
  )
}

export function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const { data, clearCart } = useStore()
  const totals = cartTotals(data)
  return (
    <div className="cart-panel">
      <h2>Carrinho</h2>
      <CartLines onClear={clearCart} />
      {totals.items > 0 && (
        <div className="checkout-actions">
          <button
            className="btn dark"
            type="button"
            disabled={totals.belowMin || !data.settings.open}
            onClick={onCheckout}
          >
            Finalizar pedido
          </button>
        </div>
      )}
    </div>
  )
}
