-- =============================================
--  SCHEMA: OWN VENDEDORES (SELLERS)
-- =============================================

CREATE TABLE IF NOT EXISTS sellers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "Leitura Todos" ON sellers FOR SELECT USING (true);
CREATE POLICY "Modify Todos" ON sellers FOR ALL USING (true);
