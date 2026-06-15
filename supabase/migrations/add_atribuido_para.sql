-- Adicionar colunas de atribuição na tabela servicos se não existirem
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS atribuido_para JSONB,
  ADD COLUMN IF NOT EXISTS dtAtribuicao TIMESTAMPTZ;

-- Habilitar realtime para a tabela servicos (normalmente já habilitado no seu projeto)
-- Mas para ter certeza que ela está na publicação supabase_realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE servicos;
