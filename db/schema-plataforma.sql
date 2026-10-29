-- Plataforma: aplicativos Omie, usuários e permissões.
-- Idempotente — pode rodar em banco que já tem o schema analítico.

BEGIN;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE auth.papel AS ENUM ('admin', 'interno', 'cliente');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ops.aplicativo (
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
COMMENT ON TABLE ops.aplicativo IS 'Aplicativos Omie cadastrados na plataforma. app_secret só em texto cifrado.';

CREATE TABLE IF NOT EXISTS auth.usuario (
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
COMMENT ON TABLE auth.usuario IS 'Usuários da plataforma (Costa Novaes e clientes).';

CREATE TABLE IF NOT EXISTS auth.usuario_aplicativo (
    usuario_id      BIGINT NOT NULL REFERENCES auth.usuario(id) ON DELETE CASCADE,
    aplicativo_id   BIGINT NOT NULL REFERENCES ops.aplicativo(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, aplicativo_id)
);
COMMENT ON TABLE auth.usuario_aplicativo IS 'Vínculo cliente↔aplicativo. Admin/interno sem linhas = acesso a todos os ativos.';

CREATE INDEX IF NOT EXISTS idx_aplicativo_ativo ON ops.aplicativo (ativo) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_usuario_email ON auth.usuario (email);
CREATE INDEX IF NOT EXISTS idx_usuario_aplicativo_app ON auth.usuario_aplicativo (aplicativo_id);

CREATE TABLE IF NOT EXISTS ops.sync_job (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aplicativo_id       BIGINT REFERENCES ops.aplicativo(id) ON DELETE SET NULL,
    app_key             VARCHAR(40),
    origem              VARCHAR(20)   NOT NULL DEFAULT 'manual',
    solicitado_por      BIGINT REFERENCES auth.usuario(id) ON DELETE SET NULL,
    status              VARCHAR(20)   NOT NULL DEFAULT 'queued',
    erro                TEXT,
    report              JSONB,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sync_job_created ON ops.sync_job (created_at DESC);
COMMENT ON TABLE ops.sync_job IS 'Fila de cargas Omie disparadas pelo admin, cron Vercel ou GitHub Action.';

-- Papel com acesso de admin + ferramentas internas (Qualidade & Sync).
ALTER TYPE auth.papel ADD VALUE IF NOT EXISTS 'desenvolvedor';

-- Telas desligadas por empresa (ids de web/src/lib/modulos.ts). Vazio = tudo ligado.
ALTER TABLE ops.aplicativo ADD COLUMN IF NOT EXISTS modulos_desativados TEXT[] NOT NULL DEFAULT '{}';

DROP TRIGGER IF EXISTS trg_aplicativo_updated_at ON ops.aplicativo;
CREATE TRIGGER trg_aplicativo_updated_at
    BEFORE UPDATE ON ops.aplicativo
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

COMMIT;
