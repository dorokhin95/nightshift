begin;
create table if not exists public.profiles (telegram_id text primary key, nickname text not null check (length(nickname)<=60), created_at timestamptz not null default now());
create table if not exists public.challenges (day date primary key, seed bigint not null check(seed between 0 and 4294967295), rules_version text not null default 'mvp2-v1');
create table if not exists public.ranked_sessions (id uuid primary key default gen_random_uuid(),telegram_id text not null references public.profiles,day date not null references public.challenges,seed bigint not null,rules_version text not null default 'mvp2-v1',expires_at timestamptz not null,verified boolean not null default false,score bigint,moves jsonb,created_at timestamptz not null default now(),check(score is null or score>=0));
create index if not exists ranked_verified_day on public.ranked_sessions(day,telegram_id,score desc) where verified;
create table if not exists public.rate_limits (key text primary key,minute timestamptz not null,hits integer not null);
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.ranked_sessions enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.profiles,public.challenges,public.ranked_sessions,public.rate_limits from anon,authenticated;
create or replace function public.consume_rate(p_key text,p_limit integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;begin
 insert into rate_limits(key,minute,hits) values(p_key,date_trunc('minute',now()),1) on conflict(key) do update set minute=date_trunc('minute',now()),hits=case when rate_limits.minute=date_trunc('minute',now()) then rate_limits.hits+1 else 1 end returning hits into n;
 return n<=p_limit;end;$$;
create or replace function public.start_ranked(p_user text,p_day date,p_seed bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare c challenges;s ranked_sessions;begin
 if p_day<>(now() at time zone 'UTC')::date then raise exception 'Wrong day';end if;
 insert into challenges(day,seed) values(p_day,p_seed) on conflict(day) do nothing;
 select * into c from challenges where day=p_day;
 insert into ranked_sessions(telegram_id,day,seed,rules_version,expires_at) values(p_user,p_day,c.seed,c.rules_version,now()+interval '1 hour') returning * into s;
 return jsonb_build_object('sessionId',s.id,'seed',s.seed,'moveLimit',50,'expiresAt',s.expires_at,'rulesVersion',s.rules_version);end;$$;
create or replace function public.finish_ranked(p_id uuid,p_user text,p_score bigint,p_moves jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare s ranked_sessions;begin
 if p_score<0 or jsonb_typeof(p_moves)<>'array' or jsonb_array_length(p_moves)<>50 then raise exception 'Invalid result';end if;
 select * into s from ranked_sessions where id=p_id and telegram_id=p_user for update;
 if not found or s.verified or s.expires_at<now() then raise exception 'Session unavailable';end if;
 update ranked_sessions set verified=true,score=p_score,moves=p_moves where id=p_id;
 return jsonb_build_object('verified',true,'score',p_score);end;$$;
create or replace function public.read_leaderboard(p_period text,p_user text default null) returns jsonb language sql stable security definer set search_path=public as $$
 with daily as (select telegram_id,day,max(score) score from ranked_sessions where verified and day>=case p_period when 'day' then (now() at time zone 'UTC')::date when 'week' then date_trunc('week',now() at time zone 'UTC')::date else date_trunc('month',now() at time zone 'UTC')::date end group by telegram_id,day),
 totals as(select telegram_id,sum(score) score from daily group by telegram_id),
 ranked as(select row_number() over(order by t.score desc,t.telegram_id) place,t.telegram_id,p.nickname,t.score from totals t join profiles p using(telegram_id)),
 me as(select place from ranked where telegram_id=p_user)
 select jsonb_build_object('top',coalesce((select jsonb_agg(jsonb_build_object('place',place,'nickname',nickname,'score',score,'me',telegram_id=p_user) order by place) from ranked where place<=100),'[]'::jsonb),'neighbors',coalesce((select jsonb_agg(jsonb_build_object('place',place,'nickname',nickname,'score',score,'me',telegram_id=p_user) order by place) from ranked where place between (select place-2 from me) and (select place+2 from me)),'[]'::jsonb));$$;
revoke all on function public.consume_rate(text,integer),public.start_ranked(text,date,bigint),public.finish_ranked(uuid,text,bigint,jsonb),public.read_leaderboard(text,text) from public,anon,authenticated;
grant execute on function public.consume_rate(text,integer),public.start_ranked(text,date,bigint),public.finish_ranked(uuid,text,bigint,jsonb),public.read_leaderboard(text,text) to service_role;
grant all on public.profiles,public.challenges,public.ranked_sessions,public.rate_limits to service_role;
commit;
