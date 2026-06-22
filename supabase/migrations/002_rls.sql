-- Row Level Security for ScopeGuard
-- Principle: any row accessible only if the user belongs to the owning workspace.

-- Helper: check membership
create or replace function user_workspace_ids()
returns setof uuid language sql security definer stable as $$
  select workspace_id from workspace_members where user_id = auth.uid()
$$;

-- workspaces
alter table workspaces enable row level security;
create policy "workspace owner access" on workspaces for all
  using (id in (select user_workspace_ids()));

-- workspace_members
alter table workspace_members enable row level security;
create policy "members see own workspace" on workspace_members for all
  using (workspace_id in (select user_workspace_ids()));

-- projects
alter table projects enable row level security;
create policy "members access own workspace projects" on projects for all
  using (workspace_id in (select user_workspace_ids()));

-- meters (via project)
alter table meters enable row level security;
create policy "members access meters via project" on meters for all
  using (project_id in (
    select id from projects where workspace_id in (select user_workspace_ids())
  ));

-- entries (via project)
alter table entries enable row level security;
create policy "members access entries via project" on entries for all
  using (project_id in (
    select id from projects where workspace_id in (select user_workspace_ids())
  ));

-- scope_events (via project)
alter table scope_events enable row level security;
create policy "members access scope_events via project" on scope_events for all
  using (project_id in (
    select id from projects where workspace_id in (select user_workspace_ids())
  ));

-- change_orders (via project)
alter table change_orders enable row level security;
create policy "members access change_orders via project" on change_orders for all
  using (project_id in (
    select id from projects where workspace_id in (select user_workspace_ids())
  ));

-- Storage: private bucket — only workspace members can read their PDFs
create policy "workspace members read change-order pdfs" on storage.objects for select
  using (
    bucket_id = 'change-orders'
    and (storage.foldername(name))[1] in (
      select user_workspace_ids()::text
    )
  );

create policy "workspace members upload change-order pdfs" on storage.objects for insert
  with check (
    bucket_id = 'change-orders'
    and (storage.foldername(name))[1] in (
      select user_workspace_ids()::text
    )
  );
