-- Separa usuários administrativos de colaboradores de campo (parte 1)
-- Rodar no SQL Editor do Supabase. Idempotente; não apaga colunas nem linhas.

-- 1. Dados do colaborador
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS funcao TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS faz_execucao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faz_levantamento BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_unico ON usuarios (cpf) WHERE cpf IS NOT NULL;

-- 2. Papel 'colaborador' no lugar de 'tecnico' e 'levantador'
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

UPDATE usuarios SET role = 'colaborador', faz_execucao = true WHERE role = 'tecnico';
UPDATE usuarios SET role = 'colaborador', faz_levantamento = true WHERE role = 'levantador';

ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('dono', 'despachante', 'fechamento', 'colaborador'));

-- 3. Despachante lê e edita só colaboradores (WITH CHECK impede promover alguém)
DROP POLICY IF EXISTS "despachante_colaboradores" ON usuarios;
CREATE POLICY "despachante_colaboradores" ON usuarios FOR ALL
  USING (get_my_role() = 'despachante' AND role = 'colaborador')
  WITH CHECK (get_my_role() = 'despachante' AND role = 'colaborador');
