import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Este arquivo nunca deve ser importado no frontend.
// Ele utiliza a Service Role Key que possui privilégios administrativos.
// Use apenas em ambientes seguros, como funções serverless ou no backend.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
