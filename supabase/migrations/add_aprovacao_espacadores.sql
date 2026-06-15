-- Adicionar as colunas necessárias para o fluxo de aprovação de espaçadores
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS aprovacaoEspacador TEXT,
  ADD COLUMN IF NOT EXISTS dtAprovacaoEspacador TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprovadoPor JSONB,
  ADD COLUMN IF NOT EXISTS motivoReprovacaoEspacador TEXT;
