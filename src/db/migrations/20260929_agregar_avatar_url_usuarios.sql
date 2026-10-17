-- =============================================================================
-- MIGRACIÓN: AGREGAR COLUMNA avatar_url A TABLA usuarios
-- Fecha: 2026-09-29
-- Autor: Marcelo Acevedo (SIGA Escolar)
-- Descripción: Permite almacenar la URL pública de la foto de perfil del profesional
-- alojada en Supabase Storage (Bucket: avatars).
-- =============================================================================

-- 1. Agregar columna avatar_url si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- 2. Comentario explicativo en la columna
COMMENT ON COLUMN usuarios.avatar_url IS 'URL pública del avatar del usuario alojado en Supabase Storage (bucket avatars)';

-- 3. Instrucciones para la creación del Bucket en Supabase Storage:
-- NOTA: El bucket "avatars" debe ser creado desde el dashboard de Supabase o mediante script SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars', 
    'avatars', 
    true, 
    2097152, -- 2 MB límite
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 4. Política de Storage: Acceso público de lectura a los avatares
CREATE POLICY "Avatares publicos para lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
