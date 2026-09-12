# Ágape Salgados — cardápio online

Cardápio de delivery com carrinho, checkout e painel da cozinha.

Os pedidos e o cardápio ficam no Supabase (tempo real entre o celular do cliente e o painel). O carrinho fica só neste navegador.

## Como abrir localmente

Copie `.env.example` para `.env.local` e preencha a URL e a chave anônima do projeto.

```bash
npm install
npm run dev
```

- Cardápio: página inicial
- Painel: `/admin` (PIN inicial `1234`)

## Painel

- Fila de pedidos (preparo e entrega)
- Incluir, editar e pausar itens
- Organizar categorias
- Nome da loja, taxa de entrega, pedido mínimo e PIN
