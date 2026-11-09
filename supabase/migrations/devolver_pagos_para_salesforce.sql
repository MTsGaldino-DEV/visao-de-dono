-- Devolve para a etapa SalesForce (sf) todos os serviços que estão em Pago.
-- Rodar manualmente no SQL Editor do Supabase. Execução única.
-- Só muda a etapa, a data de entrada na etapa e o histórico: data_lancamento_sf, valor_nota
-- e apropriacao ficam preservados (aparecem de novo ao informar o SalesForce).

-- 1) Conferir ANTES: quantos serviços serão afetados
-- SELECT id, etapa_espacador FROM servicos WHERE etapa_espacador = 'pago';

UPDATE servicos
SET etapa_espacador = 'sf',
    dt_etapa = now(),
    hist = COALESCE(hist, '{}') || ARRAY[
      jsonb_build_object(
        'who', 'Sistema',
        'when', to_jsonb(now()),
        'msg', 'Serviço devolvido de Pago para SalesForce'
      )
    ]
WHERE etapa_espacador = 'pago';
