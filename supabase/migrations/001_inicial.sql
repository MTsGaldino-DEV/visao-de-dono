-- Tabela de usuários
CREATE TABLE usuarios (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  matricula TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dono', 'tecnico', 'despachante', 'levantador')),
  equipe TEXT,
  ativo BOOLEAN DEFAULT true,
  dt_criacao TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acesso TIMESTAMPTZ,
  session_expiry TIMESTAMPTZ
);

-- Tabela de serviços
CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  localidade TEXT,
  tipo TEXT,
  descricao TEXT,
  equipamento TEXT,
  status TEXT DEFAULT 'pendente',
  coord TEXT,
  foto TEXT,
  atribuido_para JSONB,
  dt_atribuicao TIMESTAMPTZ,
  dt_acionamento TIMESTAMPTZ,
  motivo_reprovacao TEXT,
  execucao JSONB,
  hist JSONB[] DEFAULT '{}',
  dt_criacao TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de fotos
CREATE TABLE fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID REFERENCES servicos(id),
  tecnico_uid UUID REFERENCES usuarios(uid),
  tipo TEXT CHECK (tipo IN ('antes', 'depois', 'levantamento')),
  storage_path TEXT NOT NULL,
  gps TEXT,
  dt_captura TIMESTAMPTZ DEFAULT NOW(),
  dt_expiracao TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;

-- Policies de usuários
CREATE POLICY "dono_acesso_total_usuarios" ON usuarios
  FOR ALL USING (
    (SELECT role FROM usuarios WHERE uid = auth.uid()) = 'dono'
  );

CREATE POLICY "usuario_ve_proprio" ON usuarios
  FOR SELECT USING (uid = auth.uid());

-- Policies de serviços
CREATE POLICY "dono_despachante_servicos" ON servicos
  FOR ALL USING (
    (SELECT role FROM usuarios WHERE uid = auth.uid()) IN ('dono', 'despachante')
  );

CREATE POLICY "tecnico_ve_proprios_servicos" ON servicos
  FOR SELECT USING (
    (atribuido_para->>'uid')::UUID = auth.uid()
  );

CREATE POLICY "tecnico_atualiza_proprios_servicos" ON servicos
  FOR UPDATE USING (
    (atribuido_para->>'uid')::UUID = auth.uid()
  );
