-- Instalação de espaçadores: uma instalação = um vão
-- Rodar manualmente no SQL Editor do Supabase.
-- Só ACRESCENTA: não altera nem remove dados.

-- 1. Dados do vão: coordenadas digitadas e quantidade de espaçadores
ALTER TABLE vaos
  ADD COLUMN IF NOT EXISTS coord_antes     TEXT,
  ADD COLUMN IF NOT EXISTS coord_depois    TEXT,
  ADD COLUMN IF NOT EXISTS qtd_espacadores INT CHECK (qtd_espacadores > 0);

-- 2. Status para onde o serviço volta se a instalação for excluída
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS status_antes_instalacao TEXT;

-- 3. O fechamento agora envia o croqui: libera o upload na pasta espacadores/
DROP POLICY IF EXISTS "espacadores_upload" ON storage.objects;
CREATE POLICY "espacadores_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'levantamentos'
    AND (storage.foldername(name))[1] = 'espacadores'
    AND (SELECT role FROM public.usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante', 'fechamento')
  );
