"use strict";

const { parseOmieDate, num, str, flag } = require("../lib/util");

const STATUS_ALIASES = {
  PAGTOPARCIAL: "PAGTO_PARCIAL",
  PAGTO_PARCIAL: "PAGTO_PARCIAL",
  RECEBIDO: "RECEBIDO",
  PAGO: "PAGO",
  LIQUIDADO: "LIQUIDADO",
  CANCELADO: "CANCELADO",
  EMABERTO: "EMABERTO",
  AVENCER: "AVENCER",
  VENCEHOJE: "VENCEHOJE",
  ATRASADO: "ATRASADO",
};

const VALID_STATUS = new Set([
  "EMABERTO",
  "AVENCER",
  "VENCEHOJE",
  "ATRASADO",
  "PAGTO_PARCIAL",
  "PAGO",
  "RECEBIDO",
  "LIQUIDADO",
  "CANCELADO",
]);

function mapStatus(raw) {
  if (!raw) return "EMABERTO";
  const key = String(raw).toUpperCase().replace(/[\s-]/g, "");
  const mapped = STATUS_ALIASES[key] || STATUS_ALIASES[raw] || key;
  if (VALID_STATUS.has(mapped)) return mapped;
  if (key.includes("PARCIAL")) return "PAGTO_PARCIAL";
  return "EMABERTO";
}

function mapNatureza(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "P" || s === "PAGAR" || s === "CP") return "P";
  return "R";
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== "") return obj[key];
  }
  return null;
}

function mapEmpresa(row, appKey) {
  return {
    app_key: appKey,
    codigo_empresa_omie: num(pick(row, "codigo_empresa"), 0),
    cnpj: str(pick(row, "cnpj"), 20) || "00",
    razao_social: str(pick(row, "razao_social"), 60) || "Empresa",
    nome_fantasia: str(pick(row, "nome_fantasia"), 60),
    estado: str(pick(row, "estado"), 2),
    cidade: str(pick(row, "cidade"), 40),
    regime_tributario: str(pick(row, "regime_tributario"), 1),
    optante_simples: str(pick(row, "optante_simples_nacional"), 1),
    inativa: flag(pick(row, "inativa"), "N"),
  };
}

function mapBanco(row) {
  return {
    codigo_banco: str(pick(row, "codigo", "codigo_banco"), 3),
    nome: str(pick(row, "nome", "descricao", "cNome"), 40) || "Banco",
    tipo: str(pick(row, "tipo", "cTipo"), 2),
    cod_compensacao: str(pick(row, "codigo_compensacao", "cod_compensacao"), 3),
    cod_ispb: str(pick(row, "codigo_ispb", "cod_ispb"), 8),
    integra_pix: flag(pick(row, "integra_pix"), "N"),
    integra_boleto: flag(pick(row, "integra_boleto"), "N"),
  };
}

function mapContaCorrente(row, appKey) {
  const tipo = pick(row, "tipo_conta_corrente", "cCodTipo", "tipo");
  const naoFluxo = flag(pick(row, "nao_fluxo"), "N");
  const naoResumo = flag(pick(row, "nao_resumo"), "N");
  return {
    app_key: appKey,
    codigo_cc_omie: num(pick(row, "nCodCC", "codigo", "codigo_conta_corrente"), 0),
    codigo_integracao: str(pick(row, "cCodCCInt", "codigo_integracao"), 20),
    descricao: str(pick(row, "descricao", "cDescricao"), 40) || "Conta",
    codigo_banco: str(pick(row, "codigo_banco", "cCodBanco"), 3),
    agencia: str(pick(row, "codigo_agencia", "agencia", "cAgencia"), 10),
    numero_conta: str(pick(row, "numero_conta_corrente", "conta_corrente", "numero_conta", "cConta"), 25),
    tipo_conta_corrente: str(tipo, 2),
    visivel_fluxo_caixa: naoFluxo === "S" ? "N" : "S",
    visivel_resumo: naoResumo === "S" ? "N" : "S",
    saldo_inicial: num(pick(row, "saldo_inicial", "nSaldoInicial")),
    inativa: flag(pick(row, "inativo", "inativa", "cInativo"), "N"),
  };
}

function mapCliente(row, appKey) {
  return {
    app_key: appKey,
    codigo_cliente_omie: num(pick(row, "codigo_cliente_omie", "nCodCliente"), 0),
    codigo_integracao: str(pick(row, "codigo_cliente_integracao", "cCodInt"), 60),
    razao_social: str(pick(row, "razao_social", "cRazao"), 60) || "Cliente",
    nome_fantasia: str(pick(row, "nome_fantasia"), 60),
    cnpj_cpf: str(pick(row, "cnpj_cpf", "cnpj", "cpf"), 20),
    inscricao_estadual: str(pick(row, "inscricao_estadual"), 20),
    email: str(pick(row, "email"), 200),
    telefone: str(pick(row, "telefone1_numero", "telefone"), 20),
    cidade: str(pick(row, "cidade"), 40),
    estado: str(pick(row, "estado"), 2),
    cep: str(pick(row, "cep"), 9),
    pessoa_fisica: flag(pick(row, "pessoa_fisica"), "N"),
    inativo: flag(pick(row, "inativo"), "N"),
  };
}

function mapCategoria(row, appKey) {
  return {
    app_key: appKey,
    codigo: str(pick(row, "codigo", "cCodCateg"), 20),
    descricao: str(pick(row, "descricao", "cDesCateg"), 50) || "Categoria",
    descricao_padrao: str(pick(row, "descricao_padrao"), 50),
    categoria_superior: str(pick(row, "categoria_superior"), 20),
    tipo_categoria: str(pick(row, "tipo_categoria", "codigo_tipo"), 3),
    codigo_dre: str(pick(row, "codigo_dre", "cCodDRE"), 10),
    conta_receita: flag(pick(row, "conta_receita"), "N"),
    conta_despesa: flag(pick(row, "conta_despesa"), "N"),
    totalizadora: flag(pick(row, "totalizadora"), "N"),
    transferencia: flag(pick(row, "transferencia"), "N"),
    conta_inativa: flag(pick(row, "conta_inativa", "inativo"), "N"),
    nao_exibir: flag(pick(row, "nao_exibir"), "N"),
    definida_pelo_usuario: flag(pick(row, "definida_pelo_usuario"), "N"),
  };
}

function mapDre(row, appKey) {
  return {
    app_key: appKey,
    codigo_dre: str(pick(row, "codigoDRE", "codigo_dre", "cCodigo"), 10),
    descricao: str(pick(row, "descricaoDRE", "descricao"), 40) || "DRE",
    nivel: num(pick(row, "nivelDRE", "nivel"), 1),
    sinal: str(pick(row, "sinalDRE", "sinal"), 1),
    totalizadora: flag(pick(row, "totalizaDRE", "totalizadora"), "N"),
    nao_exibir: flag(pick(row, "nao_exibir"), "N"),
  };
}

function mapDepartamento(row, appKey) {
  return {
    app_key: appKey,
    codigo: str(pick(row, "codigo", "cCodDepartamento"), 40),
    descricao: str(pick(row, "descricao"), 50) || "Departamento",
    inativo: flag(pick(row, "inativo"), "N"),
    nivel_totalizador: flag(pick(row, "nivel_totalizador"), "N"),
  };
}

function mapOrigem(row) {
  return {
    codigo: str(pick(row, "codigo", "cCodigo"), 4),
    descricao: str(pick(row, "descricao", "cDescricao"), 50) || "Origem",
  };
}

function mapParcela(row) {
  return {
    codigo_parcela: str(pick(row, "nCodigo", "codigo", "cCodigo"), 3),
    descricao: str(pick(row, "cDescricao", "descricao"), 30) || "Parcela",
    num_parcelas: num(pick(row, "nParcelas", "num_parcelas"), 1),
  };
}

function mapTitulo(item, appKey) {
  const cab = item.cabecTitulo || item.cabecalho || item;
  const resumo = item.resumo || {};
  const info = cab.info || cab.infoCadastro || item.info || {};
  const natureza = mapNatureza(pick(cab, "cNatureza", "natureza"));
  const status = mapStatus(pick(cab, "cStatus", "status", "status_titulo"));
  const venc = parseOmieDate(pick(cab, "dDtVenc", "dDtVencimento", "data_vencimento")) || "1970-01-01";
  return {
    app_key: appKey,
    codigo_titulo_omie: num(pick(cab, "nCodTitulo", "codigo_lancamento_omie"), 0),
    codigo_integracao: str(pick(cab, "cCodIntTitulo", "codigo_lancamento_integracao"), 60),
    natureza,
    status,
    codigo_cliente_omie: num(pick(cab, "nCodCliente", "codigo_cliente_fornecedor"), null),
    codigo_cc_omie: num(pick(cab, "nCodCC", "nCodCompr", "id_conta_corrente"), null),
    codigo_categoria: str(pick(cab, "cCodCateg", "codigo_categoria"), 20),
    codigo_tipo_documento: str(pick(cab, "cTipo", "codigo_tipo_documento"), 5),
    codigo_origem: str(pick(cab, "cOrigem", "id_origem"), 4),
    codigo_departamento: str(pick(cab, "cCodDepartamento"), 40),
    codigo_projeto: num(pick(cab, "nCodProjeto", "codigo_projeto"), null),
    codigo_vendedor: num(pick(cab, "nCodVendedor", "codigo_vendedor"), null),
    codigo_comprador: num(pick(cab, "nCodComprador"), null),
    codigo_contrato_omie: num(pick(cab, "nCodCtr", "codigo_contrato"), null),
    codigo_pedido_omie: num(pick(cab, "nCodOS", "codigo_pedido"), null),
    codigo_nf_omie: num(pick(cab, "nCodNF", "codigo_nf"), null),
    operacao: str(pick(cab, "cOperacao"), 2),
    numero_titulo: str(pick(cab, "cNumTitulo", "cNumDocFiscal", "numero_documento"), 20),
    numero_documento: str(pick(cab, "cNumDoc", "cNumDocFiscal", "numero_documento"), 20),
    numero_documento_fiscal: str(pick(cab, "cNumDocFiscal", "numero_documento_fiscal"), 20),
    numero_parcela: str(pick(cab, "cNumParcela", "numero_parcela"), 7),
    numero_boleto: str(pick(cab, "cNumBoleto", "numero_boleto"), 30),
    chave_nfe: str(pick(cab, "cChaveNFe"), 44),
    codigo_barras: str(pick(cab, "cCodBarras"), 70),
    data_emissao: parseOmieDate(pick(cab, "dDtEmissao", "dDtEmis", "data_emissao")),
    data_vencimento: venc,
    data_previsao: parseOmieDate(pick(cab, "dDtPrevisao", "data_previsao")),
    data_pagamento: parseOmieDate(pick(cab, "dDtPagamento", "dDtCredito", "data_pagamento")),
    data_registro: parseOmieDate(pick(cab, "dDtRegistro", "data_registro")),
    data_cancelamento: parseOmieDate(pick(cab, "dDtCancelamento")),
    valor_titulo: num(pick(cab, "nValorTitulo", "nValTitulo", "valor_documento")),
    valor_pis: num(pick(cab, "nValorPIS", "nValPIS")),
    valor_cofins: num(pick(cab, "nValorCOFINS", "nValCOFINS")),
    valor_csll: num(pick(cab, "nValorCSLL", "nValCSLL")),
    valor_ir: num(pick(cab, "nValorIR", "nValIR")),
    valor_iss: num(pick(cab, "nValorISS", "nValISS")),
    valor_inss: num(pick(cab, "nValorINSS", "nValINSS")),
    retem_pis: flag(pick(cab, "cRetPIS"), "N"),
    retem_cofins: flag(pick(cab, "cRetCOFINS"), "N"),
    retem_csll: flag(pick(cab, "cRetCSLL"), "N"),
    retem_ir: flag(pick(cab, "cRetIR"), "N"),
    retem_iss: flag(pick(cab, "cRetISS"), "N"),
    retem_inss: flag(pick(cab, "cRetINSS"), "N"),
    liquidado: flag(pick(resumo, "cLiquidado"), status === "PAGO" || status === "RECEBIDO" || status === "LIQUIDADO" ? "S" : "N"),
    valor_pago: num(pick(resumo, "nValPago", "nValLiquido")),
    valor_aberto: num(pick(resumo, "nValAberto", "nValAberto")),
    total_desconto: num(pick(resumo, "nDesconto", "nValDesconto")),
    total_juros: num(pick(resumo, "nJuros", "nValJuros")),
    total_multa: num(pick(resumo, "nMulta", "nValMulta")),
    valor_liquido: num(pick(resumo, "nValLiquido", "nValorLiquido")),
    observacao: str(pick(cab, "observacao", "cObs")),
    omie_inclusao_data: parseOmieDate(pick(info, "dInc", "dDtInc", "inclusao_data")),
    omie_inclusao_hora: str(pick(info, "hInc", "hHrInc"), 8),
    omie_inclusao_usuario: str(pick(info, "uInc", "cUsuarioInc"), 10),
    omie_alteracao_data: parseOmieDate(pick(info, "dAlt", "dDtAlt", "alteracao_data")),
    omie_alteracao_hora: str(pick(info, "hAlt"), 8),
    omie_alteracao_usuario: str(pick(info, "uAlt"), 10),
    importado_api: flag(pick(cab, "cImportado", "importado_api"), "N"),
    _rateioCategorias: Array.isArray(cab.aCodCateg) ? cab.aCodCateg : Array.isArray(cab.categorias) ? cab.categorias : [],
    _rateioDepartamentos: Array.isArray(cab.departamentos) ? cab.departamentos : Array.isArray(cab.distribuicao) ? cab.distribuicao : [],
    _baixas: Array.isArray(item.lancamentos) ? item.lancamentos : [],
  };
}

function mapBaixa(row, appKey, codigoTitulo, natureza) {
  return {
    app_key: appKey,
    codigo_titulo_omie: codigoTitulo,
    codigo_baixa_omie: num(pick(row, "nCodLanc", "nCodBaixa", "codigo_baixa"), 0),
    codigo_integracao_baixa: str(pick(row, "cCodIntLanc"), 20),
    codigo_lancamento_cc: num(pick(row, "nIdLancCC"), null),
    codigo_cc_omie: num(pick(row, "nCodCC", "id_conta_corrente"), null),
    natureza,
    data_baixa: parseOmieDate(pick(row, "dDtLanc", "dDtPagamento", "dDtCredito", "data")) || "1970-01-01",
    valor_baixa: num(pick(row, "nValLanc", "nValPago", "nValor")),
    desconto: num(pick(row, "nDesconto", "nValDesconto")),
    juros: num(pick(row, "nJuros", "nValJuros")),
    multa: num(pick(row, "nMulta", "nValMulta")),
    observacao: str(pick(row, "cObs", "observacao")),
  };
}

function mapExtratoMovimento(row, appKey, codigoCc) {
  const natRaw = String(pick(row, "cNatureza", "natureza") || "").toUpperCase();
  let natureza = natRaw.slice(0, 1) || null;
  if (natRaw === "P" || natRaw === "S" || natRaw === "-") natureza = "S";
  if (natRaw === "R" || natRaw === "E" || natRaw === "+") natureza = "E";
  return {
    app_key: appKey,
    codigo_cc_omie: codigoCc,
    codigo_lancamento: num(pick(row, "nCodLancamento", "nCodLanc", "codigo"), 0),
    codigo_lancamento_relac: num(pick(row, "nCodLancamentoRelac"), null),
    situacao: str(pick(row, "cSituacao", "situacao"), 40),
    data_lancamento: parseOmieDate(pick(row, "dDataLancamento", "dDtLancamento", "dData", "data")) || "1970-01-01",
    natureza,
    codigo_cliente_omie: num(pick(row, "nCodCliente", "nCodClienteFornecedor"), null),
    nome_cliente: str(pick(row, "cDesCliente", "cNomeCliente", "nome"), 100),
    razao_social_cliente: str(pick(row, "cRazCliente", "cRazaoSocial", "razao_social"), 60),
    cnpj_cpf_cliente: str(pick(row, "cDocCliente", "cCNPJCPF", "cnpj_cpf"), 20),
    tipo_documento: str(pick(row, "cTipoDocumento", "cTipo"), 50),
    numero_documento: str(pick(row, "cNumero", "cNumDocumento"), 20),
    numero_documento_fiscal: str(pick(row, "cDocumentoFiscal", "cNumDocFiscal"), 20),
    numero_parcela: str(pick(row, "cParcela", "cNumParcela"), 7),
    nosso_numero: str(pick(row, "cNossoNumero"), 30),
    codigo_categoria: str(pick(row, "cCodCategoria", "cCodCateg", "cCodigoCategoria"), 20),
    descricao_categoria: str(pick(row, "cDesCategoria", "cDesCateg", "cDescricao"), 350),
    origem: str(pick(row, "cOrigem"), 50),
    vendedor: str(pick(row, "cVendedor"), 70),
    projeto: str(pick(row, "cProjeto"), 70),
    valor_documento: num(pick(row, "nValorDocumento", "nValor", "nValDocumento")),
    saldo_realizado: num(pick(row, "nSaldo", "nSaldoRealizado")),
    saldo_previsto: num(pick(row, "nSaldoPrev", "nSaldoPrevisto")),
    data_conciliacao: parseOmieDate(pick(row, "dDtConcilia", "dConciliacao")),
    bloqueado: flag(pick(row, "cBloqueado"), "N"),
    data_inclusao: parseOmieDate(pick(row, "cDataInclusao", "dDtInc")),
    hora_inclusao: str(pick(row, "cHoraInclusao", "cHrInc"), 8),
    observacoes: str(pick(row, "cObs", "observacoes")),
  };
}

function mapSaldoExtrato(json, appKey, codigoCc, dataRef) {
  return {
    app_key: appKey,
    codigo_cc_omie: codigoCc,
    data_referencia: dataRef,
    saldo_anterior: num(pick(json, "nSaldoAnterior")),
    saldo_anterior_previsto: num(pick(json, "nSaldoAnteriorPrevisto")),
    saldo_atual: num(pick(json, "nSaldoAtual")),
    saldo_atual_previsto: num(pick(json, "nSaldoAtualPrevisto")),
    saldo_conciliado: num(pick(json, "nSaldoConciliado")),
    saldo_provisorio: num(pick(json, "nSaldoProvisorio")),
    limite_credito_total: num(pick(json, "nLimiteCreditoTotal")),
    saldo_disponivel: num(pick(json, "nSaldoDisponivel")),
  };
}

function mapOrcamento(row, appKey, ano, mes) {
  return {
    app_key: appKey,
    ano,
    mes,
    codigo_categoria: str(pick(row, "cCodCateg", "codigo"), 20),
    descricao_categoria: str(pick(row, "cDesCateg", "descricao")),
    valor_previsto: num(pick(row, "nValorPrevisto")),
    valor_realizado: num(pick(row, "nValorRealilzado", "nValorRealizado")),
  };
}

function mapResumo(json, appKey, dataRef) {
  const cc = json.contaCorrente || {};
  const ar = json.contaReceber || {};
  const ap = json.contaPagar || {};
  const fluxoRaw = json.fluxoCaixa;
  const fluxo = Array.isArray(fluxoRaw) ? fluxoRaw[0] || {} : fluxoRaw || {};
  return {
    app_key: appKey,
    data_referencia: dataRef,
    cc_saldo_total: num(cc.vTotal),
    cc_limite_credito: num(cc.vLimiteCredito),
    ar_qtd_titulos: num(ar.nTotal),
    ar_valor_total: num(ar.vTotal),
    ar_valor_atraso: num(ar.vAtraso),
    ap_qtd_titulos: num(ap.nTotal),
    ap_valor_total: num(ap.vTotal),
    ap_valor_atraso: num(ap.vAtraso),
    fluxo_pagar: num(fluxo.vPagar),
    fluxo_receber: num(fluxo.vReceber),
    fluxo_saldo: num(fluxo.vSaldo),
    categoriasReceber: json.contaReceberCategoria || [],
    categoriasPagar: json.contaPagarCategoria || [],
  };
}

module.exports = {
  mapStatus,
  mapNatureza,
  mapEmpresa,
  mapBanco,
  mapContaCorrente,
  mapCliente,
  mapCategoria,
  mapDre,
  mapDepartamento,
  mapOrigem,
  mapParcela,
  mapTitulo,
  mapBaixa,
  mapExtratoMovimento,
  mapSaldoExtrato,
  mapOrcamento,
  mapResumo,
  pick,
};
