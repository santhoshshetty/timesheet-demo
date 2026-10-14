-- Up Migration
-- Forward-only: this migration intentionally has no down section.

CREATE TABLE project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_code char(8) NOT NULL,
  name varchar(100) NOT NULL,
  project_manager_name varchar(100) NOT NULL,
  project_manager_email varchar(254) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  project_type varchar(16) NOT NULL,
  client_name varchar(100) NULL,
  billing_type varchar(16) NOT NULL,
  create_request_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,

  CONSTRAINT project_charge_code_uq UNIQUE (charge_code),
  CONSTRAINT project_charge_code_format_ck CHECK (charge_code ~ '^[0-9]{8}$'),
  CONSTRAINT project_name_ck CHECK (name = btrim(name) AND name <> ''),
  CONSTRAINT project_manager_name_ck
    CHECK (project_manager_name = btrim(project_manager_name) AND project_manager_name <> ''),
  CONSTRAINT project_manager_email_ck
    CHECK (project_manager_email = lower(btrim(project_manager_email))),
  CONSTRAINT project_dates_ck CHECK (end_date >= start_date),
  CONSTRAINT project_type_ck CHECK (project_type IN ('INTERNAL', 'CLIENT')),
  CONSTRAINT project_client_name_ck CHECK (
    (project_type = 'CLIENT' AND client_name IS NOT NULL
      AND client_name = btrim(client_name) AND client_name <> '')
    OR (project_type = 'INTERNAL' AND client_name IS NULL)
  ),
  CONSTRAINT project_billing_type_ck CHECK (billing_type IN ('BILLABLE', 'NON_BILLABLE')),
  CONSTRAINT project_create_request_id_uq UNIQUE (create_request_id),
  CONSTRAINT project_version_ck CHECK (version >= 1)
);

CREATE UNIQUE INDEX project_name_active_uq ON project (lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX project_active_start_date_idx ON project (start_date) WHERE deleted_at IS NULL;
CREATE INDEX project_active_end_date_idx ON project (end_date) WHERE deleted_at IS NULL;
