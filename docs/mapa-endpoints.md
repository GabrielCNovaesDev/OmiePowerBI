# Mapa de endpoints — Omie API (MVP financeiro)

Documento gerado a partir da documentação oficial enviada. Referência para agentes de **teste**, **sync** e **dashboard**.

**Autenticação (todos os endpoints):** POST JSON para a URI do serviço com corpo:

```json
{
  "call": "NomeDoMetodo",
  "param": [{ ... }],
  "app_key": "<OMIE_APP_KEY>",
  "app_secret": "<OMIE_APP_SECRET>"
}
```

Credenciais no `.env`. Nunca expor no front-end.

**Datas:** formato `DD/MM/AAAA` salvo onde a doc indicar outro formato.

**Paginação:** respeitar `pagina`/`nPagina` + `registros_por_pagina`/`nRegPorPagina` até esgotar páginas.

---

## Índice de links

| # | Serviço Omie | URL |
|---|--------------|-----|
| 1 | LancamentoContaReceber | https://app.omie.com.br/api/v1/financas/contareceber/ |
| 2 | LancamentoContaPagar | https://app.omie.com.br/api/v1/financas/contapagar/ |
| 3 | ContaCorrenteCadastro | https://app.omie.com.br/api/v1/geral/contacorrente/ |
| 4 | ExtratoContaCorrente | https://app.omie.com.br/api/v1/financas/extrato/ |
| 5 | MovimentosFinanceiros | https://app.omie.com.br/api/v1/financas/mf/ |
| 6 | ResumoFinancas | https://app.omie.com.br/api/v1/financas/resumo/ |
| 7 | OrcamentoCaixa | https://app.omie.com.br/api/v1/financas/caixa/ |
| 8 | ClientesCadastro | https://app.omie.com.br/api/v1/geral/clientes/ |
| 9 | CategoriasCadastro | https://app.omie.com.br/api/v1/geral/categorias/ |
| 10 | EmpresasCadastro | https://app.omie.com.br/api/v1/geral/empresas/ |
| 11 | DepartamentosCadastro | https://app.omie.com.br/api/v1/geral/departamentos/ |
| 12 | Parcelas | https://app.omie.com.br/api/v1/geral/parcelas/ |
| 13 | DreCadastro | https://app.omie.com.br/api/v1/geral/dre/ |
| 14 | TiposDocumentoCadastro | https://app.omie.com.br/api/v1/geral/tiposdoc/ |
| 15 | OrigemLancamento | https://app.omie.com.br/api/v1/geral/origemlancamento/ |
| 16 | BancosCadastro | https://app.omie.com.br/api/v1/geral/bancos/ |
| 17 | ContaCorrenteLancamentos | https://app.omie.com.br/api/v1/financas/contacorrentelancamentos/ |
| 18 | PesquisarTitulos | https://app.omie.com.br/api/v1/financas/pesquisartitulos/ |
| 19 | TipoCCCadastro | https://app.omie.com.br/api/v1/geral/tipocc/ |

---

## Decisão de arquitetura (resumo)

| Papel no MVP | Endpoint principal | Método |
|--------------|-------------------|--------|
| **Títulos AR/AP + baixas + status** | [PesquisarTitulos](https://app.omie.com.br/api/v1/financas/pesquisartitulos/) | `PesquisarLancamentos` |
| **Movimentação unificada (alternativa/ complemento)** | [MovimentosFinanceiros](https://app.omie.com.br/api/v1/financas/mf/) | `ListarMovimentos` |
| **Carga incremental por alteração** | contareceber + contapagar | `ListarContasReceber` / `ListarContasPagar` |
| **Home + reconciliação** | [ResumoFinancas](https://app.omie.com.br/api/v1/financas/resumo/) | `ObterResumoFinancas` |
| **Saldo e extrato por conta** | [ExtratoContaCorrente](https://app.omie.com.br/api/v1/financas/extrato/) | `ListarExtrato` |
| **Previsto × realizado por categoria** | [OrcamentoCaixa](https://app.omie.com.br/api/v1/financas/caixa/) | `ListarOrcamentos` |
| **Dimensões (cadastros)** | clientes, categorias, contacorrente, etc. | métodos `Listar*` |

### Redundâncias — o que **não** priorizar no sync

| Endpoint | Veredito |
|----------|----------|
| **ContaCorrenteLancamentos** (#17) | **Backup.** Sobrepõe `ListarMovimentos` (`cTpLancamento=CC*`) e `ListarExtrato`. Só usar se faltar campo. |
| **ListarContasReceber + ListarContasPagar** | **Incremental.** Manter para delta por `filtrar_apenas_alteracao`; carga inicial pode ir só em `PesquisarLancamentos`. |
| **TipoCCCadastro** (#19) | **Opcional.** `ListarExtrato` e `ListarContasCorrentes` já trazem `cCodTipo` / `tipo_conta_corrente`. |
| **TiposDocumento** (#14) | **Parcial.** Não há `Listar*` — só consulta por código. Derivar códigos dos títulos ou cachear sob demanda. |

---

## Análise endpoint a endpoint

---

### 1. Contas a Receber — `LancamentoContaReceber`

**URL:** https://app.omie.com.br/api/v1/financas/contareceber/

**Método BI:** `ListarContasReceber`  
**Escrita (fora do BI):** Incluir, Alterar, Excluir, LancarRecebimento, CancelarRecebimento, Conciliar…

**Request (`lcrListarRequest`):** paginação + filtros úteis:
- `filtrar_por_emissao_de/ate`, `filtrar_por_registro_de/ate`
- `filtrar_por_data_de/ate` + `filtrar_apenas_inclusao|alteracao` → **sync incremental**
- `filtrar_apenas_titulos_em_aberto`, `filtrar_por_status`, `filtrar_cliente`, `filtrar_conta_corrente`

**Response:** array `conta_receber_cadastro` — campos-chave:

| Campo | Uso no BI |
|-------|-----------|
| `codigo_lancamento_omie` | PK do título |
| `codigo_cliente_fornecedor` | FK → clientes |
| `data_vencimento`, `data_previsao`, `data_emissao` | Aging, fluxo projetado |
| `valor_documento` | Valor do título |
| `codigo_categoria`, `categorias[]` | Rateio receita |
| `id_conta_corrente` | Conta de liquidação |
| `status_titulo` | Aberto / recebido / atrasado… |
| `id_origem` | Pedido, NF, manual… |
| `distribuicao[]` | Departamento |
| `numero_documento`, `numero_documento_fiscal` | Drill-through |

**Telas:** A receber, aging, ranking clientes, home (vencidos).

**Sync:** incremental diário/horário com `filtrar_apenas_alteracao`. Carga inicial: preferir `PesquisarLancamentos` (traz baixas no mesmo pacote).

---

### 2. Contas a Pagar — `LancamentoContaPagar`

**URL:** https://app.omie.com.br/api/v1/financas/contapagar/

**Método BI:** `ListarContasPagar`  
Espelho do AR; filtros equivalentes em `lcpListarRequest` (`filtrar_por_status`: CANCELADO, PAGO, LIQUIDADO, EMABERTO, ATRASADO…).

**Campos extras:** `valor_pag` (valor a pagar em consulta), `data_entrada`, CNAB/PIX em `cnab_integracao_bancaria`.

**Telas:** A pagar, aging fornecedores, home.

**Sync:** mesma estratégia do AR.

---

### 3. Contas Correntes — `ContaCorrenteCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/contacorrente/

**Métodos BI:**
- `ListarContasCorrentes` — cadastro completo
- `ListarResumoContasCorrentes` — versão resumida (preferir se trouxer saldo)

**Campos esperados:** `nCodCC`, `descricao`, `codigo_banco`, `tipo_conta_corrente`, saldos, flags fluxo de caixa.

**Telas:** Extrato/contas, filtro global de conta, home (saldo total).

**Sync:** dimensão; refresh 1×/dia ou após mudança. Uma linha por conta × `app_key`.

---

### 4. Extrato — `ExtratoContaCorrente`

**URL:** https://app.omie.com.br/api/v1/financas/extrato/

**Método BI:** `ListarExtrato`

**Request:** `nCodCC`, `dPeriodoInicial`, `dPeriodoFinal`, `cExibirApenasSaldo` (só saldos).

**Response — ouro para caixa:**
- Saldos: `nSaldoAnterior`, `nSaldoAtual`, `nSaldoAtualPrevisto`, `nSaldoConciliado`, `nSaldoDisponivel`, `nLimiteCreditoTotal`
- `listaMovimentos[]`: lançamento, cliente, categoria, natureza, conciliação, saldo running

**Telas:** Extrato, saldo por banco, conciliação leve (data conciliação).

**Sync:** por conta × janela de período (ex.: mês a mês nos últimos 12 meses). Job separado do sync de títulos.

**Nota:** exige loop em todas as contas de `ListarContasCorrentes`.

---

### 5. Movimentos Financeiros — `MovimentosFinanceiros`

**URL:** https://app.omie.com.br/api/v1/financas/mf/

**Método BI:** `ListarMovimentos` — **API mais completa** para fatos financeiros.

**Filtro estrela:** `cTpLancamento`:
- `CR` / `CP` / `CPCR` — títulos
- `BX`, `BXCR`, `BXCP` — baixas
- `CC`, `CCE`, `CCS`, `CCT` — conta corrente
- `PV`, `POS`, `PPV` — previsões (contrato/OS/pedido)

**Response `movimentos[]`:** `detalhes` (título/movimento) + `resumo` (`cLiquidado`, `nValPago`, `nValAberto`, juros/desconto) + rateio `departamentos` / `categorias`.

**Status possíveis:** CANCELADO, RECEBIDO, PAGO, VENCEHOJE, AVENCER, ATRASADO, EMABERTO, PAGTOPARCIAL.

**Telas:** Fluxo de caixa realizado, DRE por categoria, tudo que precisa baixa + título junto.

**Sync:** carga inicial ampla (`cTpLancamento=CPCR` + filtros de vencimento). Incremental: `dDtAltDe`/`dDtIncDe`.

**Relação com #18:** overlap alto. Escolher **um** como fonte primária de fatos; recomendamos `PesquisarLancamentos` (estrutura título + lançamentos + resumo mais explícita).

---

### 6. Resumo — `ResumoFinancas`

**URL:** https://app.omie.com.br/api/v1/financas/resumo/

**Métodos BI:**

| Método | Uso |
|--------|-----|
| `ObterResumoFinancas` | **Home** — KPIs prontos |
| `ObterListaEmAberto` | Lista abertos por dia (P/R) |
| `ObterListaFinancas` | Detalhe por categoria/dia |
| `ObterDetalhesLancamento` | Drill-through por `nIdTitulo` |

**`ObterResumoFinancas` request:** `dDia`, `lApenasResumo`, `lExibirCategoria`

**Response:**
- `contaCorrente.vTotal`, `vLimiteCredito`
- `contaReceber` / `contaPagar`: `nTotal`, `vTotal`, `vAtraso`
- `contaReceberCategoria[]`, `contaPagarCategoria[]`
- `contaReceberAtraso[]`, `contaPagarAtraso[]` (com `nDiasAtraso`)
- `fluxoCaixa`: `vPagar`, `vReceber`, `vSaldo`

**Telas:** Home executiva, validação de sync (**totais do BI = totais Omie**).

**Sync:** snapshot diário em tabela `resumo_financeiro_snapshot` — não substitui fatos; serve para KPI rápido e alarme de divergência.

---

### 7. Orçamento de Caixa — `OrcamentoCaixa`

**URL:** https://app.omie.com.br/api/v1/financas/caixa/

**Método BI:** `ListarOrcamentos` — `nAno`, `nMes`

**Response:** `ListaOrcamentos[]`: `cCodCateg`, `cDesCateg`, `nValorPrevisto`, `nValorRealilzado` (typo na doc Omie)

**Telas:** Fluxo de caixa — coluna previsto × realizado por categoria.

**Sync:** 1 chamada por mês (loop 12 meses no bootstrap). Baixa frequência.

---

### 8. Clientes / Fornecedores — `ClientesCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/clientes/

**Métodos BI:** `ListarClientes` ou `ListarClientesResumido` (menor payload)

**Campos:** `codigo_cliente_omie`, `razao_social`, `nome_fantasia`, `cnpj_cpf`, tags cliente/fornecedor, cidade, inativo…

**Telas:** Rankings AR/AP, filtros, drill-through.

**Sync:** dimensão; paginar tudo. Atualizar quem apareceu em títulos novos.

---

### 9. Categorias — `CategoriasCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/categorias/

**Método BI:** `ListarCategorias`

**Campos críticos:** `codigo`, `descricao`, `conta_receita`, `conta_despesa`, `codigo_dre`, `totalizadora`, `conta_inativa`, `categoria_superior`

**Telas:** Fluxo por categoria, DRE gerencial, orçamento.

**Sync:** dimensão; refresh diário. Código `1.x` = receita, `2.x` = despesa (regra Omie).

---

### 10. Empresas — `EmpresasCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/empresas/

**Método BI:** `ListarEmpresas` / `ConsultarEmpresa`

**Campos:** `codigo_empresa`, `cnpj`, `razao_social`, `nome_fantasia`, flags fiscais…

**Telas:** Cabeçalho do BI, multi-empresa futura.

**Sync:** poucos registros; 1× na conexão do `app_key`.

---

### 11. Departamentos — `DepartamentosCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/departamentos/

**Método BI:** `ListarDepartamentos`

**Campos:** `codigo`, `descricao`, `inativo`, `nivel_totalizador`

**Telas:** Filtro opcional; rateio em títulos.

**Sync:** dimensão pequena.

---

### 12. Parcelas — `Parcelas`

**URL:** https://app.omie.com.br/api/v1/geral/parcelas/

**Método BI:** `ListarParcelas`

**Campos:** `nCodigo`, `cDescricao`, `nParcelas`

**Telas:** Detalhe do título (condição de pagamento).

**Sync:** dimensão; baixa prioridade.

---

### 13. Contas DRE — `DreCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/dre/

**Método BI:** `ListarCadastroDRE` — `apenasContasAtivas`

**Campos:** `codigoDRE`, `descricaoDRE`, `nivelDRE`, `sinalDRE`, `totalizaDRE`

**Telas:** DRE gerencial (via join categoria → `codigo_dre`).

**Sync:** dimensão; 1×/semana.

---

### 14. Tipos de Documento — `TiposDocumentoCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/tiposdoc/

**Métodos:** `ConsultarTipoDocumento`, `PesquisarTipoDocumento` — **sem listagem paginada**.

**Códigos comuns nos títulos:** BOL, PIX, DIN, TED, TRA, CRT, CHQ…

**Telas:** Filtro “forma de pagamento”.

**Sync:** cache `{ codigo → descricao }` montado a partir dos `cTipo` distintos nos títulos + consultas pontuais.

---

### 15. Origem do Lançamento — `OrigemLancamento`

**URL:** https://app.omie.com.br/api/v1/geral/origemlancamento/

**Método BI:** `ListarOrigem`

**Campos:** `codigo` (4 chars), `descricao` — ex.: NFER, VENR, MANP, OFXR…

**Telas:** Coluna “origem” no detalhe; qualidade (manual vs NF).

**Sync:** dimensão pequena; lista completa 1×.

---

### 16. Bancos — `BancosCadastro`

**URL:** https://app.omie.com.br/api/v1/geral/bancos/

**Método BI:** `ListarBancos`

**Campos:** `codigo`, `nome`, `tipo`, flags integração CNAB/PIX…

**Telas:** Nome do banco na conta corrente.

**Sync:** dimensão; paginar 100/página.

---

### 17. CC Lançamentos — `ContaCorrenteLancamentos` ⚠️ backup

**URL:** https://app.omie.com.br/api/v1/financas/contacorrentelancamentos/

**Método BI:** `ListarLancCC`

Lançamentos manuais/transferências no CC com `cabecalho`, `detalhes`, `departamentos`.

**Veredito:** redundante com **#5** (`cTpLancamento=CC*`) e **#4** (`listaMovimentos`). **Não implementar no MVP** salvo gap em teste.

---

### 18. Pesquisar Títulos — `PesquisarTitulos` ⭐ fonte primária de títulos

**URL:** https://app.omie.com.br/api/v1/financas/pesquisartitulos/

**Método BI:** `PesquisarLancamentos`

**Filtros ricos:** vencimento, pagamento, previsão, emissão, registro, status, natureza (P/R), cliente, CC, categoria, cancelamento, `lDadosCad`.

**Response `titulosEncontrados[]`:**
- `cabecTitulo` — cabeçalho completo + `cStatus` + `departamentos`
- `lancamentos[]` — **baixas** (data, valor, juros, desconto, CC)
- `resumo` — `cLiquidado`, `nValPago`, `nValAberto`

**Telas:** AR, AP, aging, fluxo realizado, detalhe com histórico de baixa.

**Sync:** **endpoint principal** para `fato_titulo` e `fato_baixa`. Incremental: `dDtAltDe`/`dDtIncDe`.

---

### 19. Tipos de Conta Corrente — `TipoCCCadastro` ⚠️ opcional

**URL:** https://app.omie.com.br/api/v1/geral/tipocc/

**Método BI:** `ListarTiposCC` — poucos registros (`cCodigo`, `cDescricao`)

**Veredito:** **opcional** — tipos já vêm em extrato/conta corrente. Incluir se quiser tabela dimensão limpa.

---

## Mapa endpoint → tabela → tela

| Endpoint | Tabela(s) sugerida | Tela(s) MVP |
|----------|-------------------|-------------|
| PesquisarLancamentos | `fato_titulo`, `fato_baixa` | AR, AP, fluxo |
| ListarContasReceber/Pagar | staging incremental | sync delta |
| ListarMovimentos | `fato_movimento` (alt.) | fluxo, DRE |
| ObterResumoFinancas | `snapshot_resumo` | Home, QA sync |
| ListarExtrato | `fato_extrato`, `snapshot_saldo_cc` | Extrato, contas |
| ListarOrcamentos | `fato_orcamento_caixa` | Fluxo previsto |
| ListarContasCorrentes | `dim_conta_corrente` | Filtros, home |
| ListarClientes | `dim_cliente` | Rankings |
| ListarCategorias | `dim_categoria` | Fluxo, DRE |
| ListarCadastroDRE | `dim_dre` | DRE |
| ListarDepartamentos | `dim_departamento` | Filtros |
| ListarOrigem | `dim_origem` | Detalhe |
| ListarBancos | `dim_banco` | Contas |
| ListarEmpresas | `dim_empresa` | Header |
| ListarParcelas | `dim_parcela` | Detalhe |

---

## Ordem de sync recomendada (agentes)

```
1. dim_empresa          ← ListarEmpresas
2. dim_banco            ← ListarBancos
3. dim_conta_corrente   ← ListarContasCorrentes
4. dim_categoria        ← ListarCategorias
5. dim_dre              ← ListarCadastroDRE
6. dim_departamento     ← ListarDepartamentos
7. dim_origem           ← ListarOrigem
8. dim_parcela          ← ListarParcelas
9. dim_cliente          ← ListarClientes (full)
10. fato_titulo/baixa   ← PesquisarLancamentos (full histórico, paginar)
11. fato_extrato        ← ListarExtrato (por CC × mês)
12. fato_orcamento      ← ListarOrcamentos (12 meses)
13. snapshot_resumo     ← ObterResumoFinancas (hoje)
```

**Incremental (job horário):** passos 9–13 com filtros de alteração; passo 10 também via `ListarContasReceber/Pagar` se `PesquisarLancamentos` for pesado.

**Reconciliação:** comparar `ObterResumoFinancas.contaReceber.vTotal` vs `SUM(fato_titulo WHERE natureza=R AND aberto)`; idem AP e saldo CC.

---

## Instruções para agentes

### Agente de testes API

Para cada endpoint acima:
1. Chamar método de listagem com `pagina=1`, `registros_por_pagina=10`.
2. Validar HTTP 200, ausência de `omie_fail`, campos obrigatórios preenchidos.
3. Paginar até `total_de_paginas`; medir tempo e volume.
4. Testar filtro de data (1 mês) vs full load.
5. Guardar 1 JSON de exemplo em `tests/fixtures/omie/<servico>.json`.
6. Rodar reconciliação Resumo × PesquisarTitulos.

### Agente de ETL / banco

1. Postgres via `DATABASE_URL` no `.env`.
2. Staging: JSON bruto + `app_key` + `synced_at`.
3. Upsert por PK Omie (`codigo_lancamento_omie`, `nCodTitulo`, `nCodCC`…).
4. Log em `sync_log` (endpoint, método, página, registros, erro, duração).
5. Nunca gravar `app_secret` em claro na base — usar `ENCRYPTION_KEY` quando multi-cliente.

### Agente de dashboard

Prioridade de telas (ver `docs/mvp-financeiro.md`):
1. Home ← `ObterResumoFinancas` + snapshots
2. A receber / A pagar ← `fato_titulo` + `dim_cliente`
3. Fluxo ← baixas + títulos abertos + orçamento
4. Extrato ← `fato_extrato`
5. Sync/QA ← `sync_log` + reconciliação

---

## Endpoints extras (não pedidos ainda)

Só solicitar se teste mostrar lacuna:

| Necessidade | Endpoint Omie |
|-------------|---------------|
| Projeto no título (`codigo_projeto`) | `/api/v1/geral/projetos/` |
| Vendedor | `/api/v1/geral/vendedores/` |
| Tipo categoria (complemento) | `/api/v1/geral/tipocategoria/` |
| Listagem completa tipos documento | confirmar se `PesquisarTipoDocumento` com codigo vazio retorna tudo |

---

## Changelog

| Data | Nota |
|------|------|
| 2026-03-03 | Análise inicial dos 19 links do MVP financeiro |
