-- Etapa "SF" (SalesForce) no fluxo de instalação de espaçadores
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Só ACRESCENTA colunas e AMPLIA a lista de etapas aceitas: não altera dados.
-- Pode ser executada mais de uma vez sem erro.

-- 1. Data do lançamento no SalesForce e valor da nota
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS data_lancamento_sf DATE,
  ADD COLUMN IF NOT EXISTS valor_nota NUMERIC(12,2);

-- 2. Aceitar a etapa 'sf' em servicos.etapa_espacador (o nome da CHECK atual é descoberto aqui)
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'servicos'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%etapa_espacador%'
  LOOP
    EXECUTE format('ALTER TABLE servicos DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE servicos ADD CONSTRAINT servicos_etapa_espacador_check
  CHECK (etapa_espacador IN ('instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'sf', 'pago'));
