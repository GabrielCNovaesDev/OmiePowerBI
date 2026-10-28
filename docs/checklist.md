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
- [ ] Repetir a conferência no Instituto LM (depois — prioridade é a DI PRIMO)

## Ajustes de tela
- [ ] Resumo: total a pagar e total a receber
- [ ] Módulos por empresa (ligar/desligar telas por cliente)
  - [ ] Previsto do Fluxo de Caixa
  - [ ] DRE
  - [ ] Previsto x Realizado
  - [ ] Q&A
- [ ] Papel "desenvolvedor": só ele vê Qualidade & Sync

## Segurança e limpeza
- [x] Check Panel mostrava pendências de outras empresas (filtro sem parênteses)
- [ ] Repo público: apagar logs antigos do Actions e remover `prints/`
- [ ] Sessão expira na hora ao desativar/rebaixar usuário
- [ ] Demais itens da revisão (analise-tecnica.md, seção 6)
