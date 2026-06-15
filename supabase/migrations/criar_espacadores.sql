CREATE TABLE espacadores (
  id TEXT PRIMARY KEY,
  local TEXT,
  equip TEXT,
  status TEXT DEFAULT 'cadastrado',
  atribuido_para JSONB,
  dt_atribuicao TIMESTAMPTZ,
  hist JSONB[] DEFAULT '{}',
  dt_criacao TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE espacadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_total" ON espacadores FOR ALL USING (true);