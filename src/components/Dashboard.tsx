import { useMemo, useState } from 'react'
import { formatBRL } from '../seed'
import { useStore } from '../store'
import type { Product } from '../types'

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export function Dashboard() {
  const { data } = useStore()
  const [scope, setScope] = useState<'month' | 'all'>('month')
  const [month, setMonth] = useState(currentMonth())

  const orders = useMemo(() => {
    if (scope === 'all') return data.orders
    return data.orders.filter((order) => monthKey(order.createdAt) === month)
  }, [data.orders, scope, month])

  const productById = useMemo(() => {
    const map = new Map<string, Product>()
    data.products.forEach((product) => map.set(product.id, product))
    return map
  }, [data.products])

  const stats = useMemo(() => {
    let faturamento = 0
    let produtos = 0
    let entrega = 0
    let custo = 0
    let itens = 0
    let entregues = 0
    let andamento = 0
    const perProduct = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()

    for (const order of orders) {
      faturamento += order.total
      produtos += order.subtotal
      entrega += order.delivery
      if (order.status === 'done') entregues += 1
      else andamento += 1
      for (const line of order.items) {
        const product = productById.get(line.productId)
        const price = product?.price ?? 0
        const unitCost = product?.cost ?? 0
        itens += line.qty
        custo += unitCost * line.qty
        const agg = perProduct.get(line.productId) ?? {
          name: product?.name ?? 'Item removido',
          qty: 0,
          revenue: 0,
          profit: 0,
        }
        agg.qty += line.qty
        agg.revenue += price * line.qty
        agg.profit += (price - unitCost) * line.qty
        perProduct.set(line.productId, agg)
      }
    }

    const lucro = produtos - custo
    const margem = produtos > 0 ? (lucro / produtos) * 100 : 0
    const ticket = orders.length > 0 ? faturamento / orders.length : 0
    const top = [...perProduct.values()].sort((a, b) => b.revenue - a.revenue)

    return {
      faturamento,
      produtos,
      entrega,
      custo,
      lucro,
      margem,
      ticket,
      itens,
      pedidos: orders.length,
      entregues,
      andamento,
      top,
    }
  }, [orders, productById])

  const faltaCusto = useMemo(() => {
    const ids = new Set<string>()
    orders.forEach((order) => order.items.forEach((line) => ids.add(line.productId)))
    return [...ids].some((id) => (productById.get(id)?.cost ?? 0) === 0)
  }, [orders, productById])

  return (
    <div className="dashboard">
      <div className="dash-controls">
        <div className="dash-scope">
          <button
            className={`chip ${scope === 'month' ? 'active' : ''}`}
            type="button"
            onClick={() => setScope('month')}
          >
            Por mês
          </button>
          <button
            className={`chip ${scope === 'all' ? 'active' : ''}`}
            type="button"
            onClick={() => setScope('all')}
          >
            Tudo
          </button>
        </div>
        {scope === 'month' && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mês"
          />
        )}
      </div>
      <p className="dash-period">{scope === 'all' ? 'Todo o período' : monthLabel(month)}</p>

      <div className="dash-kpis">
        <div className="kpi accent">
          <span>Faturamento</span>
          <strong>{formatBRL(stats.faturamento)}</strong>
          <small>{stats.pedidos} pedido(s)</small>
        </div>
        <div className="kpi">
          <span>Vendas de produtos</span>
          <strong>{formatBRL(stats.produtos)}</strong>
          <small>entrega: {formatBRL(stats.entrega)}</small>
        </div>
        <div className="kpi">
          <span>Custo dos produtos</span>
          <strong>{formatBRL(stats.custo)}</strong>
          <small>{stats.itens} itens vendidos</small>
        </div>
        <div className="kpi ok">
          <span>Lucro (produtos − custo)</span>
          <strong>{formatBRL(stats.lucro)}</strong>
          <small>margem {stats.margem.toFixed(0)}%</small>
        </div>
        <div className="kpi">
          <span>Ticket médio</span>
          <strong>{formatBRL(stats.ticket)}</strong>
        </div>
        <div className="kpi">
          <span>Pedidos</span>
          <strong>{stats.pedidos}</strong>
          <small>
            {stats.andamento} em andamento · {stats.entregues} entregues
          </small>
        </div>
      </div>

      {faltaCusto && (
        <p className="field-hint">
          Defina o <strong>custo</strong> dos produtos na aba Produtos para o lucro sair certinho.
        </p>
      )}

      <h3 className="my-orders-title">Produtos mais vendidos</h3>
      {stats.top.length === 0 ? (
        <p className="empty">Sem vendas neste período.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Receita</th>
              <th>Lucro</th>
            </tr>
          </thead>
          <tbody>
            {stats.top.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>{item.qty}</td>
                <td>{formatBRL(item.revenue)}</td>
                <td>{formatBRL(item.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
