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

const CATEGORY_OPTIONS = ["うどん", "ZEN", "アイス", "たれ", "ソース"];

export function PublicRecipeSearch({
  recipes
}: {
  recipes: PublicRecipeSearchItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredRecipes = useMemo(() => {
    const text = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const categoryMatches =
        selectedCategory === "all" || recipe.category === selectedCategory;
      if (!categoryMatches) return false;
      if (!text) return true;

      return [recipe.title, recipe.category ?? "", recipe.description ?? "", recipe.ingredientNames.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(text);
    });
  }, [query, recipes, selectedCategory]);

  return (
    <section className="public-list-content">
      <input
        className="public-search"
        placeholder="レシピ名・カテゴリー・材料で検索"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="category-filter-row">
        <button
          className={`category-filter ${selectedCategory === "all" ? "active" : ""}`}
          onClick={() => setSelectedCategory("all")}
          type="button"
        >
          すべて
        </button>
        {CATEGORY_OPTIONS.map((category) => (
          <button
            className={`category-filter ${selectedCategory === category ? "active" : ""}`}
            onClick={() => setSelectedCategory(category)}
            type="button"
            key={category}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredRecipes.length > 0 ? (
        <div className="public-card-grid">
          {filteredRecipes.map((recipe) => (
            <Link
              className={`public-card category-card ${recipe.category ? `category-${recipe.category}` : ""}`}
              href={`/r/${recipe.shareSlug}`}
              key={recipe.shareSlug}
            >
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
