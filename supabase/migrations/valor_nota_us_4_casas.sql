-- Valor da nota passa a ser em US (unidade interna, não é moeda), com até 4 casas decimais (ex.: 0,119)
-- Rodar manualmente no SQL Editor do Supabase ANTES de publicar o site.
-- Só amplia a precisão da coluna (NUMERIC 12,2 -> 14,4): os valores já gravados não mudam.
-- ATENÇÃO: valores gravados antes desta mudança foram digitados em reais (R$); conferir/corrigir à mão.
-- Pode ser executada mais de uma vez sem erro.

ALTER TABLE servicos
  ALTER COLUMN valor_nota TYPE NUMERIC(14,4);
