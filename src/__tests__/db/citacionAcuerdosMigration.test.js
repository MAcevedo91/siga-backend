const fs = require('fs');
const path = require('path');

describe('TASK 10.2.1 — Migración DDL: Modelo citacion_acuerdos_mutuos (Supabase)', () => {
    const migrationPath = path.join(__dirname, '../../db/migrations/20261104_crear_tabla_citacion_acuerdos_mutuos.sql');
    let sqlContent = '';

    beforeAll(() => {
        expect(fs.existsSync(migrationPath)).toBe(true);
        sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    test('1. Criterio 1: Debe definir la tabla citacion_acuerdos_mutuos vinculada 1:1 con citaciones_formativas', () => {
        expect(sqlContent).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(public\.)?citacion_acuerdos_mutuos\s*\(/i);
        expect(sqlContent).toMatch(/citacion_id\s+UUID\s+NOT\s+NULL\s+UNIQUE\s+REFERENCES\s+citaciones_formativas\(id\)/i);
    });

    test('2. Criterio 2: Debe incluir compromisos en formato estructurado JSONB y fecha obligatoria de seguimiento', () => {
        expect(sqlContent).toMatch(/compromisos_colegio\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
        expect(sqlContent).toMatch(/compromisos_apoderado\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
        expect(sqlContent).toMatch(/fecha_proximo_seguimiento\s+DATE\s+NOT\s+NULL/i);
    });

    test('3. Criterio 3: Debe contener firma digital y código hash SHA-256 de 64 caracteres hex', () => {
        expect(sqlContent).toMatch(/firma_docente_data\s+TEXT/i);
        expect(sqlContent).toMatch(/firma_apoderado_data\s+TEXT/i);
        expect(sqlContent).toMatch(/hash_sha256\s+VARCHAR\(64\)\s+NOT\s+NULL/i);
        expect(sqlContent).toMatch(/CONSTRAINT\s+chk_acuerdos_hash_sha256\s+CHECK\s*\(\s*hash_sha256\s+~\*\s+'\^\[a-f0-9\]\{64\}\$'\s*\)/i);
    });

    test('4. Criterio 4: Debe definir índices B-Tree de rendimiento en tenant_id, citacion_id y hash', () => {
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citacion_acuerdos_tenant_citacion\s+ON\s+citacion_acuerdos_mutuos/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citacion_acuerdos_hash\s+ON\s+citacion_acuerdos_mutuos\s*\(\s*hash_sha256\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citacion_acuerdos_seguimiento\s+ON\s+citacion_acuerdos_mutuos/i);
    });

    test('5. Criterio 5: Debe habilitar Row Level Security (RLS) y aislamiento multi-tenant estricto', () => {
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+citacion_acuerdos_mutuos\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/CREATE\s+POLICY\s+p_citacion_acuerdos_tenant_isolation\s+ON\s+citacion_acuerdos_mutuos/i);
        expect(sqlContent).toMatch(/tenant_id\s*=\s*\(current_setting\('app\.current_tenant_id',\s*true\)\)::uuid/i);
    });
});
