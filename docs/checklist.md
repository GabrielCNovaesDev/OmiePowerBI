# Checklist de pendências

Detalhes técnicos em [analise-tecnica.md](analise-tecnica.md).

## Atualização (sync Omie)
- [x] Carga rápida: ~3 h → ~10 min (testado em cópia do banco em 28/10)
- [x] Um único horário de atualização, todas as empresas juntas às 03:00
- [x] Workflow acusa falha quando a carga falha
- [x] Logs sem dados financeiros (repo público)
- [x] Excluídos/estornados na Omie saem do BI
- [x] Publicado; primeira carga em produção: 12 min, sem erros (28/10)
- [ ] Confirmar que a carga automática das 03:00 rodou sozinha

## Bater com o ERP Omie (prioridade)
- [x] Base de dados DI PRIMO = ERP (títulos, contas, saldos, cadastros) — 28/10
- [x] Reconciliação automática com as regras do Resumo Omie (diferença zero nas 2 empresas)
- [x] Telas por categoria usam o rateio de categoria (títulos e extrato)
- [x] Relatório Diário: saídas somavam no saldo em vez de subtrair
- [ ] Conferir cada tela do BI contra o relatório do ERP equivalente
  - [x] Resumo
  - [x] Fluxo de Caixa realizado (set/2026: 50/50 categorias)
  - [~] DRE — mantida em caixa; regras do Omie levantadas, implementação no backlog
  - [x] Receitas / Custos / Despesas e Resultados = Recebimentos/Pagamentos realizados do ERP (histórico completo, fev/24–out/26)
  - [x] Carga única do histórico do extrato (36 meses) — 28/10, 25 min
  - [x] Contas a pagar / receber (com "todas as contas": totais e faixas = ERP; tela abre com as Consideradas)
  - [x] Nomes com "&amp;" (entidades HTML da API) corrigidos na carga e no banco
- [ ] Repetir a conferência no Instituto LM (depois — prioridade é a DI PRIMO)

## Depois (backlog)
- [ ] DRE por competência, igual ao Omie ([backlog](backlog-endpoints.md))
- [ ] Novos endpoints: NF-e, NFS-e, vendas, produtos, estoque/CMC, compras, contratos, vendedores, projetos

## Ajustes de tela
- [x] Resumo: total a pagar e total a receber
- [x] Módulos por empresa (Admin → Empresas → editar → "Telas desta empresa")
  - [x] Desligados na DI PRIMO: Previsto do Fluxo de Caixa, DRE, Previsto x Realizado, Q&A
- [x] Papel "desenvolvedor": só ele vê Qualidade & Sync (precisa sair e entrar de novo)
- [x] Ícones dos bancos nas contas (Saldo, Extrato, Diário, Check Panel)
- [x] Logos dos principais clientes da DI PRIMO (GBarbosa, Atakarejo, Mateus; Assaí, Bombom e Ki Barato com selo de iniciais)
- [x] Coluna `ops.aplicativo.modulos_desativados` criada no banco
- [x] Telas conferidas no navegador (local) e publicadas
- [x] Datas sem horário apareciam um dia antes (ex.: vencimento 28/10 mostrado como 27/10)
- [x] "Hoje" calculado no fuso de São Paulo (depois das 21h o BI já mostrava o dia seguinte)
- [x] Prazos de títulos em aberto pela previsão de recebimento/pagamento, como o Omie (hoje/semana/mês, fluxo previsto, faixas de dias); listas com colunas Previsão e Vencimento

## Segurança e limpeza
- [x] Check Panel mostrava pendências de outras empresas (filtro sem parênteses)
- [x] Middleware de login nunca rodava (estava fora de `src/`): agora redireciona e protege `/admin` na borda
- [ ] Repo público: apagar logs antigos do Actions e remover `prints/`
- [ ] Sessão expira na hora ao desativar/rebaixar usuário
- [ ] Demais itens da revisão (analise-tecnica.md, seção 6)
