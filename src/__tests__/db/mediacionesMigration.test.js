const fs = require('fs');
const path = require('path');

describe('Migración DDL: Módulo de Mediaciones Escolar (Supabase)', () => {
    const migrationPath = path.join(__dirname, '../../db/migrations/20261015_crear_tablas_mediaciones.sql');
    let sqlContent = '';

    beforeAll(() => {
        expect(fs.existsSync(migrationPath)).toBe(true);
        sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    test('1. Debe definir las tablas mediaciones y mediacion_participantes con UUID PK', () => {
        expect(sqlContent).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+mediaciones\s*\(/i);
        expect(sqlContent).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+mediacion_participantes\s*\(/i);
        expect(sqlContent).toMatch(/id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+uuid_generate_v4\(\)/i);
    });

    test('2. Debe configurar claves foráneas e integridad referencial', () => {
        expect(sqlContent).toMatch(/tenant_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+tenants\(id\)\s+ON\s+DELETE\s+CASCADE/i);
        expect(sqlContent).toMatch(/mediacion_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+mediaciones\(id\)\s+ON\s+DELETE\s+CASCADE/i);
        expect(sqlContent).toMatch(/estudiante_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+estudiantes\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
        expect(sqlContent).toMatch(/mediador_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+usuarios\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
    });

    test('3. Debe generar automáticamente el folio correlativo MED-YYYY-XXXX mediante secuencia y trigger', () => {
        expect(sqlContent).toMatch(/CREATE\s+SEQUENCE\s+IF\s+NOT\s+EXISTS\s+seq_mediaciones_folio/i);
        expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+trg_generar_folio_mediacion_fn\(\)/i);
        expect(sqlContent).toMatch(/nextval\('seq_mediaciones_folio'\)/i);
        expect(sqlContent).toMatch(/'MED-'\s*\|\|\s*v_anio\s*\|\|\s*'-'\s*\|\|\s*LPAD\(v_seq::text,\s*4,\s*'0'\)/i);
        expect(sqlContent).toMatch(/CREATE\s+TRIGGER\s+trg_generar_folio_mediacion/i);
    });

    test('4. Debe habilitar Row Level Security (RLS) y definir políticas multi-tenant', () => {
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+mediaciones\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+mediaciones\s+FORCE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+mediacion_participantes\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+mediacion_participantes\s+FORCE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/CREATE\s+POLICY\s+tenant_isolation_mediaciones\s+ON\s+mediaciones/i);
        expect(sqlContent).toMatch(/tenant_id\s*=\s*NULLIF\s*\(\s*current_setting\('app\.tenant_id',\s*true\),\s*''\)::uuid/i);
        expect(sqlContent).toMatch(/CREATE\s+POLICY\s+tenant_isolation_mediacion_participantes\s+ON\s+mediacion_participantes/i);
    });

    test('5. Debe crear los índices B-Tree requeridos para optimización y búsqueda', () => {
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_mediaciones_tenant_estado\s+ON\s+mediaciones\s*\(\s*tenant_id\s*,\s*estado\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_mediaciones_folio\s+ON\s+mediaciones\s*\(\s*folio\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_mediacion_part_estudiante\s+ON\s+mediacion_participantes\s*\(\s*estudiante_id\s*\)/i);
    });

    test('6. Debe garantizar que un estudiante no se duplique en la misma mediación', () => {
        expect(sqlContent).toMatch(/CONSTRAINT\s+unique_estudiante_en_mediacion\s+UNIQUE\s*\(\s*mediacion_id\s*,\s*estudiante_id\s*\)/i);
    });
});
