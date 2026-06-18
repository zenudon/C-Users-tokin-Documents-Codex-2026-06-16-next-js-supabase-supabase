"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";

export type PublicRecipeSearchItem = {
  title: string;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  shareSlug: string;
  ingredientNames: string[];
};

export function PublicRecipeSearch({
  recipes
}: {
  recipes: PublicRecipeSearchItem[];
}) {
  const [query, setQuery] = useState("");

  const filteredRecipes = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return recipes;

    return recipes.filter((recipe) =>
      [recipe.title, recipe.category ?? "", recipe.description ?? "", recipe.ingredientNames.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [query, recipes]);

  return (
    <section className="public-list-content">
      <input
        className="public-search"
        placeholder="レシピ名・カテゴリー・材料で検索"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {filteredRecipes.length > 0 ? (
        <div className="public-card-grid">
          {filteredRecipes.map((recipe) => (
            <Link className="public-card" href={`/r/${recipe.shareSlug}`} key={recipe.shareSlug}>
              {recipe.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={recipe.photoUrl} alt="" />
              ) : (
                <div className="public-card-empty">
                  <BookOpen size={28} />
                </div>
              )}
              <div>
                <h2>{recipe.title}</h2>
                {recipe.category ? <span className="category-pill">{recipe.category}</span> : null}
                {recipe.description ? <p>{recipe.description}</p> : null}
                <span>{recipe.ingredientNames.length} 材料</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">条件に合う公開レシピはありません。</div>
      )}
    </section>
  );
}
