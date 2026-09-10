-- Adicionar coluna para marcar duplicidade de transformador como aceita/revisada
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS duplicidadeAceita BOOLEAN DEFAULT FALSE;
