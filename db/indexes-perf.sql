-- Índices de leitura para o dashboard. Não altera dados.
-- Pode ser executado em banco já existente: CREATE INDEX IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_saldo_cc_lookup
  ON fato.saldo_conta_corrente (app_key, codigo_cc_omie, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_titulo_aberto_venc
  ON fato.titulo (app_key, natureza, data_vencimento)
  WHERE valor_aberto > 0 AND status NOT IN ('CANCELADO','RECEBIDO','PAGO','LIQUIDADO');

CREATE INDEX IF NOT EXISTS idx_titulo_atrasado
  ON fato.titulo (app_key, natureza)
  WHERE status = 'ATRASADO';
