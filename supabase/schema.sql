create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  description text,
  photo_path text,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  amount text,
  position int not null default 0
);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  instruction text not null,
  position int not null default 0
);

create index if not exists recipes_user_id_idx on public.recipes(user_id);
create index if not exists recipes_share_slug_idx on public.recipes(share_slug);
create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index if not exists recipe_steps_recipe_id_idx on public.recipe_steps(recipe_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

drop policy if exists "Users can manage own recipes" on public.recipes;
create policy "Users can manage own recipes"
on public.recipes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Anyone can view public recipes" on public.recipes;
create policy "Anyone can view public recipes"
on public.recipes
for select
using (is_public = true);

drop policy if exists "Users can manage ingredients of own recipes" on public.recipe_ingredients;
create policy "Users can manage ingredients of own recipes"
on public.recipe_ingredients
for all
using (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = auth.uid()
  )
);

drop policy if exists "Anyone can view ingredients of public recipes" on public.recipe_ingredients;
create policy "Anyone can view ingredients of public recipes"
on public.recipe_ingredients
for select
using (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.is_public = true
  )
);

drop policy if exists "Users can manage steps of own recipes" on public.recipe_steps;
create policy "Users can manage steps of own recipes"
on public.recipe_steps
for all
using (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_steps.recipe_id
      and recipes.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_steps.recipe_id
      and recipes.user_id = auth.uid()
  )
);

drop policy if exists "Anyone can view steps of public recipes" on public.recipe_steps;
create policy "Anyone can view steps of public recipes"
on public.recipe_steps
for select
using (
  exists (
    select 1
    from public.recipes
    where recipes.id = recipe_steps.recipe_id
      and recipes.is_public = true
  )
);

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

drop policy if exists "Users can view recipe photos" on storage.objects;
create policy "Users can view recipe photos"
on storage.objects
for select
using (bucket_id = 'recipe-photos');

drop policy if exists "Users can upload own recipe photos" on storage.objects;
create policy "Users can upload own recipe photos"
on storage.objects
for insert
with check (
  bucket_id = 'recipe-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own recipe photos" on storage.objects;
create policy "Users can update own recipe photos"
on storage.objects
for update
using (
  bucket_id = 'recipe-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'recipe-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own recipe photos" on storage.objects;
create policy "Users can delete own recipe photos"
on storage.objects
for delete
using (
  bucket_id = 'recipe-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
