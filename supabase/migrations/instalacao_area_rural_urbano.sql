-- Instalações: área do vão (rural ou urbano), escolhida no "Novo serviço"
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Pedido de Matheus (18/11/2026): tudo o que já foi lançado conta como RURAL.
-- O DEFAULT 'rural' preenche todos os vãos existentes ao criar a coluna.

ALTER TABLE vaos
  ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT 'rural';

-- Garantia caso a coluna já existisse sem valor
UPDATE vaos SET area = 'rural' WHERE area IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vaos_area_check'
      AND conrelid = 'public.vaos'::regclass
  ) THEN
    ALTER TABLE vaos
      ADD CONSTRAINT vaos_area_check
      CHECK (area IN ('rural', 'urbano'));
  END IF;
END $$;
