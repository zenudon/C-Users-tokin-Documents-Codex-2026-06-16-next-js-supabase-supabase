alter table public.recipes
add column if not exists is_public boolean not null default false;

alter table public.recipes
add column if not exists category text;

alter table public.recipes
add column if not exists share_slug text unique;

create index if not exists recipes_share_slug_idx on public.recipes(share_slug);

drop policy if exists "Anyone can view public recipes" on public.recipes;
create policy "Anyone can view public recipes"
on public.recipes
for select
using (is_public = true);

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
