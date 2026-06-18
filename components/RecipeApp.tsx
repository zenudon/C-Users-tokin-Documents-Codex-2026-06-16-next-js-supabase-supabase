"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Camera,
  ChefHat,
  LogOut,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Ingredient = {
  id?: string;
  name: string;
  amount: string;
  position: number;
};

type Step = {
  id?: string;
  instruction: string;
  position: number;
};

type Recipe = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  photo_path: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  recipe_ingredients: Ingredient[];
  recipe_steps: Step[];
};

type Draft = {
  id?: string;
  title: string;
  category: string;
  description: string;
  photo_path: string | null;
  is_public: boolean;
  share_slug: string | null;
  ingredients: Ingredient[];
  steps: Step[];
};

const CATEGORY_OPTIONS = ["うどん", "ZEN", "アイス", "たれ", "ソース"];

function createEmptyDraft(): Draft {
  return {
    title: "",
    category: "",
    description: "",
    photo_path: null,
    is_public: false,
    share_slug: null,
    ingredients: [{ name: "", amount: "", position: 0 }],
    steps: [{ instruction: "", position: 0 }]
  };
}

function makeShareSlug() {
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((value) => value.toString(36))
    .join("");
  return `${Date.now().toString(36)}-${randomPart}`;
}

export function RecipeApp() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(createEmptyDraft);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId);

  const filteredRecipes = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return recipes;

    return recipes.filter((recipe) => {
      const ingredientText = recipe.recipe_ingredients
        .map((ingredient) => ingredient.name)
        .join(" ");
      return `${recipe.title} ${recipe.category ?? ""} ${recipe.description ?? ""} ${ingredientText}`
        .toLowerCase()
        .includes(text);
    });
  }, [query, recipes]);

  const loadRecipes = useCallback(async () => {
    if (!supabase) return;

    setStatus("読み込み中...");
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id,title,category,description,photo_path,is_public,share_slug,created_at,recipe_ingredients(id,name,amount,position),recipe_steps(id,instruction,position)"
      )
      .order("created_at", { ascending: false })
      .order("position", { referencedTable: "recipe_ingredients" })
      .order("position", { referencedTable: "recipe_steps" });

    if (error) {
      setStatus(error.message);
      return;
    }

    setRecipes((data ?? []) as Recipe[]);
    setStatus("");
  }, []);

  useEffect(() => {
    if (user) {
      loadRecipes();
    } else {
      setRecipes([]);
      setSelectedId(null);
      setDraft(createEmptyDraft());
    }
  }, [loadRecipes, user]);

  async function signIn() {
    if (!supabase) return;

    setStatus("ログイン中...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setStatus(error.message);
  }

  async function signUp() {
    if (!supabase) return;

    setStatus("アカウント作成中...");
    const { error } = await supabase.auth.signUp({ email, password });
    setStatus(error ? error.message : "アカウントを作成しました。ログインしてください。");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function startNew() {
    setSelectedId(null);
    setDraft(createEmptyDraft());
    setEditorKey((current) => current + 1);
    setStatus("");
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openRecipe(recipe: Recipe) {
    setSelectedId(recipe.id);
    setDraft({
      id: recipe.id,
      title: recipe.title,
      category: recipe.category ?? "",
      description: recipe.description ?? "",
      photo_path: recipe.photo_path,
      is_public: recipe.is_public,
      share_slug: recipe.share_slug,
      ingredients:
        recipe.recipe_ingredients.length > 0
          ? recipe.recipe_ingredients
          : [{ name: "", amount: "", position: 0 }],
      steps:
        recipe.recipe_steps.length > 0
          ? recipe.recipe_steps
          : [{ instruction: "", position: 0 }]
    });
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function uploadPhoto(recipeId: string, file: File) {
    if (!supabase || !user) return null;

    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${recipeId}/main.${extension}`;
    const { error } = await supabase.storage
      .from("recipe-photos")
      .upload(path, file, { upsert: true });

    if (error) throw error;
    return path;
  }

  async function saveRecipe(photoFile?: File) {
    if (!supabase) return;

    if (!user || !draft.title.trim()) {
      setStatus("タイトルを入力してください。");
      return;
    }

    setStatus("保存中...");
    const basePayload = {
      title: draft.title.trim(),
      category: draft.category.trim() || null,
      description: draft.description.trim() || null,
      is_public: draft.is_public,
      share_slug: draft.share_slug ?? makeShareSlug(),
      user_id: user.id
    };

    const { data: recipe, error } = draft.id
      ? await supabase
          .from("recipes")
          .update(basePayload)
          .eq("id", draft.id)
          .select("id,share_slug")
          .single()
      : await supabase
          .from("recipes")
          .insert(basePayload)
          .select("id,share_slug")
          .single();

    if (error || !recipe) {
      setStatus(error?.message ?? "保存できませんでした。");
      return;
    }

    let photoPath = draft.photo_path;
    try {
      if (photoFile) {
        photoPath = await uploadPhoto(recipe.id, photoFile);
        await supabase.from("recipes").update({ photo_path: photoPath }).eq("id", recipe.id);
      }

      await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
      await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);

      const ingredients = draft.ingredients
        .map((ingredient, position) => ({
          recipe_id: recipe.id,
          name: ingredient.name.trim(),
          amount: ingredient.amount.trim(),
          position
        }))
        .filter((ingredient) => ingredient.name);

      const steps = draft.steps
        .map((step, position) => ({
          recipe_id: recipe.id,
          instruction: step.instruction.trim(),
          position
        }))
        .filter((step) => step.instruction);

      if (ingredients.length) await supabase.from("recipe_ingredients").insert(ingredients);
      if (steps.length) await supabase.from("recipe_steps").insert(steps);

      setSelectedId(recipe.id);
      setDraft((current) => ({
        ...current,
        id: recipe.id,
        photo_path: photoPath,
        share_slug: recipe.share_slug ?? current.share_slug
      }));
      await loadRecipes();
      setStatus("保存しました。");
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "保存中にエラーが発生しました。");
    }
  }

  async function deleteRecipe() {
    if (!supabase || !draft.id) return;

    setStatus("削除中...");
    const { error } = await supabase.from("recipes").delete().eq("id", draft.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    startNew();
    await loadRecipes();
    setStatus("削除しました。");
  }

  async function copyAllPublicRecipesUrl() {
    if (!user) return;

    const url = `${window.location.origin}/u/${user.id}`;
    await navigator.clipboard.writeText(url);
    setStatus("公開レシピ一覧のリンクをコピーしました。");
  }

  function openEveryonePublicRecipes() {
    window.open(`${window.location.origin}/public`, "_blank", "noopener,noreferrer");
  }

  function photoUrl(path: string | null) {
    if (!supabase || !path) return null;
    return supabase.storage.from("recipe-photos").getPublicUrl(path).data.publicUrl;
  }

  if (loading) {
    return <main className="empty-state">読み込み中...</main>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-card">
        <div className="brand-row">
          <div>
            <h1>Recipe Keeper</h1>
            <p className="muted">Supabase の接続設定が必要です。</p>
          </div>
          <div className="brand-mark">
            <ChefHat size={24} />
          </div>
        </div>
        <p className="muted">.env.local に Supabase URL と anon key を設定してください。</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-card">
        <div className="brand-row">
          <div>
            <h1>Recipe Keeper</h1>
            <p className="muted">お気に入りのレシピを保存</p>
          </div>
          <div className="brand-mark">
            <ChefHat size={24} />
          </div>
        </div>
        <div className="stack">
          <label>
            メールアドレス
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="auth-actions">
            <button className="primary-button" onClick={signIn} type="button">
              ログイン
            </button>
            <button className="ghost-button" onClick={signUp} type="button">
              アカウント作成
            </button>
          </div>
          <p className="status">{status}</p>
        </div>
      </main>
    );
  }

  const selectedPhotoUrl = photoUrl(draft.photo_path);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <h1>Recipe Keeper</h1>
            <p className="muted">{user.email}</p>
          </div>
          <button className="icon-button" title="ログアウト" onClick={signOut} type="button">
            <LogOut size={18} />
          </button>
        </div>

        <div className="toolbar">
          <div className="search-wrap" style={{ flex: 1 }}>
            <input
              className="search"
              placeholder="検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="icon-button" title="新規作成" onClick={startNew} type="button">
            <Plus size={18} />
          </button>
        </div>

        <button className="new-recipe-button" onClick={startNew} type="button">
          <Plus size={16} />
          新しいレシピを作る
        </button>

        <button className="share-list-button" onClick={copyAllPublicRecipesUrl} type="button">
          <Share2 size={16} />
          公開レシピ一覧を共有
        </button>

        <button className="share-list-button" onClick={openEveryonePublicRecipes} type="button">
          <BookOpen size={16} />
          みんなの公開レシピ
        </button>

        <div className="recipe-list">
          {filteredRecipes.map((recipe) => {
            const url = photoUrl(recipe.photo_path);
            return (
              <button
                key={recipe.id}
                className={`recipe-row ${recipe.id === selectedId ? "active" : ""}`}
                onClick={() => openRecipe(recipe)}
                type="button"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={url} alt="" />
                ) : (
                  <div className="thumb">
                    <BookOpen size={20} />
                  </div>
                )}
                <div>
                  <strong>{recipe.title}</strong>
                  {recipe.category ? <span className="category-pill">{recipe.category}</span> : null}
                  <p className="muted">
                    {recipe.recipe_ingredients.length} 材料
                    {recipe.is_public ? " / 公開中" : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="recipe-main" ref={editorRef}>
        <div className="topbar">
          <div>
            <h2>{selectedRecipe ? "レシピ編集" : "新しいレシピ"}</h2>
            <p className="muted">タイトル、材料、手順、写真をまとめて保存できます。</p>
          </div>
          <Search size={20} color="#71695f" />
        </div>

        <RecipeEditor
          key={editorKey}
          draft={draft}
          photoUrl={selectedPhotoUrl}
          status={status}
          onDraftChange={setDraft}
          onSave={saveRecipe}
          onDelete={deleteRecipe}
          onStatus={setStatus}
        />
      </section>
    </main>
  );
}

function RecipeEditor({
  draft,
  photoUrl,
  status,
  onDraftChange,
  onSave,
  onDelete,
  onStatus
}: {
  draft: Draft;
  photoUrl: string | null;
  status: string;
  onDraftChange: (draft: Draft) => void;
  onSave: (photoFile?: File) => void;
  onDelete: () => void;
  onStatus: (message: string) => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const preview = photoFile ? URL.createObjectURL(photoFile) : photoUrl;
  const shareUrl =
    typeof window !== "undefined" && draft.share_slug
      ? `${window.location.origin}/r/${draft.share_slug}`
      : "";

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    const ingredients = draft.ingredients.map((ingredient, currentIndex) =>
      currentIndex === index ? { ...ingredient, [field]: value } : ingredient
    );
    onDraftChange({ ...draft, ingredients });
  }

  function updateStep(index: number, value: string) {
    const steps = draft.steps.map((step, currentIndex) =>
      currentIndex === index ? { ...step, instruction: value } : step
    );
    onDraftChange({ ...draft, steps });
  }

  async function copyShareUrl() {
    if (!shareUrl) {
      onStatus("一度保存すると共有リンクをコピーできます。");
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    onStatus("共有リンクをコピーしました。");
  }

  return (
    <div className="editor">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-photo" src={preview} alt="" />
      ) : (
        <div className="hero-photo">
          <Camera size={32} />
        </div>
      )}

      <div className="form-body">
        <label>
          タイトル
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder="例: 週末のチキンカレー"
          />
        </label>

        <label>
          カテゴリー
          <select
            value={draft.category}
            onChange={(event) => onDraftChange({ ...draft, category: event.target.value })}
          >
            <option value="">選択してください</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option value={category} key={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          メモ
          <textarea
            value={draft.description}
            onChange={(event) =>
              onDraftChange({ ...draft, description: event.target.value })
            }
            placeholder="味のポイントや作る量など"
          />
        </label>

        <label>
          写真
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0])}
          />
        </label>

        <div className="share-panel">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={draft.is_public}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  is_public: event.target.checked,
                  share_slug: draft.share_slug ?? makeShareSlug()
                })
              }
            />
            公開リンクで共有する
          </label>
          {draft.is_public ? (
            <div className="share-actions">
              <input value={shareUrl || "保存後にリンクが作られます"} readOnly />
              <button className="ghost-button" onClick={copyShareUrl} type="button">
                <Share2 size={16} />
                コピー
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid-two">
          <section className="stack">
            <h3>材料</h3>
            {draft.ingredients.map((ingredient, index) => (
              <div className="ingredient-row" key={index}>
                <input
                  placeholder="材料"
                  value={ingredient.name}
                  onChange={(event) => updateIngredient(index, "name", event.target.value)}
                />
                <input
                  placeholder="分量"
                  value={ingredient.amount}
                  onChange={(event) => updateIngredient(index, "amount", event.target.value)}
                />
                <button
                  className="icon-button"
                  title="削除"
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      ingredients: draft.ingredients.filter((_, currentIndex) => currentIndex !== index)
                    })
                  }
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              className="ghost-button"
              onClick={() =>
                onDraftChange({
                  ...draft,
                  ingredients: [
                    ...draft.ingredients,
                    { name: "", amount: "", position: draft.ingredients.length }
                  ]
                })
              }
              type="button"
            >
              <Plus size={16} />
              材料を追加
            </button>
          </section>

          <section className="stack">
            <h3>手順</h3>
            {draft.steps.map((step, index) => (
              <div className="step-row" key={index}>
                <textarea
                  placeholder={`${index + 1}. 手順`}
                  value={step.instruction}
                  onChange={(event) => updateStep(index, event.target.value)}
                />
                <button
                  className="icon-button"
                  title="削除"
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      steps: draft.steps.filter((_, currentIndex) => currentIndex !== index)
                    })
                  }
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              className="ghost-button"
              onClick={() =>
                onDraftChange({
                  ...draft,
                  steps: [...draft.steps, { instruction: "", position: draft.steps.length }]
                })
              }
              type="button"
            >
              <Plus size={16} />
              手順を追加
            </button>
          </section>
        </div>

        <div className="form-actions">
          <div>
            <button className="primary-button" onClick={() => onSave(photoFile)} type="button">
              <Save size={17} />
              保存
            </button>
            {draft.id ? (
              <button className="danger-button" onClick={onDelete} style={{ marginLeft: 10 }} type="button">
                <Trash2 size={17} />
                削除
              </button>
            ) : null}
          </div>
          <p className="status">{status}</p>
        </div>
      </div>
    </div>
  );
}
