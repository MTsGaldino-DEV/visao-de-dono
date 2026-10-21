-- Limpeza das instalações de teste do fluxo antigo (vários vãos por serviço)
-- Rodar manualmente no SQL Editor do Supabase, DEPOIS de supabase/migrations/instalacao_um_vao.sql.

-- ─── PARTE 1: só leitura. Rode e confira quais IDs são de teste. ─────────────

SELECT id, equip, local, status, etapa_espacador, "desc", "numServ", nsmc, "dtCadastro"
FROM servicos
WHERE etapa_espacador IS NOT NULL
ORDER BY "dtCadastro";

SELECT servico_id, numero, array_length(fotos_antes, 1) AS fotos_antes,
       array_length(fotos_depois, 1) AS fotos_depois, croqui_url IS NOT NULL AS tem_croqui
FROM vaos
ORDER BY servico_id, numero;

-- ─── PARTE 2: apaga. Troque os IDs em todas as listas abaixo, tire os comentários e rode. ─
-- Os arquivos no bucket não são apagados (mesma regra do app).

-- BEGIN;
--
-- DELETE FROM vaos WHERE servico_id IN ('VD0000', 'VD0000', 'VD0000');
--
-- -- Serviços criados pela própria Nova instalação: cancelados
-- UPDATE servicos SET status = 'cancelado'
-- WHERE id IN ('VD0000', 'VD0000', 'VD0000') AND "desc" = 'Instalação de espaçador';
--
-- -- Serviços que já existiam (levantamentos reais): voltam para em aberto
-- UPDATE servicos SET status = 'cadastrado', "numServ" = ''
-- WHERE id IN ('VD0000', 'VD0000', 'VD0000') AND "desc" IS DISTINCT FROM 'Instalação de espaçador';
--
-- -- Todos saem do fluxo de instalação
-- UPDATE servicos
-- SET etapa_espacador = NULL, dt_etapa = NULL, motivo_reprovacao_fechamento = NULL,
--     nsmc = NULL, status_antes_instalacao = NULL
-- WHERE id IN ('VD0000', 'VD0000', 'VD0000');
--
-- COMMIT;
