-- ==============================================================================
-- 00003_calendars_and_holidays.sql
-- Working calendars, regional weekend configuration, and tenant/project holidays.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: working_calendars
-- Defines working days, regional weekend exclusions, and standard hours.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS working_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    week_start_day SMALLINT NOT NULL DEFAULT 1 CHECK (week_start_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday
    working_days JSONB NOT NULL DEFAULT '[1, 2, 3, 4, 5]'::jsonb, -- 0=Sun, 1=Mon, ..., 6=Sat
    daily_working_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00 CHECK (daily_working_hours > 0 AND daily_working_hours <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_calendar_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_calendars_tenant ON working_calendars(tenant_id);

-- Attach foreign key constraint from projects to working_calendars
DO $$ BEGIN
    ALTER TABLE projects
    ADD CONSTRAINT fk_projects_calendar
    FOREIGN KEY (calendar_id) REFERENCES working_calendars(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- Table: calendar_holidays
-- Fixed and floating non-working holiday dates tied to specific calendars.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES working_calendars(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    date DATE NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    floating_rule JSONB, -- Optional metadata for recurring algorithm calculations
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_calendar_holiday_date UNIQUE (calendar_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_calendar ON calendar_holidays(calendar_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON calendar_holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON calendar_holidays(tenant_id);
