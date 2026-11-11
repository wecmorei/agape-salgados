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
- Ponto: `/ponto`

## Ponto

Entrada, saída e intervalo ficam neste navegador. O intervalo não conta como hora trabalhada.

O salário do mês é R$ 8.500,00. A carga horária começa em 220 h e pode ser alterada na tela.

```
valor a receber = horas trabalhadas × (8500 / carga horária mensal)
```

Exemplo: 110 h com carga de 220 h dão R$ 4.250,00.

## Painel

- Fila de pedidos (preparo e entrega)
- Incluir, editar e pausar itens
- Organizar categorias
- Nome da loja, taxa de entrega, pedido mínimo e PIN
