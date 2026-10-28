# Backlog — endpoints Omie e DRE por competência

Pendências para depois. Hoje o ETL carrega só o módulo financeiro
(ver [mapa-endpoints.md](mapa-endpoints.md)).

## 1. DRE por competência (igual ao relatório DRE do Omie)

A tela DRE do BI continua em **regime de caixa** (baixas). O DRE do Omie é de
**competência**. Regras já identificadas na conferência da DI PRIMO (set/2026):

- Data do lançamento = data de emissão; sem emissão, data de registro
  (a maior parte das contas a pagar não tem emissão no Omie).
- Categorias sem vínculo de DRE (`dim.categoria.codigo_dre` nulo) ficam fora.
- Títulos cancelados entram só se já tiveram recebimento/pagamento.
- Lançamentos diretos em conta corrente (extrato sem baixa de título, exceto
  transferências) entram pela data do lançamento.
- "Descontos Obtidos" e "Juros Pagos" = desconto e juros das baixas de contas a
  pagar, pela data da baixa, com rateio, só categorias com DRE. (Simétrico no
  contas a receber: descontos concedidos e juros recebidos — ainda não visto com valor.)
- Rateio de categoria aplicado (`TITULO_RATEADO` / `EXTRATO_RATEADO`).
- Linhas **Impostos** e **Custo Médio (CMC) das Vendas** dependem dos módulos de
  NF-e e Estoque (item 2).

Sugestão de entrega: DRE com seletor caixa × competência e a mesma hierarquia do
Omie (Tipo → Grupo → Conta do DRE → Categoria).

## 2. Endpoints de outros módulos

Confirmar nomes de métodos e paginação na documentação oficial antes de implementar.

| Módulo | Para quê no BI | Endpoint (a confirmar) |
|---|---|---|
| NF-e emitidas (produtos) | Impostos da DRE, tela NFs, faturamento | `produtos/nfconsultar` |
| NFS-e (serviços) | Faturamento de serviços, ISS | `servicos/nfse` |
| Pedidos de venda | Vendas, carteira, ticket médio | `produtos/pedido` |
| Produtos | Cadastro para vendas/estoque | `geral/produtos` |
| Estoque — posição e CMC | Linha CMC da DRE, estoque | `estoque/consulta` |
| Estoque — movimentos | Entradas/saídas de estoque | `estoque/movestoque` |
| Pedidos de compra / NF de entrada | Compras, custos | `produtos/pedidocompra`, `produtos/recebimentonfe` |
| Contratos de serviço | Receita recorrente | `servicos/contrato` |
| Vendedores | Nome do vendedor (hoje só o código) | `geral/vendedores` |
| Projetos | Nome do projeto (hoje só o código) | `geral/projetos` |

Cada endpoint novo segue o padrão do ETL atual: mapper em `src/etl/mappers.js`,
tabela em `TABLES` (`src/etl/sql.js`, gravação em lote) e etapa em `APP_STEPS`
(`src/etl/sync.js`). Lembrar dos limites da Omie por App Key + método (alguns
métodos aceitam só 1 requisição por vez, como o `ListarExtrato`).
