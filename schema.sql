-- =============================================================================
-- SCRIPT DDL - SIGA ESCOLAR (ARQUITECTURA MULTI-TENANT) v3
-- Proyecto: Sistema de Gestión y Acompañamiento Escolar
-- Cliente:  Escuela Coeducacional N°1 El Salvador
-- Equipo:   Marcelo Acevedo (Backend/PM) | Daniel Flores (Frontend/UI)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TENANTS (Colegios / Establecimientos)
-- =============================================================================
CREATE TABLE tenants (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre         VARCHAR(255) NOT NULL,
    rbd            VARCHAR(50)  UNIQUE NOT NULL,
    direccion      VARCHAR(255),
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. USUARIOS (Personal con acceso al sistema)
-- =============================================================================
CREATE TABLE usuarios (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email             VARCHAR(255) NOT NULL,
    password          VARCHAR(255) NOT NULL,
    nombre            VARCHAR(100) NOT NULL,
    apellido          VARCHAR(100) NOT NULL,
    rol               VARCHAR(50)  NOT NULL CHECK (rol IN (
                          'Administrador',
                          'Directivo',
                          'Inspector',
                          'Docente',
                          'Equipo de Formación'
                      )),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    intentos_fallidos INT     NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMP WITH TIME ZONE,
    fecha_creacion    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- =============================================================================
-- 3. CURSOS
-- =============================================================================
CREATE TABLE cursos (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre         VARCHAR(50) NOT NULL,
    nivel          VARCHAR(50) NOT NULL,
    anio_academico INT  NOT NULL
);

-- =============================================================================
-- 4. ESTUDIANTES
-- =============================================================================
CREATE TABLE estudiantes (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rut              VARCHAR(12) NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    apellido         VARCHAR(100) NOT NULL,
    curso_id         UUID REFERENCES cursos(id) ON DELETE SET NULL,
    fecha_nacimiento DATE,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unique_rut_per_tenant UNIQUE (tenant_id, rut)
);

-- =============================================================================
-- 5. APODERADOS
-- =============================================================================
CREATE TABLE apoderados (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiantes(id)  ON DELETE CASCADE,
    nombre        VARCHAR(100) NOT NULL,
    apellido      VARCHAR(100) NOT NULL,
    rut           VARCHAR(12),
    email         VARCHAR(255),
    telefono      VARCHAR(20),
    es_titular    BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- 6. FUNCIONARIOS (Docentes y personal del establecimiento)
-- =============================================================================
CREATE TABLE funcionarios (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rut               VARCHAR(12),
    nombre            VARCHAR(100) NOT NULL,
    apellido          VARCHAR(100) NOT NULL,
    rol_institucional VARCHAR(100),
    activo            BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- 7. TABLA PARAMÉTRICA: TIPOS DE ABORDAJE
-- =============================================================================
CREATE TABLE tipos_abordaje (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- =============================================================================
-- 8. TABLA PARAMÉTRICA: TIPOS DE PROTOCOLO RICE
-- 10 protocolos normativos de la Superintendencia de Educación (RF-08)
-- =============================================================================
CREATE TABLE tipos_protocolo (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
);

-- =============================================================================
-- 9. INCIDENTES (Bitácora de Convivencia — RF-06)
-- =============================================================================
CREATE TABLE incidentes (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id       UUID NOT NULL REFERENCES usuarios(id),
    tipo_abordaje_id INT  REFERENCES tipos_abordaje(id),
    fecha            DATE NOT NULL,
    gravedad         VARCHAR(20) NOT NULL CHECK (gravedad IN ('Leve', 'Grave', 'Gravísima')),
    relato           TEXT NOT NULL,
    medidas          TEXT,
    estado           VARCHAR(30) NOT NULL DEFAULT 'En Investigación'
                     CHECK (estado IN ('En Investigación', 'Derivado', 'Cerrado')),
    fecha_creacion   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10. INCIDENTE_ESTUDIANTES (N:M — múltiples involucrados por incidente — RF-06)
-- =============================================================================
CREATE TABLE incidente_estudiantes (
    incidente_id  UUID NOT NULL REFERENCES incidentes(id)  ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    es_victima    BOOLEAN, -- TRUE = víctima, FALSE = agresor, NULL = testigo
    observacion   TEXT,
    PRIMARY KEY (incidente_id, estudiante_id)
);

-- =============================================================================
-- 11. ENTREVISTAS A FUNCIONARIOS
-- =============================================================================
CREATE TABLE entrevistas_funcionarios (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    registrado_por UUID NOT NULL REFERENCES usuarios(id),
    incidente_id   UUID REFERENCES incidentes(id),
    fecha          DATE NOT NULL,
    tipo           VARCHAR(100),
    descripcion    TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 12. PROTOCOLOS RICE (RF-08 y RF-09)
-- =============================================================================
CREATE TABLE protocolos_rice (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
    estudiante_id     UUID NOT NULL REFERENCES estudiantes(id),
    incidente_id      UUID REFERENCES incidentes(id),
    tipo_protocolo_id INT  NOT NULL REFERENCES tipos_protocolo(id),
    estado            VARCHAR(30) NOT NULL DEFAULT 'En Investigación'
                      CHECK (estado IN ('En Investigación', 'Derivado', 'Cerrado')),
    registrado_por    UUID NOT NULL REFERENCES usuarios(id),
    fecha_apertura    DATE NOT NULL,
    fecha_cierre      DATE,
    observaciones     TEXT,
    fecha_creacion    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 13. NOTIFICACIONES (RF-07 — Alertas ante incidentes Graves/Gravísimos)
-- =============================================================================
CREATE TABLE notificaciones (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
    incidente_id   UUID NOT NULL REFERENCES incidentes(id)  ON DELETE CASCADE,
    destinatario   VARCHAR(255) NOT NULL,
    canal          VARCHAR(20) NOT NULL DEFAULT 'interno'
                   CHECK (canal IN ('email', 'interno')),
    mensaje        TEXT,
    enviada        BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio    TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 14. AUDITORÍA (RF-03 — Bitácora invisible de eventos CRUD)
-- =============================================================================
CREATE TABLE auditoria (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion         VARCHAR(20) NOT NULL CHECK (accion IN (
                       'CREATE',
                       'UPDATE',
                       'DELETE',
                       'LOGIN',
                       'LOGOUT',
                       'LOGIN_FAILED'
                   )),
    tabla_afectada VARCHAR(100),
    registro_id    UUID,
    detalle        JSONB,   -- Payload completo del cambio (antes/después)
    ip             VARCHAR(45),
    fecha_hora     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES DE RENDIMIENTO (RNF-07: Dashboard < 3s, formularios < 1.5s)
-- =============================================================================

-- Usuarios
CREATE INDEX idx_usuarios_tenant          ON usuarios(tenant_id);
CREATE INDEX idx_usuarios_email           ON usuarios(tenant_id, email);

-- Estudiantes
CREATE INDEX idx_estudiantes_tenant       ON estudiantes(tenant_id);
CREATE INDEX idx_estudiantes_curso        ON estudiantes(curso_id);
CREATE INDEX idx_estudiantes_activo       ON estudiantes(tenant_id, activo);

-- Incidentes
CREATE INDEX idx_incidentes_tenant        ON incidentes(tenant_id);
CREATE INDEX idx_incidentes_fecha         ON incidentes(tenant_id, fecha);
CREATE INDEX idx_incidentes_estado        ON incidentes(tenant_id, estado);
CREATE INDEX idx_incidentes_gravedad      ON incidentes(tenant_id, gravedad);
CREATE INDEX idx_incidentes_usuario       ON incidentes(usuario_id);

-- Incidente_Estudiantes
CREATE INDEX idx_inc_est_estudiante       ON incidente_estudiantes(estudiante_id);
CREATE INDEX idx_inc_est_incidente        ON incidente_estudiantes(incidente_id);

-- Protocolos RICE
CREATE INDEX idx_protocolos_tenant        ON protocolos_rice(tenant_id);
CREATE INDEX idx_protocolos_estado        ON protocolos_rice(tenant_id, estado);
CREATE INDEX idx_protocolos_estudiante    ON protocolos_rice(estudiante_id);

-- Notificaciones
CREATE INDEX idx_notificaciones_incidente ON notificaciones(incidente_id);
CREATE INDEX idx_notificaciones_enviada   ON notificaciones(tenant_id, enviada);

-- Auditoría
CREATE INDEX idx_auditoria_tenant         ON auditoria(tenant_id);
CREATE INDEX idx_auditoria_fecha          ON auditoria(tenant_id, fecha_hora);
CREATE INDEX idx_auditoria_usuario        ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_tabla          ON auditoria(tabla_afectada);

-- =============================================================================
-- SEED DE DATOS OBLIGATORIOS
-- =============================================================================

-- Tipos de abordaje (7 tipos definidos en entrevista con el coordinador)
INSERT INTO tipos_abordaje (nombre) VALUES
    ('Entrevista'),
    ('Indagación / Denuncia'),
    ('Contención'),
    ('Mediación'),
    ('Conflicto / Incidente puntual'),
    ('Proceso Administrativo'),
    ('Derivación');

-- Tipos de protocolo RICE (10 protocolos normativos Superintendencia de Educación)
INSERT INTO tipos_protocolo (nombre) VALUES
    ('Maltrato entre estudiantes'),
    ('Abuso sexual entre estudiantes'),
    ('Abuso sexual por adulto'),
    ('Maltrato de adulto a estudiante'),
    ('Violencia intrafamiliar'),
    ('Consumo de drogas o alcohol'),
    ('Conducta suicida o autolesión'),
    ('Accidente escolar'),
    ('Denuncia por vulneración de derechos'),
    ('Otro protocolo normativo');

-- Tenant inicial: Escuela Coeducacional N°1 El Salvador
INSERT INTO tenants (nombre, rbd, direccion) VALUES
    ('Escuela Coeducacional N°1 El Salvador', '00000-0', 'El Salvador, Atacama, Chile');

-- =============================================================================
-- VERIFICACIÓN FINAL — Ejecutar después del script
-- =============================================================================
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
--
-- Resultado esperado (14 tablas):
--   apoderados, auditoria, cursos, entrevistas_funcionarios, estudiantes,
--   funcionarios, incidente_estudiantes, incidentes, notificaciones,
--   protocolos_rice, tenants, tipos_abordaje, tipos_protocolo, usuarios
-- =============================================================================

-- =============================================================================
-- TRIGGERS DE INTEGRIDAD REFERENCIAL
-- =============================================================================

-- Valida que el estudiante_id en protocolos_rice exista en incidente_estudiantes
-- para el mismo incidente_id. Evita inconsistencias entre protocolo y su incidente origen.
CREATE OR REPLACE FUNCTION validar_estudiante_en_incidente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.incidente_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM incidente_estudiantes
            WHERE incidente_id  = NEW.incidente_id
            AND   estudiante_id = NEW.estudiante_id
        ) THEN
            RAISE EXCEPTION
                'Integridad violada: el estudiante % no está vinculado al incidente %',
                NEW.estudiante_id, NEW.incidente_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_protocolo_estudiante
BEFORE INSERT OR UPDATE ON protocolos_rice
FOR EACH ROW EXECUTE FUNCTION validar_estudiante_en_incidente();