const fs = require('fs');
const path = require('path');

describe('TASK 10.1.1 — Migración DDL: Modelo citaciones_formativas y Tokens Seguros (Supabase)', () => {
    const migrationPath = path.join(__dirname, '../../db/migrations/20261104_crear_tabla_citaciones_formativas.sql');
    let sqlContent = '';

    beforeAll(() => {
        expect(fs.existsSync(migrationPath)).toBe(true);
        sqlContent = fs.readFileSync(migrationPath, 'utf8');
    });

    test('1. Criterio 1: Debe definir la tabla citaciones_formativas con estados y categorías controladas por CHECK/enum', () => {
        expect(sqlContent).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(public\.)?citaciones_formativas\s*\(/i);
        expect(sqlContent).toMatch(/id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+uuid_generate_v4\(\)/i);
        
        // Categorías formativas
        expect(sqlContent).toMatch(/motivo_categoria\s+VARCHAR\(50\)\s+NOT\s+NULL\s+CHECK\s*\(\s*motivo_categoria\s+IN\s*\(/i);
        expect(sqlContent).toMatch(/'refuerzo_academico'/i);
        expect(sqlContent).toMatch(/'habitos_asistencia'/i);
        expect(sqlContent).toMatch(/'reconocimiento_felicitacion'/i);
        expect(sqlContent).toMatch(/'acuerdos_convivencia'/i);

        // Estados del ciclo de vida
        expect(sqlContent).toMatch(/estado\s+VARCHAR\(30\)\s+NOT\s+NULL\s+DEFAULT\s+'programada'\s+CHECK\s*\(\s*estado\s+IN\s*\(/i);
        expect(sqlContent).toMatch(/'programada'/i);
        expect(sqlContent).toMatch(/'confirmada'/i);
        expect(sqlContent).toMatch(/'reprogramacion_solicitada'/i);
        expect(sqlContent).toMatch(/'justificada'/i);
        expect(sqlContent).toMatch(/'realizada'/i);
        expect(sqlContent).toMatch(/'no_asiste'/i);
        expect(sqlContent).toMatch(/'cancelada'/i);
    });

    test('2. Criterio 2: Tokens criptográficos UUID únicos para acceso de apoderados con validez de 72 horas', () => {
        expect(sqlContent).toMatch(/token_confirmacion\s+UUID\s+UNIQUE\s+NOT\s+NULL\s+DEFAULT\s+uuid_generate_v4\(\)/i);
        expect(sqlContent).toMatch(/token_expira_at\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL\s+DEFAULT\s*\(\s*CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s+'72 hours'\s*\)/i);
    });

    test('3. Criterio 3: Índices B-Tree en tenant_id, estado, token_confirmacion y campos clave', () => {
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citaciones_tenant_estado\s+ON\s+(public\.)?citaciones_formativas\s*\(\s*tenant_id\s*,\s*estado\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citaciones_token_confirmacion\s+ON\s+(public\.)?citaciones_formativas\s*\(\s*token_confirmacion\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citaciones_folio\s+ON\s+(public\.)?citaciones_formativas\s*\(\s*folio\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citaciones_estudiante\s+ON\s+(public\.)?citaciones_formativas\s*\(\s*estudiante_id\s*\)/i);
        expect(sqlContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_citaciones_docente\s+ON\s+(public\.)?citaciones_formativas\s*\(\s*docente_id\s*\)/i);
    });

    test('4. Debe configurar claves foráneas e integridad referencial estricta', () => {
        expect(sqlContent).toMatch(/tenant_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+tenants\(id\)\s+ON\s+DELETE\s+CASCADE/i);
        expect(sqlContent).toMatch(/estudiante_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+estudiantes\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
        expect(sqlContent).toMatch(/apoderado_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+apoderados\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
        expect(sqlContent).toMatch(/docente_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+usuarios\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
    });

    test('5. Debe generar automáticamente el folio correlativo CIT-YYYY-XXXX mediante secuencia y trigger', () => {
        expect(sqlContent).toMatch(/CREATE\s+SEQUENCE\s+IF\s+NOT\s+EXISTS\s+seq_citaciones_folio/i);
        expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+trg_generar_folio_citacion_fn\(\)/i);
        expect(sqlContent).toMatch(/nextval\('seq_citaciones_folio'\)/i);
        expect(sqlContent).toMatch(/'CIT-'\s*\|\|\s*v_anio\s*\|\|\s*'-'\s*\|\|\s*LPAD\(v_seq::text,\s*4,\s*'0'\)/i);
        expect(sqlContent).toMatch(/CREATE\s+TRIGGER\s+trg_generar_folio_citacion/i);
    });

    test('6. Debe habilitar Row Level Security (RLS) y aislamiento multi-tenant', () => {
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+(public\.)?citaciones_formativas\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/ALTER\s+TABLE\s+(public\.)?citaciones_formativas\s+FORCE\s+ROW\s+LEVEL\s+SECURITY;/i);
        expect(sqlContent).toMatch(/CREATE\s+POLICY\s+tenant_isolation_citaciones\s+ON\s+(public\.)?citaciones_formativas/i);
        expect(sqlContent).toMatch(/tenant_id\s*=\s*NULLIF\s*\(\s*current_setting\('app\.tenant_id',\s*true\),\s*''\)::uuid/i);
    });
});
