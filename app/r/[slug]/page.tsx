import { notFound } from "next/navigation";
import { BookOpen, ChefHat } from "lucide-react";
import { supabasePublic } from "@/lib/supabase-public";

type PublicRecipe = {
  title: string;
  category: string | null;
  description: string | null;
  photo_path: string | null;
  recipe_ingredients: {
    name: string;
    amount: string | null;
    position: number;
  }[];
  recipe_steps: {
    instruction: string;
    position: number;
  }[];
};

export default async function SharedRecipePage({
  params
}: {
  params: { slug: string };
}) {
  if (!supabasePublic) notFound();

  const { data, error } = await supabasePublic
    .from("recipes")
    .select(
      "title,category,description,photo_path,recipe_ingredients(name,amount,position),recipe_steps(instruction,position)"
    )
    .eq("share_slug", params.slug)
    .eq("is_public", true)
    .single();

  if (error || !data) notFound();

  const recipe = data as PublicRecipe;
  const photoUrl = recipe.photo_path
    ? supabasePublic.storage.from("recipe-photos").getPublicUrl(recipe.photo_path).data.publicUrl
    : null;

  const ingredients = [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position);
  const steps = [...recipe.recipe_steps].sort((a, b) => a.position - b.position);

  return (
    <main className="public-page">
      <article className="public-recipe">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="public-photo" src={photoUrl} alt="" />
        ) : (
          <div className="public-photo empty">
            <ChefHat size={42} />
          </div>
        )}

        <div className="public-body">
          <div className="public-kicker">
            <BookOpen size={18} />
            Recipe Keeper
          </div>
          <h1>{recipe.title}</h1>
          {recipe.category ? <span className="category-pill">{recipe.category}</span> : null}
          {recipe.description ? <p className="public-description">{recipe.description}</p> : null}

          <div className="public-grid">
            <section>
              <h2>材料</h2>
              <ul className="ingredient-list">
                {ingredients.map((ingredient, index) => (
                  <li key={`${ingredient.name}-${index}`}>
                    <span>{ingredient.name}</span>
                    <strong>{ingredient.amount}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2>手順</h2>
              <ol className="step-list">
                {steps.map((step, index) => (
                  <li key={`${step.instruction}-${index}`}>{step.instruction}</li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
