import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChefHat } from "lucide-react";
import { supabasePublic } from "@/lib/supabase-public";

type PublicRecipeCard = {
  title: string;
  description: string | null;
  photo_path: string | null;
  share_slug: string | null;
  created_at: string;
  recipe_ingredients: { name: string }[];
};

export default async function PublicRecipeListPage({
  params
}: {
  params: { userId: string };
}) {
  if (!supabasePublic) notFound();
  const supabase = supabasePublic;

  const { data, error } = await supabase
    .from("recipes")
    .select("title,description,photo_path,share_slug,created_at,recipe_ingredients(name)")
    .eq("user_id", params.userId)
    .eq("is_public", true)
    .not("share_slug", "is", null)
    .order("created_at", { ascending: false });

  if (error) notFound();

  const recipes = (data ?? []) as PublicRecipeCard[];

  return (
    <main className="public-page">
      <section className="public-list-header">
        <div className="public-kicker">
          <ChefHat size={18} />
          Recipe Keeper
        </div>
        <h1>公開レシピ一覧</h1>
        <p>公開設定になっているレシピだけを表示しています。</p>
      </section>

      {recipes.length > 0 ? (
        <div className="public-card-grid">
          {recipes.map((recipe) => {
            const photoUrl = recipe.photo_path
              ? supabase.storage
                  .from("recipe-photos")
                  .getPublicUrl(recipe.photo_path).data.publicUrl
              : null;

            return (
              <Link
                className="public-card"
                href={`/r/${recipe.share_slug}`}
                key={recipe.share_slug}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" />
                ) : (
                  <div className="public-card-empty">
                    <BookOpen size={28} />
                  </div>
                )}
                <div>
                  <h2>{recipe.title}</h2>
                  {recipe.description ? <p>{recipe.description}</p> : null}
                  <span>{recipe.recipe_ingredients.length} 材料</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">公開中のレシピはまだありません。</div>
      )}
    </main>
  );
}
