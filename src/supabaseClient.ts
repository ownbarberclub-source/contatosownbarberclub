import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dwbtgovygdnwignvqzuu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3YnRnb3Z5Z2Rud2lnbnZxenV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODM3NzIsImV4cCI6MjA5MTY1OTc3Mn0.FpZw5eXd6Cyi6aaLZ7pQJe3I-3puugxevU24pUspgEU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
