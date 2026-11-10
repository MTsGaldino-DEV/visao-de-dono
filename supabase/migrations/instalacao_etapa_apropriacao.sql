-- Etapa "Apropriação" (depois do SalesForce, antes do Pago) no fluxo de instalação
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Só AMPLIA a lista de etapas aceitas: não altera dados nem colunas.
-- Sem ele, informar data e valor da nota no SalesForce falha, porque o banco recusa a etapa 'apropriacao'.
-- Pode ser executada mais de uma vez sem erro.

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
  CHECK (etapa_espacador IN ('instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'sf', 'apropriacao', 'pago'));
