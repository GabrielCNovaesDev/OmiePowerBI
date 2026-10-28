# Checklist de pendências

Detalhes técnicos em [analise-tecnica.md](analise-tecnica.md).

## Atualização (sync Omie)
- [x] Carga rápida: ~3 h → ~10 min (testado em cópia do banco em 28/10)
- [x] Um único horário de atualização, todas as empresas juntas às 03:00
- [x] Workflow acusa falha quando a carga falha
- [x] Logs sem dados financeiros (repo público)
- [x] Excluídos/estornados na Omie saem do BI
- [ ] Publicar (commit/push) e acompanhar a primeira carga das 03:00

## Bater com o ERP Omie (prioridade)
- [ ] Conferir Contas a Receber / Pagar (DIPRIMO, um mês fechado)
- [ ] Conferir extrato e saldo das contas
- [ ] Conferir resultado por categoria (rateio, transferências)
- [ ] Corrigir a reconciliação automática (métrica errada do resumo)

## Ajustes de tela
- [ ] Resumo: total a pagar e total a receber
- [ ] Módulos por empresa (ligar/desligar telas por cliente)
  - [ ] Previsto do Fluxo de Caixa
  - [ ] DRE
  - [ ] Previsto x Realizado
  - [ ] Q&A
- [ ] Papel "desenvolvedor": só ele vê Qualidade & Sync

## Segurança e limpeza
- [ ] Repo público: apagar logs antigos do Actions e remover `prints/`
- [ ] Sessão expira na hora ao desativar/rebaixar usuário
- [ ] Demais itens da revisão (analise-tecnica.md, seção 6)
