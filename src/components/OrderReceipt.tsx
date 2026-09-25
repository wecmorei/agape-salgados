import { formatAddress, formatBRL, formatPhone, PAYMENT_LABELS } from '../seed'
import type { Order, Product } from '../types'

type OrderReceiptProps = {
  order: Order
  products: Product[]
  storeName: string
}

function formatReceiptWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OrderReceipt({ order, products, storeName }: OrderReceiptProps) {
  const totalItems = order.items.reduce((sum, line) => sum + line.qty, 0)

  return (
    <div className="receipt">
      <div className="receipt-head">
        <strong>{storeName}</strong>
        <span>Pedido #{order.id}</span>
        <span>{formatReceiptWhen(order.createdAt)}</span>
      </div>

      <div className="receipt-sep" />

      <table className="receipt-items">
        <thead>
          <tr>
            <th className="col-qty">Qtd</th>
            <th className="col-item">Item</th>
            <th className="col-value">Valor</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((line) => {
            const product = products.find((item) => item.id === line.productId)
            const name = product?.name ?? 'Item removido'
            const unit = product?.price ?? 0
            return (
              <tr key={`${order.id}-${line.productId}`}>
                <td className="col-qty">{line.qty}x</td>
                <td className="col-item">
                  {name}
                  {line.note ? <div className="receipt-note">Obs.: {line.note}</div> : null}
                  <div className="receipt-unit">{formatBRL(unit)} un.</div>
                </td>
                <td className="col-value">{formatBRL(unit * line.qty)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="receipt-sep" />

      <div className="receipt-line">
        <span>Itens ({totalItems})</span>
        <span>{formatBRL(order.subtotal)}</span>
      </div>
      <div className="receipt-line">
        <span>Entrega</span>
        <span>{formatBRL(order.delivery)}</span>
      </div>
      <div className="receipt-line total">
        <span>Total</span>
        <span>{formatBRL(order.total)}</span>
      </div>

      <div className="receipt-sep" />

      <div className="receipt-block">
        <strong>Cliente</strong>
        <span>{formatPhone(order.phone)}</span>
      </div>
      <div className="receipt-block">
        <strong>Entrega</strong>
        <span>{formatAddress(order.address)}</span>
      </div>
      <div className="receipt-block">
        <strong>Pagamento</strong>
        <span>
          {PAYMENT_LABELS[order.paymentMethod]}
          {order.paymentMethod === 'cash' && order.changeFor
            ? ` · troco para ${formatBRL(order.changeFor)}`
            : ''}
        </span>
      </div>

      <div className="receipt-foot">Obrigado pela preferência!</div>
    </div>
  )
}
