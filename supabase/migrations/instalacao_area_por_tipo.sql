-- Correção de 18/11/2026 (Matheus): nos registros antigos, só a PODA DE ÁRVORE é rural; ESPAÇADOR é URBANO.
-- O script instalacao_area_rural_urbano.sql tinha posto todos como rural. Rodar no SQL Editor do Supabase.
--
-- Tipo = mesma regra do site (tipoServicoDe em src/lib/espacadores.js), pela descrição do serviço, sem acento:
--   espaçador: contém esp?ac?dor (até 2 letras entre as partes) → URBANO
--   poda: contém "poda" no começo de uma palavra e não é espaçador → RURAL
--   descrição desconhecida → tratada como espaçador → URBANO
-- Só mexe nos vãos criados ANTES de o site com a escolha rural/urbano ir ao ar (18/11/2026 13:16, horário de Brasília).
-- Os lançados depois disso tiveram a área escolhida na tela e ficam como estão.

-- 1) PRÉVIA (opcional): quantos vãos ficam com cada área
WITH tipo AS (
  SELECT v.id, v.area AS area_atual, v.criado_em,
    translate(lower(coalesce(s."desc", '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS d
  FROM vaos v JOIN servicos s ON s.id = v.servico_id
)
SELECT
  CASE WHEN d ~ 'esp.{0,2}ac.{0,2}dor' THEN 'espaçador'
       WHEN d ~ '\mpoda' THEN 'poda'
       ELSE 'desconhecido (= espaçador)' END AS tipo,
  area_atual,
  (criado_em < '2026-11-18 13:16:00-03') AS antigo,
  count(*)
FROM tipo GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

-- 2) CORREÇÃO
UPDATE vaos v
SET area = CASE
  WHEN t.d !~ 'esp.{0,2}ac.{0,2}dor' AND t.d ~ '\mpoda' THEN 'rural'
  ELSE 'urbano'
END
FROM (
  SELECT id, translate(lower(coalesce("desc", '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS d
  FROM servicos
) t
WHERE t.id = v.servico_id
  AND v.criado_em < '2026-11-18 13:16:00-03';
