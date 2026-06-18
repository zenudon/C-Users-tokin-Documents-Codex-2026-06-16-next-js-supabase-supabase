import { notFound } from "next/navigation";
import { ChefHat } from "lucide-react";
import { PublicRecipeSearch } from "@/components/PublicRecipeSearch";
import { supabasePublic } from "@/lib/supabase-public";

type PublicRecipeCard = {
  title: string;
  category: string | null;
  description: string | null;
  photo_path: string | null;
  share_slug: string | null;
  created_at: string;
  recipe_ingredients: { name: string }[];
};

export default async function AllPublicRecipesPage() {
  if (!supabasePublic) notFound();
  const supabase = supabasePublic;

  const { data, error } = await supabase
    .from("recipes")
    .select("title,category,description,photo_path,share_slug,created_at,recipe_ingredients(name)")
    .eq("is_public", true)
    .not("share_slug", "is", null)
    .order("created_at", { ascending: false });

  if (error) notFound();

  const recipes = ((data ?? []) as PublicRecipeCard[])
    .filter((recipe) => recipe.share_slug)
    .map((recipe) => ({
      title: recipe.title,
      category: recipe.category,
      description: recipe.description,
      shareSlug: recipe.share_slug!,
      ingredientNames: recipe.recipe_ingredients.map((ingredient) => ingredient.name),
      photoUrl: recipe.photo_path
        ? supabase.storage.from("recipe-photos").getPublicUrl(recipe.photo_path).data.publicUrl
        : null
    }));

  return (
    <main className="public-page">
      <section className="public-list-header">
        <div className="public-kicker">
          <ChefHat size={18} />
          Recipe Keeper
        </div>
        <h1>みんなの公開レシピ</h1>
        <p>公開設定になっているすべてのレシピを表示しています。</p>
      </section>

      <PublicRecipeSearch recipes={recipes} />
    </main>
  );
}
