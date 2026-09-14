"use strict";

async function upsert(client, sql, values) {
  await client.query(sql, values);
}

const UPSERT_EMPRESA = `
INSERT INTO dim.empresa (app_key, codigo_empresa_omie, cnpj, razao_social, nome_fantasia, estado, cidade, regime_tributario, optante_simples, inativa)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
ON CONFLICT (app_key, codigo_empresa_omie) DO UPDATE SET
  cnpj=EXCLUDED.cnpj, razao_social=EXCLUDED.razao_social, nome_fantasia=EXCLUDED.nome_fantasia,
  estado=EXCLUDED.estado, cidade=EXCLUDED.cidade, regime_tributario=EXCLUDED.regime_tributario,
  optante_simples=EXCLUDED.optante_simples, inativa=EXCLUDED.inativa, updated_at=NOW()`;

const UPSERT_BANCO = `
INSERT INTO dim.banco (codigo_banco, nome, tipo, cod_compensacao, cod_ispb, integra_pix, integra_boleto)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (codigo_banco) DO UPDATE SET
  nome=EXCLUDED.nome, tipo=EXCLUDED.tipo, cod_compensacao=EXCLUDED.cod_compensacao,
  cod_ispb=EXCLUDED.cod_ispb, integra_pix=EXCLUDED.integra_pix, integra_boleto=EXCLUDED.integra_boleto, updated_at=NOW()`;

const UPSERT_CC = `
INSERT INTO dim.conta_corrente (app_key, codigo_cc_omie, codigo_integracao, descricao, codigo_banco, agencia, numero_conta, tipo_conta_corrente, visivel_fluxo_caixa, visivel_resumo, saldo_inicial, inativa)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
ON CONFLICT (app_key, codigo_cc_omie) DO UPDATE SET
  codigo_integracao=EXCLUDED.codigo_integracao, descricao=EXCLUDED.descricao, codigo_banco=EXCLUDED.codigo_banco,
  agencia=EXCLUDED.agencia, numero_conta=EXCLUDED.numero_conta, tipo_conta_corrente=EXCLUDED.tipo_conta_corrente,
  visivel_fluxo_caixa=EXCLUDED.visivel_fluxo_caixa, visivel_resumo=EXCLUDED.visivel_resumo,
  saldo_inicial=EXCLUDED.saldo_inicial, inativa=EXCLUDED.inativa, updated_at=NOW()`;

const UPSERT_CLIENTE = `
INSERT INTO dim.cliente (app_key, codigo_cliente_omie, codigo_integracao, razao_social, nome_fantasia, cnpj_cpf, inscricao_estadual, email, telefone, cidade, estado, cep, pessoa_fisica, inativo)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
ON CONFLICT (app_key, codigo_cliente_omie) DO UPDATE SET
  codigo_integracao=EXCLUDED.codigo_integracao, razao_social=EXCLUDED.razao_social, nome_fantasia=EXCLUDED.nome_fantasia,
  cnpj_cpf=EXCLUDED.cnpj_cpf, inscricao_estadual=EXCLUDED.inscricao_estadual, email=EXCLUDED.email,
  telefone=EXCLUDED.telefone, cidade=EXCLUDED.cidade, estado=EXCLUDED.estado, cep=EXCLUDED.cep,
  pessoa_fisica=EXCLUDED.pessoa_fisica, inativo=EXCLUDED.inativo, updated_at=NOW()`;

const UPSERT_CATEGORIA = `
INSERT INTO dim.categoria (app_key, codigo, descricao, descricao_padrao, categoria_superior, tipo_categoria, codigo_dre, conta_receita, conta_despesa, totalizadora, transferencia, conta_inativa, nao_exibir, definida_pelo_usuario)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
ON CONFLICT (app_key, codigo) DO UPDATE SET
  descricao=EXCLUDED.descricao, descricao_padrao=EXCLUDED.descricao_padrao, categoria_superior=EXCLUDED.categoria_superior,
  tipo_categoria=EXCLUDED.tipo_categoria, codigo_dre=EXCLUDED.codigo_dre, conta_receita=EXCLUDED.conta_receita,
  conta_despesa=EXCLUDED.conta_despesa, totalizadora=EXCLUDED.totalizadora, transferencia=EXCLUDED.transferencia,
  conta_inativa=EXCLUDED.conta_inativa, nao_exibir=EXCLUDED.nao_exibir, definida_pelo_usuario=EXCLUDED.definida_pelo_usuario, updated_at=NOW()`;

const UPSERT_DRE = `
INSERT INTO dim.dre (app_key, codigo_dre, descricao, nivel, sinal, totalizadora, nao_exibir)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (app_key, codigo_dre) DO UPDATE SET
  descricao=EXCLUDED.descricao, nivel=EXCLUDED.nivel, sinal=EXCLUDED.sinal,
  totalizadora=EXCLUDED.totalizadora, nao_exibir=EXCLUDED.nao_exibir, updated_at=NOW()`;

const UPSERT_DEP = `
INSERT INTO dim.departamento (app_key, codigo, descricao, inativo, nivel_totalizador)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (app_key, codigo) DO UPDATE SET
  descricao=EXCLUDED.descricao, inativo=EXCLUDED.inativo, nivel_totalizador=EXCLUDED.nivel_totalizador, updated_at=NOW()`;

const UPSERT_ORIGEM = `
INSERT INTO dim.origem (codigo, descricao)
VALUES ($1,$2)
ON CONFLICT (codigo) DO UPDATE SET descricao=EXCLUDED.descricao`;

const UPSERT_PARCELA = `
INSERT INTO dim.parcela (codigo_parcela, descricao, num_parcelas)
VALUES ($1,$2,$3)
ON CONFLICT (codigo_parcela) DO UPDATE SET descricao=EXCLUDED.descricao, num_parcelas=EXCLUDED.num_parcelas`;

const UPSERT_TITULO = `
INSERT INTO fato.titulo (
  app_key, codigo_titulo_omie, codigo_integracao, natureza, status,
  codigo_cliente_omie, codigo_cc_omie, codigo_categoria, codigo_tipo_documento, codigo_origem,
  codigo_departamento, codigo_projeto, codigo_vendedor, codigo_comprador, codigo_contrato_omie,
  codigo_pedido_omie, codigo_nf_omie, operacao, numero_titulo, numero_documento, numero_documento_fiscal,
  numero_parcela, numero_boleto, chave_nfe, codigo_barras, data_emissao, data_vencimento, data_previsao,
  data_pagamento, data_registro, data_cancelamento, valor_titulo, valor_pis, valor_cofins, valor_csll,
  valor_ir, valor_iss, valor_inss, retem_pis, retem_cofins, retem_csll, retem_ir, retem_iss, retem_inss,
  liquidado, valor_pago, valor_aberto, total_desconto, total_juros, total_multa, valor_liquido, observacao,
  omie_inclusao_data, omie_inclusao_hora, omie_inclusao_usuario, omie_alteracao_data, omie_alteracao_hora,
  omie_alteracao_usuario, importado_api, synced_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
  $29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,
  $55,$56,$57,$58,$59, NOW()
)
ON CONFLICT (app_key, codigo_titulo_omie) DO UPDATE SET
  codigo_integracao=EXCLUDED.codigo_integracao, natureza=EXCLUDED.natureza, status=EXCLUDED.status,
  codigo_cliente_omie=EXCLUDED.codigo_cliente_omie, codigo_cc_omie=EXCLUDED.codigo_cc_omie,
  codigo_categoria=EXCLUDED.codigo_categoria, codigo_tipo_documento=EXCLUDED.codigo_tipo_documento,
  codigo_origem=EXCLUDED.codigo_origem, codigo_departamento=EXCLUDED.codigo_departamento,
  numero_titulo=EXCLUDED.numero_titulo, numero_documento=EXCLUDED.numero_documento,
  data_emissao=EXCLUDED.data_emissao, data_vencimento=EXCLUDED.data_vencimento, data_previsao=EXCLUDED.data_previsao,
  data_pagamento=EXCLUDED.data_pagamento, valor_titulo=EXCLUDED.valor_titulo, liquidado=EXCLUDED.liquidado,
  valor_pago=EXCLUDED.valor_pago, valor_aberto=EXCLUDED.valor_aberto, total_desconto=EXCLUDED.total_desconto,
  total_juros=EXCLUDED.total_juros, total_multa=EXCLUDED.total_multa, valor_liquido=EXCLUDED.valor_liquido,
  observacao=EXCLUDED.observacao, synced_at=NOW(), updated_at=NOW()`;

const UPSERT_BAIXA = `
INSERT INTO fato.baixa (app_key, codigo_titulo_omie, codigo_baixa_omie, codigo_integracao_baixa, codigo_lancamento_cc, codigo_cc_omie, natureza, data_baixa, valor_baixa, desconto, juros, multa, observacao, synced_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
ON CONFLICT (app_key, codigo_titulo_omie, codigo_baixa_omie) DO UPDATE SET
  codigo_cc_omie=EXCLUDED.codigo_cc_omie, data_baixa=EXCLUDED.data_baixa, valor_baixa=EXCLUDED.valor_baixa,
  desconto=EXCLUDED.desconto, juros=EXCLUDED.juros, multa=EXCLUDED.multa, observacao=EXCLUDED.observacao, synced_at=NOW()`;

const UPSERT_RATEIO_CAT = `
INSERT INTO fato.titulo_rateio_categoria (app_key, codigo_titulo_omie, codigo_categoria, valor, percentual)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (app_key, codigo_titulo_omie, codigo_categoria) DO UPDATE SET valor=EXCLUDED.valor, percentual=EXCLUDED.percentual`;

const UPSERT_RATEIO_DEP = `
INSERT INTO fato.titulo_rateio_departamento (app_key, codigo_titulo_omie, codigo_departamento, valor, percentual, valor_fixo)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (app_key, codigo_titulo_omie, codigo_departamento) DO UPDATE SET valor=EXCLUDED.valor, percentual=EXCLUDED.percentual, valor_fixo=EXCLUDED.valor_fixo`;

const UPSERT_EXTRATO = `
INSERT INTO fato.extrato_movimento (
  app_key, codigo_cc_omie, codigo_lancamento, codigo_lancamento_relac, situacao, data_lancamento, natureza,
  codigo_cliente_omie, nome_cliente, razao_social_cliente, cnpj_cpf_cliente, tipo_documento, numero_documento,
  numero_documento_fiscal, numero_parcela, nosso_numero, codigo_categoria, descricao_categoria, origem, vendedor,
  projeto, valor_documento, saldo_realizado, saldo_previsto, data_conciliacao, bloqueado, data_inclusao, hora_inclusao,
  observacoes, synced_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, NOW()
)
ON CONFLICT (app_key, codigo_cc_omie, codigo_lancamento) DO UPDATE SET
  situacao=EXCLUDED.situacao, data_lancamento=EXCLUDED.data_lancamento, natureza=EXCLUDED.natureza,
  valor_documento=EXCLUDED.valor_documento, saldo_realizado=EXCLUDED.saldo_realizado,
  data_conciliacao=EXCLUDED.data_conciliacao, synced_at=NOW()`;

const UPSERT_SALDO = `
INSERT INTO fato.saldo_conta_corrente (app_key, codigo_cc_omie, data_referencia, saldo_anterior, saldo_anterior_previsto, saldo_atual, saldo_atual_previsto, saldo_conciliado, saldo_provisorio, limite_credito_total, saldo_disponivel)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (app_key, codigo_cc_omie, data_referencia) DO UPDATE SET
  saldo_anterior=EXCLUDED.saldo_anterior, saldo_atual=EXCLUDED.saldo_atual, saldo_atual_previsto=EXCLUDED.saldo_atual_previsto,
  saldo_conciliado=EXCLUDED.saldo_conciliado, saldo_disponivel=EXCLUDED.saldo_disponivel, limite_credito_total=EXCLUDED.limite_credito_total`;

const UPSERT_ORC = `
INSERT INTO fato.orcamento_caixa (app_key, ano, mes, codigo_categoria, descricao_categoria, valor_previsto, valor_realizado)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (app_key, ano, mes, codigo_categoria) DO UPDATE SET
  descricao_categoria=EXCLUDED.descricao_categoria, valor_previsto=EXCLUDED.valor_previsto, valor_realizado=EXCLUDED.valor_realizado, updated_at=NOW()`;

const UPSERT_RESUMO = `
INSERT INTO fato.resumo_snapshot (app_key, data_referencia, cc_saldo_total, cc_limite_credito, ar_qtd_titulos, ar_valor_total, ar_valor_atraso, ap_qtd_titulos, ap_valor_total, ap_valor_atraso, fluxo_pagar, fluxo_receber, fluxo_saldo)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT (app_key, data_referencia) DO UPDATE SET
  cc_saldo_total=EXCLUDED.cc_saldo_total, cc_limite_credito=EXCLUDED.cc_limite_credito,
  ar_qtd_titulos=EXCLUDED.ar_qtd_titulos, ar_valor_total=EXCLUDED.ar_valor_total, ar_valor_atraso=EXCLUDED.ar_valor_atraso,
  ap_qtd_titulos=EXCLUDED.ap_qtd_titulos, ap_valor_total=EXCLUDED.ap_valor_total, ap_valor_atraso=EXCLUDED.ap_valor_atraso,
  fluxo_pagar=EXCLUDED.fluxo_pagar, fluxo_receber=EXCLUDED.fluxo_receber, fluxo_saldo=EXCLUDED.fluxo_saldo
RETURNING id`;

module.exports = {
  upsert,
  UPSERT_EMPRESA,
  UPSERT_BANCO,
  UPSERT_CC,
  UPSERT_CLIENTE,
  UPSERT_CATEGORIA,
  UPSERT_DRE,
  UPSERT_DEP,
  UPSERT_ORIGEM,
  UPSERT_PARCELA,
  UPSERT_TITULO,
  UPSERT_BAIXA,
  UPSERT_RATEIO_CAT,
  UPSERT_RATEIO_DEP,
  UPSERT_EXTRATO,
  UPSERT_SALDO,
  UPSERT_ORC,
  UPSERT_RESUMO,
};
