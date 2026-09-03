# MVP financeiro

Recorte da v1: só o que a diretoria abre todo dia — **caixa, a receber, a pagar**. Vendas, estoque, fiscal e CRM ficam para depois.

Quando os links da API chegarem, cada endpoint da lista abaixo vira contrato + carga no banco + KPI na tela.

---

## Telas do MVP

1. **Home financeira** — saldo em contas, a receber aberto, a pagar aberto, vencidos, previsto de caixa nos próximos 7/30 dias.
2. **Contas a receber** — carteira, aging, ranking de clientes, detalhe do título.
3. **Contas a pagar** — obrigações, aging, ranking de fornecedores, detalhe do título.
4. **Fluxo de caixa** — realizado (baixas) + projetado (títulos abertos) por dia/mês e por categoria.
5. **Extrato / contas** — saldo por conta corrente e movimentos.
6. **Qualidade e sync** — última carga, erros, totais que não batem com o Resumo da Omie.

Filtros globais: período, conta corrente, categoria, cliente/fornecedor, status, departamento (se vier preenchido).

---

## Funcionalidades que entram

Vem de `docs/funcionalidades-bi.md`, só o núcleo:

| Área | Entra no MVP | Fica para depois |
|------|----------------|------------------|
| Home | KPIs de caixa, AR, AP, vencidos, tendência 12 meses | Semáforo multi-área, estoque, pedidos |
| A receber | Carteira, aging, ranking, status, origem do título | DSO sofisticado, concentração avançada |
| A pagar | Carteira, aging, ranking, categorias | DPO, fixas vs variáveis |
| Caixa | Realizado + projetado, saldo por conta, por categoria | Cenários otimista/pessimista |
| DRE | Quebra por categoria / conta DRE se o cadastro existir | DRE gerencial completa, metas |
| Conciliação | Não | Tela própria de conciliação |
| Metas / alertas | Alerta simples na home (vencido, saldo baixo) | Regras configuráveis, e-mail |
| Multi-empresa | Uma `app_key` no `.env` | Banco com N clientes Omie |
| Plataforma | Sync + Postgres + RLS depois | Self-service livre, PDF |

Inteligência de tempo no MVP: mês atual, mês anterior, YTD, últimos 12 meses. Sem forecast de ML.

---

## Endpoints que eu preciso agora

Manda o **link da documentação** de cada um (a página do método, não só o índice). Depois de ler, posso devolver algum se for duplicata.

### Obrigatórios (financeiro)

| # | Endpoint (como na Omie) | Por quê |
|---|-------------------------|---------|
| 1 | **Contas a Receber - Lançamentos** | Carteira, aging, home |
| 2 | **Contas a Pagar - Lançamentos** | Obrigações, aging, home |
| 3 | **Contas Correntes** | Saldos e nomes das contas |
| 4 | **Extrato de Conta Corrente** | Posição e movimento bancário |
| 5 | **Movimentos Financeiros** | Baixas, pagamentos, caixa realizado |
| 6 | **Resumo** | Conferir se nossos totais batem com a Omie |
| 7 | **Orçamento de Caixa** | Previsto × realizado sem inventar regra |

### Obrigatórios (cadastros que o financeiro usa)

| # | Endpoint | Por quê |
|---|----------|---------|
| 8 | **Clientes, Fornecedores, Transportadoras, etc** | Nome, CNPJ, quem deve / a quem pagamos |
| 9 | **Categorias** | Receita/despesa no caixa e nos títulos |
| 10 | **Empresas** | Identificar a empresa da `app_key` |
| 11 | **Departamentos** | Dimensão extra se estiver nos lançamentos |
| 12 | **Parcelas** | Condição de pagamento |
| 13 | **Contas do DRE** | Classificar resultado |
| 14 | **Tipos de Documento** | Boleto, NF, recibo, etc. |
| 15 | **Origem do títulos** | Pedido, NF, avulso |
| 16 | **Bancos** | Nome do banco da conta corrente |

### Quero o link para decidir (possível duplicata)

| # | Endpoint | Dúvida |
|---|----------|--------|
| 17 | **Pesquisar Títulos** | Pode ser atalho de AR+AP; se for, usamos ele e aliviamos 1 e 2 |
| 18 | **Contas Correntes - Lançamentos** | Pode repetir Extrato / Movimentos; só entro se tiver campo que os outros não têm |
| 19 | **Tipos de Contas Correntes** | Só se Contas Correntes não trouxer o tipo |

### Não preciso neste MVP

Não manda por enquanto:

- Contas a Receber - Boletos / PIX (operacional, não analítico)
- Tags, Clientes - Características, Projetos
- CNAE, Cidades, Países, Tipos de Atividade
- Anexos, Tipo de Entrega, Tipo de Assinante, Tarefas
- Finalidade de Transferência, Bandeiras de Cartão

Se ao ler 1–19 faltar campo (ex.: projeto no título, tag no cliente), eu peço o link extra.

---

## Banco de dados (já na arquitetura do MVP)

Objetivo: **puxar a Omie uma vez (e depois só o delta)** e o BI ler do nosso banco — inclusive quando houver vários clientes/aplicativos.

Modelo mínimo:

- `empresas` — um registro por aplicativo Omie (`app_key`, `app_secret` criptografado, apelido).
- Tabelas **staging** — JSON/campos crus de cada endpoint, com `app_key` e data da carga.
- Tabelas **analíticas** — fatos (títulos, movimentos, extrato) + dimensões (cliente, categoria, conta, departamento).
- `sync_log` — endpoint, página, status, registros, erro.

Credenciais da primeira empresa ficam no `.env`. Na fase multi-cliente, as chaves migram para `empresas` e o `.env` fica só com `DATABASE_URL` e chave de criptografia.

---

## Ordem depois dos links

1. ~~Você cola os 16–19 links.~~ ✅ Feito
2. ~~Eu leio método a método~~ ✅ Ver `docs/mapa-endpoints.md`
3. Sinalizo se ainda falta algum endpoint — ver seção "Endpoints extras" no mapa
4. **Próximo:** agentes teste → Postgres → telas do MVP
