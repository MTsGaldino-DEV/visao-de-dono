-- Instalações: equipe do vão (obrigatória na Nova instalação) e nº da apropriação (após a NSPR)
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Só ACRESCENTA: não altera nem remove dados.

ALTER TABLE vaos
  ADD COLUMN IF NOT EXISTS equipe TEXT;

ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS apropriacao TEXT;
