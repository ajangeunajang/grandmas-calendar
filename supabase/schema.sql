-- Grandma's Calendar — 일정 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run

create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  title text not null,
  time text,
  color text not null default 'blue',
  created_at timestamptz not null default now()
);

create index if not exists events_user_date_idx on public.events (user_id, date);

-- 행 단위 보안: 로그인한 사람은 자기 일정만 보고/추가/수정/삭제
alter table public.events enable row level security;

drop policy if exists "own events: select" on public.events;
drop policy if exists "own events: insert" on public.events;
drop policy if exists "own events: update" on public.events;
drop policy if exists "own events: delete" on public.events;

create policy "own events: select" on public.events
  for select to authenticated using (user_id = auth.uid());
create policy "own events: insert" on public.events
  for insert to authenticated with check (user_id = auth.uid());
create policy "own events: update" on public.events
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own events: delete" on public.events
  for delete to authenticated using (user_id = auth.uid());
