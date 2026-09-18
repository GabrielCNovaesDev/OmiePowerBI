-- =============================================================================
-- OmiePowerBI — Schema PostgreSQL (Neon)
-- Modelo dimensional: star schema com dimensões conformadas e fatos financeiros
-- Normalização: 3NF nas dimensões, desnormalizado apenas onde BI exige
-- =============================================================================

-- Convenções:
--   PK surrogate: BIGINT GENERATED ALWAYS AS IDENTITY
--   NK (natural key) Omie: coluna separada com UNIQUE constraint
--   app_key: presente em todas as tabelas para multi-empresa futura
--   Timestamps: created_at/updated_at com timezone
--   Soft delete via coluna ativo/inativo da Omie (nunca deletamos registros)
--   snake_case em tudo; prefixo dim_ / fato_ / stg_ / ops_

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS dim;    -- Dimensões (cadastros Omie)
CREATE SCHEMA IF NOT EXISTS fato;   -- Fatos (transações financeiras)
CREATE SCHEMA IF NOT EXISTS stg;    -- Staging (JSON bruto da API)
CREATE SCHEMA IF NOT EXISTS ops;    -- Operacional (sync, logs, controle)

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSÕES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid, encrypt/decrypt

-- ─────────────────────────────────────────────────────────────────────────────
-- TIPO ENUM reutilizável
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.natureza_titulo AS ENUM ('R', 'P');
-- R = Receita (Contas a Receber), P = Pagamento (Contas a Pagar)

CREATE TYPE public.status_titulo AS ENUM (
    'EMABERTO', 'AVENCER', 'VENCEHOJE', 'ATRASADO',
    'PAGTO_PARCIAL', 'PAGO', 'RECEBIDO', 'LIQUIDADO', 'CANCELADO'
);

CREATE TYPE public.sync_status AS ENUM ('running', 'success', 'error');

-- =============================================================================
--  D I M E N S Õ E S
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.empresa
-- Fonte: ListarEmpresas — 1 registro por app_key Omie
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.empresa (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key             VARCHAR(20)   NOT NULL,
    codigo_empresa_omie BIGINT        NOT NULL,
    cnpj                VARCHAR(20)   NOT NULL,
    razao_social        VARCHAR(60)   NOT NULL,
    nome_fantasia       VARCHAR(60),
    estado              VARCHAR(2),
    cidade              VARCHAR(40),
    regime_tributario    VARCHAR(1),
    optante_simples     VARCHAR(1),
    inativa             VARCHAR(1)    DEFAULT 'N',
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_empresa_omie)
);
COMMENT ON TABLE dim.empresa IS 'Cadastro de empresas Omie vinculadas ao BI. Uma linha por app_key.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.banco
-- Fonte: ListarBancos — tabela de domínio (independe de empresa)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.banco (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_banco    VARCHAR(3)    NOT NULL UNIQUE,
    nome            VARCHAR(40)   NOT NULL,
    tipo            VARCHAR(2),      -- CB, CX, CV, AC
    cod_compensacao VARCHAR(3),
    cod_ispb        VARCHAR(8),
    integra_pix     VARCHAR(1)    DEFAULT 'N',
    integra_boleto  VARCHAR(1)    DEFAULT 'N',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE dim.banco IS 'Instituições financeiras cadastradas na Omie. Dimensão global (não depende de app_key).';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.conta_corrente
-- Fonte: ListarContasCorrentes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.conta_corrente (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)   NOT NULL,
    codigo_cc_omie          BIGINT        NOT NULL,  -- nCodCC
    codigo_integracao       VARCHAR(20),              -- cCodCCInt
    descricao               VARCHAR(40)   NOT NULL,
    codigo_banco            VARCHAR(3),               -- FK lógica dim.banco
    agencia                 VARCHAR(10),
    numero_conta            VARCHAR(25),
    tipo_conta_corrente     VARCHAR(2),               -- CB, CX, CV, AC
    visivel_fluxo_caixa     VARCHAR(1)    DEFAULT 'S',
    visivel_resumo          VARCHAR(1)    DEFAULT 'S',
    saldo_inicial           NUMERIC(15,2) DEFAULT 0,
    inativa                 VARCHAR(1)    DEFAULT 'N',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_cc_omie)
);
CREATE INDEX idx_cc_banco ON dim.conta_corrente (codigo_banco);
COMMENT ON TABLE dim.conta_corrente IS 'Contas correntes da empresa. Join com dim.banco por codigo_banco.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.cliente
-- Fonte: ListarClientes — clientes E fornecedores (Omie unifica)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.cliente (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)   NOT NULL,
    codigo_cliente_omie     BIGINT        NOT NULL,
    codigo_integracao       VARCHAR(60),
    razao_social            VARCHAR(60)   NOT NULL,
    nome_fantasia           VARCHAR(60),
    cnpj_cpf                VARCHAR(20),
    inscricao_estadual      VARCHAR(20),
    email                   VARCHAR(200),
    telefone                VARCHAR(20),
    cidade                  VARCHAR(40),
    estado                  VARCHAR(2),
    cep                     VARCHAR(9),
    pessoa_fisica           VARCHAR(1),   -- S/N
    inativo                 VARCHAR(1)    DEFAULT 'N',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_cliente_omie)
);
CREATE INDEX idx_cliente_cnpj ON dim.cliente (cnpj_cpf);
CREATE INDEX idx_cliente_razao ON dim.cliente (razao_social);
COMMENT ON TABLE dim.cliente IS 'Clientes e fornecedores unificados. Na Omie, a mesma entidade pode ser ambos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.dre
-- Fonte: ListarCadastroDRE — precisa ser carregada ANTES de dim.categoria
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.dre (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key         VARCHAR(20)   NOT NULL,
    codigo_dre      VARCHAR(10)   NOT NULL,
    descricao       VARCHAR(40)   NOT NULL,
    nivel           INTEGER       NOT NULL,
    sinal           VARCHAR(1),      -- + ou -
    totalizadora    VARCHAR(1)    DEFAULT 'N',
    nao_exibir      VARCHAR(1)    DEFAULT 'N',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_dre)
);
COMMENT ON TABLE dim.dre IS 'Plano de contas DRE. Hierarquia via nivel. Join com dim.categoria por codigo_dre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.categoria
-- Fonte: ListarCategorias — hierarquia pai/filho via categoria_superior
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.categoria (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)   NOT NULL,
    codigo                  VARCHAR(20)   NOT NULL,  -- ex: "1.01.02"
    descricao               VARCHAR(50)   NOT NULL,
    descricao_padrao        VARCHAR(50),
    categoria_superior      VARCHAR(20),             -- FK lógica (self-ref)
    tipo_categoria          VARCHAR(3),              -- código do tipo
    codigo_dre              VARCHAR(10),             -- FK lógica dim.dre
    conta_receita           VARCHAR(1)    DEFAULT 'N',
    conta_despesa           VARCHAR(1)    DEFAULT 'N',
    totalizadora            VARCHAR(1)    DEFAULT 'N',
    transferencia           VARCHAR(1)    DEFAULT 'N',
    conta_inativa           VARCHAR(1)    DEFAULT 'N',
    nao_exibir              VARCHAR(1)    DEFAULT 'N',
    definida_pelo_usuario   VARCHAR(1)    DEFAULT 'N',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo)
);
CREATE INDEX idx_categoria_superior ON dim.categoria (app_key, categoria_superior);
CREATE INDEX idx_categoria_dre      ON dim.categoria (app_key, codigo_dre);
COMMENT ON TABLE dim.categoria IS 'Categorias financeiras (plano de contas). 1.x=receita, 2.x=despesa. Hierárquica via categoria_superior.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.departamento
-- Fonte: ListarDepartamentos — centro de custo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.departamento (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key             VARCHAR(20)   NOT NULL,
    codigo              VARCHAR(40)   NOT NULL,
    descricao           VARCHAR(50)   NOT NULL,
    inativo             VARCHAR(1)    DEFAULT 'N',
    nivel_totalizador   VARCHAR(1)    DEFAULT 'N',
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo)
);
COMMENT ON TABLE dim.departamento IS 'Departamentos / centros de custo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.origem
-- Fonte: ListarOrigem — tipos de origem de lançamento (VENR, MANP, NFER…)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.origem (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(4)    NOT NULL UNIQUE,
    descricao   VARCHAR(50)   NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE dim.origem IS 'Origens de lançamento financeiro. Dimensão global.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.tipo_documento
-- Fonte: PesquisarTipoDocumento (cache) — BOL, PIX, DIN, TED, etc.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.tipo_documento (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(5)    NOT NULL UNIQUE,
    descricao   VARCHAR(50)   NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE dim.tipo_documento IS 'Tipos de documento financeiro. Cache construído a partir dos títulos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.parcela
-- Fonte: ListarParcelas — condições de pagamento
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.parcela (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_parcela  VARCHAR(3)    NOT NULL UNIQUE,
    descricao       VARCHAR(30)   NOT NULL,
    num_parcelas    INTEGER       NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE dim.parcela IS 'Condições de parcelamento cadastradas na Omie.';

-- ─────────────────────────────────────────────────────────────────────────────
-- dim.tipo_conta_corrente (opcional, se quiser dimensão separada)
-- Fonte: ListarTiposCC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dim.tipo_conta_corrente (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(2)    NOT NULL UNIQUE,
    descricao   VARCHAR(40)   NOT NULL,
    grupo       VARCHAR(2),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE dim.tipo_conta_corrente IS 'Tipos de conta corrente (CB, CX, CV, AC). Dimensão pequena e estável.';


-- =============================================================================
--  F A T O S
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.titulo
-- Fonte primária: PesquisarLancamentos → cabecTitulo
-- Incremental: ListarContasReceber / ListarContasPagar
-- Granularidade: 1 linha = 1 título (parcela) financeiro
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.titulo (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)       NOT NULL,

    -- Chaves naturais Omie
    codigo_titulo_omie      BIGINT            NOT NULL,  -- nCodTitulo
    codigo_integracao       VARCHAR(60),                  -- cCodIntTitulo

    -- Natureza e status
    natureza                public.natureza_titulo NOT NULL,  -- R ou P
    status                  public.status_titulo   NOT NULL,

    -- Dimensões (FK lógicas — join por NK, não por surrogate)
    codigo_cliente_omie     BIGINT,                       -- → dim.cliente
    codigo_cc_omie          BIGINT,                       -- → dim.conta_corrente
    codigo_categoria        VARCHAR(20),                  -- → dim.categoria
    codigo_tipo_documento   VARCHAR(5),                   -- → dim.tipo_documento
    codigo_origem           VARCHAR(4),                   -- → dim.origem
    codigo_departamento     VARCHAR(40),                  -- → dim.departamento (se rateio único)
    codigo_projeto          BIGINT,
    codigo_vendedor         BIGINT,
    codigo_comprador        BIGINT,
    codigo_contrato_omie    BIGINT,
    codigo_pedido_omie      BIGINT,
    codigo_nf_omie          BIGINT,
    operacao                VARCHAR(2),                   -- 01, 11, 12…

    -- Documentos
    numero_titulo           VARCHAR(20),                  -- cNumTitulo (visível)
    numero_documento        VARCHAR(20),
    numero_documento_fiscal VARCHAR(20),
    numero_parcela          VARCHAR(7),                   -- 001/003
    numero_boleto           VARCHAR(30),
    chave_nfe               VARCHAR(44),
    codigo_barras           VARCHAR(70),

    -- Datas
    data_emissao            DATE,
    data_vencimento         DATE              NOT NULL,
    data_previsao           DATE,
    data_pagamento          DATE,
    data_registro           DATE,
    data_cancelamento       DATE,

    -- Valores (2 casas; financeiro brasileiro)
    valor_titulo            NUMERIC(15,2)     NOT NULL DEFAULT 0,
    valor_pis               NUMERIC(15,2)     DEFAULT 0,
    valor_cofins            NUMERIC(15,2)     DEFAULT 0,
    valor_csll              NUMERIC(15,2)     DEFAULT 0,
    valor_ir                NUMERIC(15,2)     DEFAULT 0,
    valor_iss               NUMERIC(15,2)     DEFAULT 0,
    valor_inss              NUMERIC(15,2)     DEFAULT 0,

    -- Flags de retenção (S/N)
    retem_pis               VARCHAR(1)        DEFAULT 'N',
    retem_cofins            VARCHAR(1)        DEFAULT 'N',
    retem_csll              VARCHAR(1)        DEFAULT 'N',
    retem_ir                VARCHAR(1)        DEFAULT 'N',
    retem_iss               VARCHAR(1)        DEFAULT 'N',
    retem_inss              VARCHAR(1)        DEFAULT 'N',

    -- Resumo de baixa (desnormalizado para performance de BI)
    liquidado               VARCHAR(1)        DEFAULT 'N',
    valor_pago              NUMERIC(15,2)     DEFAULT 0,
    valor_aberto            NUMERIC(15,2)     DEFAULT 0,
    total_desconto          NUMERIC(15,2)     DEFAULT 0,
    total_juros             NUMERIC(15,2)     DEFAULT 0,
    total_multa             NUMERIC(15,2)     DEFAULT 0,
    valor_liquido           NUMERIC(15,2)     DEFAULT 0,

    -- Observações
    observacao              TEXT,

    -- Auditoria Omie (vem com lDadosCad=true)
    omie_inclusao_data      DATE,
    omie_inclusao_hora      VARCHAR(8),
    omie_inclusao_usuario   VARCHAR(10),
    omie_alteracao_data     DATE,
    omie_alteracao_hora     VARCHAR(8),
    omie_alteracao_usuario  VARCHAR(10),
    importado_api           VARCHAR(1)        DEFAULT 'N',

    -- Controle ETL
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    synced_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    UNIQUE (app_key, codigo_titulo_omie)
);

-- Índices pensados para as queries do dashboard
CREATE INDEX idx_titulo_natureza_status   ON fato.titulo (app_key, natureza, status);
CREATE INDEX idx_titulo_vencimento        ON fato.titulo (app_key, data_vencimento);
CREATE INDEX idx_titulo_cliente           ON fato.titulo (app_key, codigo_cliente_omie);
CREATE INDEX idx_titulo_categoria         ON fato.titulo (app_key, codigo_categoria);
CREATE INDEX idx_titulo_cc                ON fato.titulo (app_key, codigo_cc_omie);
CREATE INDEX idx_titulo_emissao           ON fato.titulo (app_key, data_emissao);
CREATE INDEX idx_titulo_pagamento         ON fato.titulo (app_key, data_pagamento) WHERE data_pagamento IS NOT NULL;
CREATE INDEX idx_titulo_omie_alteracao    ON fato.titulo (app_key, omie_alteracao_data) WHERE omie_alteracao_data IS NOT NULL;
CREATE INDEX idx_titulo_aberto_venc       ON fato.titulo (app_key, natureza, data_vencimento)
  WHERE valor_aberto > 0 AND status NOT IN ('CANCELADO','RECEBIDO','PAGO','LIQUIDADO');
CREATE INDEX idx_titulo_atrasado          ON fato.titulo (app_key, natureza)
  WHERE status = 'ATRASADO';

COMMENT ON TABLE fato.titulo IS 'Fato principal: títulos a pagar e a receber com resumo de baixa desnormalizado. 1 linha por parcela.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.titulo_rateio_categoria
-- Normalização do rateio de categorias (N categorias por título)
-- Fonte: cabecTitulo.aCodCateg[] ou conta_receber_cadastro.categorias[]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.titulo_rateio_categoria (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)   NOT NULL,
    codigo_titulo_omie      BIGINT        NOT NULL,  -- FK → fato.titulo
    codigo_categoria        VARCHAR(20)   NOT NULL,  -- FK → dim.categoria
    valor                   NUMERIC(15,2) NOT NULL DEFAULT 0,
    percentual              NUMERIC(7,4)  NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_titulo_omie, codigo_categoria)
);
CREATE INDEX idx_rateio_cat_titulo ON fato.titulo_rateio_categoria (app_key, codigo_titulo_omie);
COMMENT ON TABLE fato.titulo_rateio_categoria IS 'Rateio de categorias por título. Só populada quando há mais de 1 categoria.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.titulo_rateio_departamento
-- Normalização do rateio de departamentos (N departamentos por título)
-- Fonte: cabecTitulo.departamentos[] ou distribuicao[]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.titulo_rateio_departamento (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)   NOT NULL,
    codigo_titulo_omie      BIGINT        NOT NULL,
    codigo_departamento     VARCHAR(40)   NOT NULL,  -- FK → dim.departamento
    valor                   NUMERIC(15,2) NOT NULL DEFAULT 0,
    percentual              NUMERIC(7,4)  NOT NULL DEFAULT 0,
    valor_fixo              VARCHAR(1)    DEFAULT 'N',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_titulo_omie, codigo_departamento)
);
CREATE INDEX idx_rateio_dep_titulo ON fato.titulo_rateio_departamento (app_key, codigo_titulo_omie);
COMMENT ON TABLE fato.titulo_rateio_departamento IS 'Rateio de departamentos por título.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.baixa
-- Fonte: PesquisarLancamentos → lancamentos[] dentro de cada título
-- Granularidade: 1 linha = 1 evento de pagamento/recebimento
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.baixa (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)       NOT NULL,
    codigo_titulo_omie      BIGINT            NOT NULL,  -- FK → fato.titulo
    codigo_baixa_omie       BIGINT            NOT NULL,  -- nCodLanc
    codigo_integracao_baixa VARCHAR(20),                  -- cCodIntLanc
    codigo_lancamento_cc    BIGINT,                       -- nIdLancCC

    -- Dimensões da baixa
    codigo_cc_omie          BIGINT,                       -- conta onde caiu
    natureza                public.natureza_titulo,

    -- Valores
    data_baixa              DATE              NOT NULL,
    valor_baixa             NUMERIC(15,2)     NOT NULL DEFAULT 0,
    desconto                NUMERIC(15,2)     DEFAULT 0,
    juros                   NUMERIC(15,2)     DEFAULT 0,
    multa                   NUMERIC(15,2)     DEFAULT 0,

    observacao              TEXT,

    -- Controle ETL
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    synced_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    UNIQUE (app_key, codigo_titulo_omie, codigo_baixa_omie)
);
CREATE INDEX idx_baixa_titulo  ON fato.baixa (app_key, codigo_titulo_omie);
CREATE INDEX idx_baixa_data    ON fato.baixa (app_key, data_baixa);
CREATE INDEX idx_baixa_cc      ON fato.baixa (app_key, codigo_cc_omie);
COMMENT ON TABLE fato.baixa IS 'Eventos de pagamento/recebimento de títulos. N baixas por título (parcial + liquidação).';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.extrato_movimento
-- Fonte: ListarExtrato → listaMovimentos[] (por CC × período)
-- Granularidade: 1 linha = 1 lançamento no extrato bancário
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.extrato_movimento (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)       NOT NULL,
    codigo_cc_omie          BIGINT            NOT NULL,  -- conta corrente

    codigo_lancamento       BIGINT            NOT NULL,  -- nCodLancamento
    codigo_lancamento_relac BIGINT,                      -- parcelamento original
    situacao                VARCHAR(40),
    data_lancamento         DATE              NOT NULL,
    natureza                VARCHAR(1),                   -- E(ntrada)/S(aída) via cNatureza

    -- Partes
    codigo_cliente_omie     BIGINT,
    nome_cliente            VARCHAR(100),
    razao_social_cliente    VARCHAR(60),
    cnpj_cpf_cliente        VARCHAR(20),

    -- Documento
    tipo_documento          VARCHAR(50),
    numero_documento        VARCHAR(20),
    numero_documento_fiscal VARCHAR(20),
    numero_parcela          VARCHAR(7),
    nosso_numero            VARCHAR(30),
    codigo_categoria        VARCHAR(20),
    descricao_categoria     VARCHAR(350),
    origem                  VARCHAR(50),
    vendedor                VARCHAR(70),
    projeto                 VARCHAR(70),

    -- Valores
    valor_documento         NUMERIC(15,2)     NOT NULL DEFAULT 0,
    saldo_realizado         NUMERIC(15,2)     DEFAULT 0,
    saldo_previsto          NUMERIC(15,2)     DEFAULT 0,

    -- Conciliação
    data_conciliacao        DATE,
    bloqueado               VARCHAR(1)        DEFAULT 'N',

    -- Auditoria
    data_inclusao           DATE,
    hora_inclusao           VARCHAR(8),
    observacoes             TEXT,

    -- Controle ETL
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    synced_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    UNIQUE (app_key, codigo_cc_omie, codigo_lancamento)
);
CREATE INDEX idx_extrato_cc_data    ON fato.extrato_movimento (app_key, codigo_cc_omie, data_lancamento);
CREATE INDEX idx_extrato_cliente    ON fato.extrato_movimento (app_key, codigo_cliente_omie) WHERE codigo_cliente_omie IS NOT NULL;
CREATE INDEX idx_extrato_categoria  ON fato.extrato_movimento (app_key, codigo_categoria);
COMMENT ON TABLE fato.extrato_movimento IS 'Movimentações do extrato bancário. Saldo running por conta.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.saldo_conta_corrente
-- Snapshot diário de saldos por CC (extraído do header do ListarExtrato)
-- Granularidade: 1 linha = 1 conta × 1 data
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.saldo_conta_corrente (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)       NOT NULL,
    codigo_cc_omie          BIGINT            NOT NULL,
    data_referencia         DATE              NOT NULL,
    saldo_anterior          NUMERIC(15,2)     DEFAULT 0,
    saldo_anterior_previsto NUMERIC(15,2)     DEFAULT 0,
    saldo_atual             NUMERIC(15,2)     DEFAULT 0,
    saldo_atual_previsto    NUMERIC(15,2)     DEFAULT 0,
    saldo_conciliado        NUMERIC(15,2)     DEFAULT 0,
    saldo_provisorio        NUMERIC(15,2)     DEFAULT 0,
    limite_credito_total    NUMERIC(15,2)     DEFAULT 0,
    saldo_disponivel        NUMERIC(15,2)     DEFAULT 0,
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, codigo_cc_omie, data_referencia)
);
CREATE INDEX idx_saldo_cc_lookup ON fato.saldo_conta_corrente (app_key, codigo_cc_omie, data_referencia DESC);
COMMENT ON TABLE fato.saldo_conta_corrente IS 'Snapshot de saldos por conta corrente. 1 foto por CC por dia.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.orcamento_caixa
-- Fonte: ListarOrcamentos (ano/mês × categoria)
-- Granularidade: 1 linha = 1 categoria × 1 mês
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.orcamento_caixa (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key             VARCHAR(20)       NOT NULL,
    ano                 SMALLINT          NOT NULL,
    mes                 SMALLINT          NOT NULL CHECK (mes BETWEEN 1 AND 12),
    codigo_categoria    VARCHAR(20)       NOT NULL,
    descricao_categoria TEXT,
    valor_previsto      NUMERIC(15,2)     DEFAULT 0,
    valor_realizado     NUMERIC(15,2)     DEFAULT 0,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, ano, mes, codigo_categoria)
);
COMMENT ON TABLE fato.orcamento_caixa IS 'Orçamento de caixa: previsto × realizado por categoria/mês.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.resumo_snapshot
-- Fonte: ObterResumoFinancas — snapshot diário dos KPIs prontos da Omie
-- Granularidade: 1 linha = 1 data × app_key (usado para reconciliação)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.resumo_snapshot (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                     VARCHAR(20)       NOT NULL,
    data_referencia             DATE              NOT NULL,

    -- Saldo contas correntes
    cc_saldo_total              NUMERIC(15,2)     DEFAULT 0,
    cc_limite_credito           NUMERIC(15,2)     DEFAULT 0,

    -- Contas a receber
    ar_qtd_titulos              INTEGER           DEFAULT 0,
    ar_valor_total              NUMERIC(15,2)     DEFAULT 0,
    ar_valor_atraso             NUMERIC(15,2)     DEFAULT 0,

    -- Contas a pagar
    ap_qtd_titulos              INTEGER           DEFAULT 0,
    ap_valor_total              NUMERIC(15,2)     DEFAULT 0,
    ap_valor_atraso             NUMERIC(15,2)     DEFAULT 0,

    -- Fluxo de caixa (do dia)
    fluxo_pagar                 NUMERIC(15,2)     DEFAULT 0,
    fluxo_receber               NUMERIC(15,2)     DEFAULT 0,
    fluxo_saldo                 NUMERIC(15,2)     DEFAULT 0,

    created_at                  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, data_referencia)
);
COMMENT ON TABLE fato.resumo_snapshot IS 'KPIs consolidados da Omie. Snapshot diário para home e reconciliação com nossos fatos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- fato.resumo_snapshot_categoria
-- Detalhamento do resumo por categoria (AR e AP)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fato.resumo_snapshot_categoria (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resumo_snapshot_id  BIGINT            NOT NULL REFERENCES fato.resumo_snapshot(id) ON DELETE CASCADE,
    natureza            public.natureza_titulo NOT NULL,
    codigo_categoria    VARCHAR(20)       NOT NULL,
    descricao_categoria TEXT,
    qtd_titulos         INTEGER           DEFAULT 0,
    valor_total         NUMERIC(15,2)     DEFAULT 0,
    UNIQUE (resumo_snapshot_id, natureza, codigo_categoria)
);
COMMENT ON TABLE fato.resumo_snapshot_categoria IS 'Detalhe por categoria do snapshot de resumo.';


-- =============================================================================
--  S T A G I N G
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- stg.api_response
-- JSON bruto de cada chamada à API (rastreabilidade + reprocessamento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE stg.api_response (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key         VARCHAR(20)   NOT NULL,
    endpoint        VARCHAR(100)  NOT NULL,    -- ex: financas/pesquisartitulos
    metodo          VARCHAR(50)   NOT NULL,    -- ex: PesquisarLancamentos
    pagina          INTEGER       NOT NULL DEFAULT 1,
    total_paginas   INTEGER,
    total_registros INTEGER,
    payload         JSONB         NOT NULL,    -- corpo bruto da resposta
    synced_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    processado      BOOLEAN       NOT NULL DEFAULT FALSE,
    erro            TEXT
);
CREATE INDEX idx_stg_endpoint       ON stg.api_response (app_key, endpoint, metodo, synced_at DESC);
CREATE INDEX idx_stg_nao_processado ON stg.api_response (processado) WHERE processado = FALSE;
COMMENT ON TABLE stg.api_response IS 'Staging: JSON bruto de cada página da API. Permite replay e debug.';


-- =============================================================================
--  O P E R A C I O N A L
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ops.sync_log
-- Log de cada job de sincronização (por endpoint/método)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ops.sync_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key         VARCHAR(20)       NOT NULL,
    endpoint        VARCHAR(100)      NOT NULL,
    metodo          VARCHAR(50)       NOT NULL,
    tipo_sync       VARCHAR(20)       NOT NULL DEFAULT 'full',  -- full, incremental, snapshot
    status          public.sync_status NOT NULL DEFAULT 'running',
    paginas_total   INTEGER           DEFAULT 0,
    registros_total INTEGER           DEFAULT 0,
    registros_novos INTEGER           DEFAULT 0,
    registros_atualizados INTEGER     DEFAULT 0,
    erro_mensagem   TEXT,
    erro_detalhes   JSONB,
    started_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    duracao_ms      INTEGER GENERATED ALWAYS AS (
        CASE WHEN finished_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (finished_at - started_at))::INTEGER * 1000
             ELSE NULL
        END
    ) STORED
);
CREATE INDEX idx_sync_log_app_endpoint ON ops.sync_log (app_key, endpoint, started_at DESC);
CREATE INDEX idx_sync_log_status       ON ops.sync_log (status) WHERE status = 'running';
COMMENT ON TABLE ops.sync_log IS 'Log de cada execução de sync. Para monitorar saúde da ingestão.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ops.reconciliacao
-- Comparação periódica: totais da Omie (resumo) vs totais do nosso BI
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ops.reconciliacao (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_key                 VARCHAR(20)       NOT NULL,
    data_referencia         DATE              NOT NULL,
    metrica                 VARCHAR(50)       NOT NULL,  -- ex: 'ar_valor_total', 'ap_valor_atraso', 'cc_saldo'
    valor_omie              NUMERIC(15,2)     NOT NULL,  -- vem do resumo
    valor_bi                NUMERIC(15,2)     NOT NULL,  -- calculado dos fatos
    diferenca               NUMERIC(15,2)     GENERATED ALWAYS AS (valor_omie - valor_bi) STORED,
    diferenca_percentual    NUMERIC(12,4)     GENERATED ALWAYS AS (
        CASE WHEN valor_omie <> 0
             THEN ((valor_omie - valor_bi) / valor_omie) * 100
             ELSE 0
        END
    ) STORED,
    toleravel               BOOLEAN           GENERATED ALWAYS AS (
        ABS(valor_omie - valor_bi) < 0.01
    ) STORED,
    created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE (app_key, data_referencia, metrica)
);
CREATE INDEX idx_reconciliacao_diverge ON ops.reconciliacao (app_key, data_referencia)
    WHERE toleravel = FALSE;
COMMENT ON TABLE ops.reconciliacao IS 'Divergências entre totais da Omie e totais calculados no BI. Alarme quando toleravel=FALSE.';


-- =============================================================================
--  F U N Ç Õ E S   U T I L I T Á R I A S
-- =============================================================================

-- Trigger genérico de updated_at
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger em todas as tabelas que têm updated_at
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('dim', 'fato')
          AND tablename IN (
              SELECT table_name FROM information_schema.columns
              WHERE column_name = 'updated_at'
                AND table_schema IN ('dim', 'fato')
          )
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at()',
            r.tablename, r.schemaname, r.tablename
        );
    END LOOP;
END;
$$;


-- =============================================================================
--  V I E W S   A N A L Í T I C A S   (para o dashboard)
-- =============================================================================

-- Aging de contas a receber
CREATE OR REPLACE VIEW fato.vw_aging_receber AS
SELECT
    t.app_key,
    t.codigo_cliente_omie,
    c.razao_social,
    c.cnpj_cpf,
    t.codigo_categoria,
    t.data_vencimento,
    t.valor_aberto,
    CURRENT_DATE - t.data_vencimento AS dias_atraso,
    CASE
        WHEN CURRENT_DATE - t.data_vencimento <= 0  THEN '0_a_vencer'
        WHEN CURRENT_DATE - t.data_vencimento <= 7  THEN '1_ate_7d'
        WHEN CURRENT_DATE - t.data_vencimento <= 15 THEN '2_ate_15d'
        WHEN CURRENT_DATE - t.data_vencimento <= 30 THEN '3_ate_30d'
        WHEN CURRENT_DATE - t.data_vencimento <= 60 THEN '4_ate_60d'
        ELSE '5_acima_60d'
    END AS faixa_aging
FROM fato.titulo t
LEFT JOIN dim.cliente c ON c.app_key = t.app_key AND c.codigo_cliente_omie = t.codigo_cliente_omie
WHERE t.natureza = 'R'
  AND t.status NOT IN ('CANCELADO', 'RECEBIDO', 'LIQUIDADO')
  AND t.valor_aberto > 0;

COMMENT ON VIEW fato.vw_aging_receber IS 'Aging de inadimplência de contas a receber. Usado na tela AR e home.';

-- Aging de contas a pagar
CREATE OR REPLACE VIEW fato.vw_aging_pagar AS
SELECT
    t.app_key,
    t.codigo_cliente_omie,
    c.razao_social,
    c.cnpj_cpf,
    t.codigo_categoria,
    t.data_vencimento,
    t.valor_aberto,
    CURRENT_DATE - t.data_vencimento AS dias_atraso,
    CASE
        WHEN CURRENT_DATE - t.data_vencimento <= 0  THEN '0_a_vencer'
        WHEN CURRENT_DATE - t.data_vencimento <= 7  THEN '1_ate_7d'
        WHEN CURRENT_DATE - t.data_vencimento <= 15 THEN '2_ate_15d'
        WHEN CURRENT_DATE - t.data_vencimento <= 30 THEN '3_ate_30d'
        WHEN CURRENT_DATE - t.data_vencimento <= 60 THEN '4_ate_60d'
        ELSE '5_acima_60d'
    END AS faixa_aging
FROM fato.titulo t
LEFT JOIN dim.cliente c ON c.app_key = t.app_key AND c.codigo_cliente_omie = t.codigo_cliente_omie
WHERE t.natureza = 'P'
  AND t.status NOT IN ('CANCELADO', 'PAGO', 'LIQUIDADO')
  AND t.valor_aberto > 0;

COMMENT ON VIEW fato.vw_aging_pagar IS 'Aging de contas a pagar. Usado na tela AP e home.';

-- Fluxo de caixa projetado (títulos abertos agrupados por dia)
CREATE OR REPLACE VIEW fato.vw_fluxo_caixa_projetado AS
SELECT
    app_key,
    data_vencimento AS data,
    natureza,
    COUNT(*)             AS qtd_titulos,
    SUM(valor_aberto)    AS valor_total
FROM fato.titulo
WHERE status NOT IN ('CANCELADO', 'PAGO', 'RECEBIDO', 'LIQUIDADO')
  AND valor_aberto > 0
  AND data_vencimento >= CURRENT_DATE
GROUP BY app_key, data_vencimento, natureza;

COMMENT ON VIEW fato.vw_fluxo_caixa_projetado IS 'Fluxo projetado: títulos abertos agregados por dia e natureza.';

-- Fluxo de caixa realizado (baixas agrupadas por dia)
CREATE OR REPLACE VIEW fato.vw_fluxo_caixa_realizado AS
SELECT
    b.app_key,
    b.data_baixa AS data,
    b.natureza,
    COUNT(*)                AS qtd_baixas,
    SUM(b.valor_baixa)      AS valor_bruto,
    SUM(b.desconto)         AS total_desconto,
    SUM(b.juros)            AS total_juros,
    SUM(b.multa)            AS total_multa,
    SUM(b.valor_baixa - b.desconto + b.juros + b.multa) AS valor_liquido
FROM fato.baixa b
GROUP BY b.app_key, b.data_baixa, b.natureza;

COMMENT ON VIEW fato.vw_fluxo_caixa_realizado IS 'Fluxo realizado: baixas agregadas por dia e natureza.';


-- =============================================================================
--  P L A T A F O R M A  (auth + cadastro de aplicativos)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
    CREATE TYPE auth.papel AS ENUM ('admin', 'interno', 'cliente');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE ops.aplicativo (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apelido                 VARCHAR(80)   NOT NULL,
    razao_social_cache      VARCHAR(120),
    app_key                 VARCHAR(40)   NOT NULL UNIQUE,
    app_secret_encrypted    TEXT          NOT NULL,
    ativo                   BOOLEAN       NOT NULL DEFAULT TRUE,
    sync_habilitado         BOOLEAN       NOT NULL DEFAULT TRUE,
    ultima_sync_at          TIMESTAMPTZ,
    ultima_sync_status      public.sync_status,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE auth.usuario (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome                VARCHAR(120)  NOT NULL,
    email               VARCHAR(200)  NOT NULL UNIQUE,
    senha_hash          VARCHAR(200)  NOT NULL,
    papel               auth.papel    NOT NULL DEFAULT 'cliente',
    ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
    deve_trocar_senha   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ
);

CREATE TABLE auth.usuario_aplicativo (
    usuario_id      BIGINT NOT NULL REFERENCES auth.usuario(id) ON DELETE CASCADE,
    aplicativo_id   BIGINT NOT NULL REFERENCES ops.aplicativo(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, aplicativo_id)
);

CREATE INDEX idx_aplicativo_ativo ON ops.aplicativo (ativo) WHERE ativo;
CREATE INDEX idx_usuario_aplicativo_app ON auth.usuario_aplicativo (aplicativo_id);

CREATE TRIGGER trg_aplicativo_updated_at
    BEFORE UPDATE ON ops.aplicativo
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

COMMIT;
