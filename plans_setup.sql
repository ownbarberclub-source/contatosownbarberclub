-- Criar a tabela de planos
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Permitir leitura para todos os autenticados" 
ON public.plans 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para admins" 
ON public.plans 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização para admins" 
ON public.plans 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir exclusão para admins" 
ON public.plans 
FOR DELETE 
TO authenticated 
USING (true);
