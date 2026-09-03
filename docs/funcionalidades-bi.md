# Funcionalidades do BI — Omie Power BI

Documento de visão das funcionalidades que o dashboard BI deve cobrir. Serve como backlog de produto para os agentes que vão testar a API e construir o sistema.

Escopo: dados do ERP Omie, atualizados automaticamente, com visualização estilo Business Intelligence (não apenas listagens operacionais).

---

## 1. Visão executiva

Painel único para donos, diretoria e gestores. Leitura em segundos, sem precisar entrar no Omie.

- **KPIs do dia / do mês**: faturamento, recebimentos, pagamentos, saldo previsto, ticket médio, pedidos em aberto, inadimplência.
- **Saúde do negócio**: semáforo (verde / amarelo / vermelho) por área — financeiro, vendas, estoque, fiscal.
- **Comparativos**: mês atual vs mês anterior, vs mesmo mês do ano passado, vs meta.
- **Tendência**: evolução de 12 meses das receitas, despesas, margem e caixa.
- **Alertas na home**: títulos vencidos, estoque crítico, notas pendentes, pedidos parados, conciliação quebrada.
- **Drill-down**: clicar no KPI e ir para o dashboard analítico da área.
- **Filtro global de empresa / período**: quando houver mais de uma empresa Omie (app_key).

---

## 2. Financeiro

Núcleo do BI. Omie é forte em contas a pagar, a receber e fluxo de caixa.

### 2.1 Contas a receber

- Carteira aberta por vencimento (a vencer, vencido, hoje).
- Aging de inadimplência (1–7, 8–15, 16–30, 31–60, 60+ dias).
- Ranking de clientes inadimplentes.
- Previsão de recebimento por dia / semana / mês.
- Taxa de inadimplência e DSO (prazo médio de recebimento).
- Origem do título (pedido, NF-e, contrato, lançamento avulso).
- Status Omie (aberto, liquidado, cancelado, parcial).
- Baixas: valor recebido vs valor original, desconto, juros, multa.
- Concentração de receita (top 10 / 20 clientes).

### 2.2 Contas a pagar

- Obrigações por vencimento e por categoria.
- Aging de pagamentos em atraso.
- Ranking de fornecedores por volume e por atraso.
- Previsão de desembolsos.
- DPO (prazo médio de pagamento).
- Contas fixas vs variáveis.
- Parcelas vs valor total do documento.
- Status e forma de pagamento (boleto, PIX, transferência).

### 2.3 Fluxo de caixa

- Caixa realizado (entradas e saídas liquidadas).
- Caixa projetado (a receber + a pagar + saldo de contas).
- Saldo por conta corrente / banco.
- Cenários: otimista, realista, pessimista (inadimplência e atraso).
- Quebra por categoria Omie (plano de contas / categorias financeiras).
- Ponto de caixa negativo projetado (quando o saldo vira vermelho).
- Comparativo orçado vs realizado (quando houver orçamento).

### 2.4 Conciliação bancária

- Contas conciliadas vs pendentes.
- Divergências (valor, data, duplicidade).
- Tempo médio até conciliar.
- Volume não conciliado por banco.

### 2.5 Resultado e DRE gerencial

- Receita bruta, deduções, receita líquida.
- CMV / CSP, lucro bruto, despesas operacionais, resultado.
- Margem bruta, operacional e líquida.
- Evolução mensal da DRE.
- Resultado por categoria, projeto, departamento ou centro de custo (se existir no Omie).
- Comparativo com período anterior e com meta.

---

## 3. Vendas e faturamento

### 3.1 Pedidos e orçamentos

- Funil: orçamento → pedido → faturado → recebido.
- Taxa de conversão orçamento → pedido.
- Pedidos em aberto, atrasados, cancelados, faturados parcialmente.
- Ticket médio, quantidade de itens, desconto médio.
- Tempo médio do pedido até o faturamento.
- Backlog de faturamento (valor ainda não faturado).

### 3.2 Faturamento

- Faturamento por dia, semana, mês, trimestre, ano.
- Faturamento por cliente, vendedor, categoria, produto, NCM, cidade/UF.
- Recorrência vs venda avulsa.
- Devoluções, cancelamentos e notas de crédito.
- Meta vs realizado por vendedor e por período.
- Mix de produtos (Pareto 80/20).

### 3.3 Clientes (visão comercial)

- Base ativa vs inativa (sem compra há X dias).
- Novos clientes no período.
- Churn comercial (clientes que pararam de comprar).
- LTV aproximado (faturamento histórico por cliente).
- Frequência de compra e intervalo médio.
- Concentração de carteira (risco de dependência).

---

## 4. Compras e fornecedores

- Pedidos de compra: abertos, recebidos, atrasados, cancelados.
- Lead time (pedido → recebimento).
- Custo total de compras por fornecedor, categoria e período.
- Variação de preço do mesmo item ao longo do tempo.
- Cumprimento de prazo do fornecedor.
- Contas a pagar vinculadas ao pedido.
- Comparativo compra vs necessidade de estoque.
- Concentração de compras (risco de fornecedor único).

---

## 5. Produtos, serviços e estoque

### 5.1 Produtos e serviços

- Catálogo: ativos, inativos, sem movimento.
- Curva ABC de faturamento e de margem.
- Preço de venda vs custo vs margem unitária.
- Itens sem preço, sem custo ou com cadastro incompleto.
- Serviços vs produtos (mix da operação).

### 5.2 Estoque

- Posição atual por produto, depósito e lote (se houver).
- Giro de estoque e cobertura em dias.
- Ruptura (zerado) e excesso (acima do máximo).
- Estoque mínimo / máximo vs posição real.
- Valor total imobilizado em estoque.
- Movimentações: entrada, saída, transferência, ajuste.
- Itens parados (sem saída há X dias).
- Custo médio e variação de custo.

---

## 6. Fiscal e documentos

- NF-e emitidas: quantidade, valor, status (autorizada, cancelada, denegada, pendente).
- NFS-e de serviços.
- NFC-e / cupom (se a operação usar).
- Pendências de autorização e rejeições.
- Impostos destacados (ICMS, IPI, PIS, COFINS, ISS) — visão gerencial, não substitui contador.
- Inutilizações e cancelamentos.
- Prazo médio de emissão após o pedido.
- Cruzamento pedido × nota × título financeiro (quebra de integração).

---

## 7. CRM e relacionamento

- Pipeline de oportunidades (se o Omie CRM estiver em uso).
- Conversão por etapa, origem e vendedor.
- Tempo em cada etapa.
- Previsão de fechamento (weighted pipeline).
- Atividades em atraso (tarefas, ligações, follow-ups).
- Origem do lead e CAC aproximado (se houver custo de aquisição).
- Clientes sem interação recente.

---

## 8. Contratos, recorrência e projetos

- Contratos ativos, a vencer, vencidos, cancelados.
- Receita recorrente (MRR / ARR) quando a operação for recorrente.
- Reajustes, aditivos e inadimplência de contrato.
- Projetos: receita, custo, margem e % de conclusão.
- Horas / serviços lançados vs contratado (se aplicável).

---

## 9. Expedição e logística (se a operação usar)

- Pedidos liberados vs expedidos vs entregues.
- Atraso de entrega.
- Transportadora: volume, prazo, custo.
- Frete pago vs cobrado.
- Devoluções logísticas.

---

## 10. Cadastros e qualidade da base

O BI só é confiável se o cadastro estiver limpo. Incluir um painel de qualidade de dados.

- Clientes / fornecedores sem CNPJ/CPF, sem e-mail, sem cidade.
- Duplicidade de cadastro.
- Produtos sem NCM, sem unidade, sem categoria.
- Categorias financeiras sem classificação (receita/despesa).
- Lançamentos sem categoria ou sem conta corrente.
- Pedidos sem vendedor ou sem etapa.
- Divergência de totais (pedido ≠ NF ≠ título).
- Volume de registros por endpoint (para monitorar sync).

---

## 11. Multi-empresa e consolidação

- Seletor de empresa Omie (uma app_key por vez).
- Visão consolidada de todas as empresas (somando KPIs compatíveis).
- Comparativo entre empresas (filiais / CNPJs).
- Moeda e fuso padrão (BRL, America/Sao_Paulo).
- Tags de empresa no modelo de dados para não misturar bases.

---

## 12. Inteligência de tempo (obrigatório em BI)

Todo indicador numérico precisa existir em pelo menos estas visões:

- Hoje, ontem, semana atual, mês atual, trimestre, ano.
- MTD, QTD, YTD.
- MoM, QoQ, YoY (absoluto e %).
- Média móvel 7 / 30 / 90 dias.
- Sazonalidade (mesmo mês em anos anteriores).
- Calendário fiscal configurável (se o ano não for janeiro–dezembro).

---

## 13. Metas, orçamento e desempenho

- Cadastro de metas por período, vendedor, categoria, empresa.
- Realizado vs meta vs orçamento.
- Forecast simples (projeção linear do mês / do ano).
- Ranking e gamificação leve (vendedores, categorias).
- Comentário / anotação em um ponto do gráfico (contexto da diretoria).

---

## 14. Alertas e monitoramento

Não basta o gráfico: o sistema precisa avisar.

- Títulos a receber vencidos acima de X dias ou X reais.
- Saldo projetado negativo em N dias.
- Estoque abaixo do mínimo.
- Pedido parado há N dias sem faturar.
- Nota rejeitada / pendente.
- Queda brusca de faturamento vs média.
- Falha de sincronização com a API Omie.
- Canal: na tela do BI, e-mail e (opcional) WhatsApp / Teams.
- Regras configuráveis por empresa e por usuário.

---

## 15. Exploração analítica (self-service)

- Filtros globais: período, empresa, cliente, fornecedor, vendedor, categoria, produto, UF, status.
- Slicers combináveis (filtro em um gráfico afeta os outros).
- Drill-down (ano → mês → dia; categoria → produto; cliente → títulos).
- Drill-through: da KPI para a lista de documentos Omie (pedido, NF, título).
- Busca por código Omie, número de pedido, NF, CNPJ.
- Tabela detalhe com exportação (Excel / CSV).
- Comparar dois períodos lado a lado.
- Bookmark / visões salvas (“minha visão comercial”, “caixa da sexta”).

---

## 16. Páginas / dashboards sugeridos

Estrutura mínima de telas do produto:

1. **Home executiva**
2. **Caixa e liquidez**
3. **Contas a receber / inadimplência**
4. **Contas a pagar**
5. **DRE gerencial**
6. **Vendas e pedidos**
7. **Faturamento fiscal**
8. **Estoque e produtos**
9. **Compras**
10. **Clientes e carteira**
11. **Vendedores / metas**
12. **Contratos / recorrência** (se houver)
13. **Qualidade de dados e sync**
14. **Explorar** (tabela + filtros livres)

Cada página: KPIs no topo, gráficos no meio, tabela de detalhe embaixo, filtros à esquerda ou no topo.

---

## 17. Plataforma (o que o sistema precisa ter além dos gráficos)

### 17.1 Ingestão e modelo de dados

- Extração periódica de cada endpoint Omie relevante.
- Carga incremental (só o que mudou), com full refresh sob demanda.
- Staging (bruto da API) + modelo analítico (fatos e dimensões).
- Chaves estáveis: `nCod*` do Omie + `app_key` da empresa.
- Histórico (snapshot diário) para estoque, saldo e carteira — senão o BI só vê o “agora”.
- Tratamento de paginação, limite de requisição e retry da API Omie.
- Log de sync: endpoint, horário, registros, erro, duração.

### 17.2 Semântica (camada de métricas)

- Dicionário de indicadores: nome, fórmula, fonte (endpoint), filtro padrão.
- Uma única definição de “faturamento”, “recebido”, “inadimplente”, etc.
- Moeda, casas decimais e unidades padronizadas.
- Versionamento das regras quando a API ou o negócio mudar.

### 17.3 Segurança e acesso

- Login por usuário.
- Papéis: admin, financeiro, comercial, estoque, só visualização.
- RLS: vendedor só vê a própria carteira; gerente vê o time; diretoria vê tudo.
- Segredo Omie (`app_key` / `app_secret`) nunca no front-end.
- Auditoria: quem exportou, quem mudou meta, quem disparou refresh.

### 17.4 Experiência de uso

- Responsivo (desktop primeiro; tablet aceitável; mobile para KPIs e alertas).
- Tema claro, números grandes, pouco texto.
- Estados vazios, loading e erro de sync visíveis.
- Favoritar páginas e KPIs.
- Exportar PDF da página e Excel da tabela.
- Idioma pt-BR, formato `dd/MM/yyyy` e `R$`.

### 17.5 Operação

- Agendamento de atualização (ex.: a cada 15 min financeiro; horário comercial para o resto).
- Status “dados atualizados em …”.
- Replay / reprocessamento de um endpoint.
- Ambiente de homologação vs produção (credenciais Omie de teste).

---

## 18. Testes que os agentes devem garantir (ligado ao BI)

Cada funcionalidade de tela só entra no ar se os testes de API e de dado passarem.

- Contrato do endpoint: status, campos obrigatórios, tipos, paginação.
- Volume e tempo de resposta.
- Idempotência da carga (rodar duas vezes não duplica fato).
- Totais do BI batem com totais reconstruídos da API (reconciliação).
- Filtros de período não “perdem” documentos na virada de mês.
- Status Omie mapeados (aberto, liquidado, cancelado) sem buraco.
- Multi-empresa não mistura registros.
- Falha de um endpoint não derruba o dashboard inteiro (degradação visível).

---

## 19. Fora de escopo (por enquanto)

Para não explodir a primeira versão:

- Substituição do Omie como sistema operacional (o BI não lança pedido, não emite NF, não baixa título).
- Contabilidade oficial / SPED / eSocial como produto fiscal.
- Precificação preditiva avançada e ML complexo na v1 (forecast simples basta).
- App nativo mobile.
- White-label para revenda (pode ser fase 2).

---

## 20. Prioridade sugerida de entrega

Ordem para os agentes construírem valor cedo:

| Fase | Entrega | Por quê |
|------|---------|---------|
| 0 | Sync + modelo + qualidade de dados | Sem dado confiável não há BI |
| 1 | Home + caixa + a receber + a pagar | Dói no bolso; é o que a diretoria abre todo dia |
| 2 | Vendas, faturamento, clientes | Entende se o caixa vai melhorar |
| 3 | Estoque, compras, produtos | Margem e capital de giro |
| 4 | Fiscal, conciliação, DRE | Fechamento e conferência |
| 5 | Metas, alertas, RLS, multi-empresa | Produto maduro |
| 6 | Contratos, CRM, expedição | Só se a operação usar |

---

## 21. Como este documento será usado

1. Os agentes de API mapeiam cada endpoint e marcam **quais funcionalidades acima ele alimenta**.
2. Os agentes de teste validam contrato e reconciliação por funcionalidade, não só por rota.
3. Os agentes de dashboard implementam as telas na ordem da seção 20.
4. Itens novos descobertos na documentação da API entram neste arquivo como backlog, não como tela solta.

Quando os links da API chegarem, este arquivo deve ganhar um anexo `docs/mapa-endpoints.md` ligando endpoint → tabela → KPI → tela.
