-- Executar este script no SQL Editor do Supabase para criar as tabelas restantes.

-- Criação da tabela config
CREATE TABLE IF NOT EXISTS public.config (
    id text PRIMARY KEY,
    valores jsonb,
    digitos jsonb
);

-- Ativar RLS (Row Level Security) para config e permitir todas as operações
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total na tabela config" ON public.config
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Ativar Realtime para a tabela config
ALTER PUBLICATION supabase_realtime ADD TABLE public.config;

-- Criação da tabela lotes
CREATE TABLE IF NOT EXISTS public.lotes (
    id text PRIMARY KEY,
    status text NOT NULL DEFAULT 'aberto',
    tipo text,
    posto text,
    placas jsonb DEFAULT '[]'::jsonb,
    "criadoEm" timestamp with time zone DEFAULT now(),
    "atualizadoEm" timestamp with time zone DEFAULT now(),
    "enviadoEm" timestamp with time zone,
    "entregueEm" timestamp with time zone,
    hist jsonb DEFAULT '[]'::jsonb
);

-- Ativar RLS (Row Level Security) para lotes e permitir todas as operações
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total na tabela lotes" ON public.lotes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Ativar Realtime para a tabela lotes
ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes;
