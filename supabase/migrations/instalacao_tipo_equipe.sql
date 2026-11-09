-- Instalações: tipo de equipe do vão (UMPLA, DUPLA ou MOTO), obrigatório só no "Novo serviço"
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Só ACRESCENTA: não altera nem remove dados. Registros antigos ficam com tipo_equipe NULL.

ALTER TABLE vaos
  ADD COLUMN IF NOT EXISTS tipo_equipe TEXT;

-- CHECK criada de forma segura (idempotente): só entra se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vaos_tipo_equipe_check'
      AND conrelid = 'public.vaos'::regclass
  ) THEN
    ALTER TABLE vaos
      ADD CONSTRAINT vaos_tipo_equipe_check
      CHECK (tipo_equipe IS NULL OR tipo_equipe IN ('umpla', 'dupla', 'moto'));
  END IF;
END $$;
