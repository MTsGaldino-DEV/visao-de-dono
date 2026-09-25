-- Fluxo de instalação de espaçadores por vão + perfil Fechamento
-- Rodar manualmente no SQL Editor do Supabase.
-- Só ACRESCENTA: não altera nem remove políticas existentes.

-- 1. Colunas novas em servicos
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS etapa_espacador TEXT
    CHECK (etapa_espacador IN ('instalacao', 'revisao', 'aguardando_nsmp', 'aguardando_nsmc', 'pago')),
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_fechamento TEXT,
  ADD COLUMN IF NOT EXISTS nsmc TEXT,
  ADD COLUMN IF NOT EXISTS dt_etapa TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS servicos_etapa_espacador_idx
  ON servicos (etapa_espacador) WHERE etapa_espacador IS NOT NULL;

-- 2. Tabela de vãos
CREATE TABLE IF NOT EXISTS vaos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id   TEXT NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  numero       INT  NOT NULL CHECK (numero BETWEEN 1 AND 20),
  fotos_antes  TEXT[] NOT NULL DEFAULT '{}',
  fotos_depois TEXT[] NOT NULL DEFAULT '{}',
  croqui_url   TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (servico_id, numero)
);

ALTER TABLE vaos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vaos_escritorio" ON vaos;
CREATE POLICY "vaos_escritorio" ON vaos FOR ALL
  USING ((SELECT role FROM usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante', 'fechamento'))
  WITH CHECK ((SELECT role FROM usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante', 'fechamento'));

-- 3. Perfil fechamento pode ler e atualizar servicos
DROP POLICY IF EXISTS "fechamento_servicos" ON servicos;
CREATE POLICY "fechamento_servicos" ON servicos FOR ALL
  USING ((SELECT role FROM usuarios WHERE uid = auth.uid()) = 'fechamento')
  WITH CHECK ((SELECT role FROM usuarios WHERE uid = auth.uid()) = 'fechamento');

-- 4. Aceitar o perfil 'fechamento' em usuarios.role (o nome da CHECK é descoberto aqui)
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'usuarios'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('dono', 'tecnico', 'despachante', 'levantador', 'fechamento'));

-- 5. Upload de arquivos de espaçadores (pasta espacadores/ do bucket levantamentos)
DROP POLICY IF EXISTS "espacadores_upload" ON storage.objects;
CREATE POLICY "espacadores_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'levantamentos'
    AND (storage.foldername(name))[1] = 'espacadores'
    AND (SELECT role FROM public.usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante')
  );

-- 6. Tempo real para vaos
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vaos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
