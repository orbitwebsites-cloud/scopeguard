-- ScopeGuard initial schema

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  accent_color text default '#1864ab',
  reply_to_email text,
  plan text default 'free' check (plan in ('free','pro','lifetime')),
  stripe_customer_id text,
  created_at timestamptz default now()
);

create table workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id uuid references auth.users,
  role text default 'member' check (role in ('owner','member')),
  primary key (workspace_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  name text not null,
  client_name text,
  client_email text,
  project_value_cents int,
  threshold numeric default 0.8,
  status text default 'active' check (status in ('active','closed')),
  created_at timestamptz default now()
);

create table meters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  type text not null check (type in ('revisions','hours','deliverables')),
  budget numeric not null,
  overage_rate_cents int not null default 0,
  unique (project_id, type)
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  meter_type text not null check (meter_type in ('revisions','hours','deliverables')),
  amount numeric not null,
  note text,
  created_by uuid references auth.users,
  occurred_at timestamptz default now()
);

-- fire-once events — unique constraint enforces idempotency
create table scope_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  meter_type text not null,
  kind text not null check (kind in ('approaching','over')),
  emailed_at timestamptz,
  created_at timestamptz default now(),
  unique (project_id, meter_type, kind)
);

create table change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  line_items jsonb not null,
  note text,
  total_cents int not null,
  pdf_url text,
  sent_to text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Supabase Storage: private bucket for change-order PDFs
insert into storage.buckets (id, name, public) values ('change-orders', 'change-orders', false);
