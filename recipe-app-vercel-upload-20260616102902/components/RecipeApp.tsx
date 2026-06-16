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
  description: string | null;
  photo_path: string | null;
  created_at: string;
  recipe_ingredients: Ingredient[];
  recipe_steps: Step[];
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  photo_path: string | null;
  ingredients: Ingredient[];
  steps: Step[];
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  photo_path: null,
  ingredients: [{ name: "", amount: "", position: 0 }],
  steps: [{ instruction: "", position: 0 }]
};

export function RecipeApp() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
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
      return `${recipe.title} ${recipe.description ?? ""} ${ingredientText}`
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
        "id,title,description,photo_path,created_at,recipe_ingredients(id,name,amount,position),recipe_steps(id,instruction,position)"
      )
      .order("created_at", { ascending: false })
      .order("position", { referencedTable: "recipe_ingredients" })
      .order("position", { referencedTable: "recipe_steps" });

    if (error) {
      setStatus(error.message);
      return;
    }

    setRecipes((data ?? []) as Recipe[]);
    if (!selectedId && data?.[0]) {
      openRecipe(data[0] as Recipe);
    }
    setStatus("");
  }, [selectedId]);

  useEffect(() => {
    if (user) {
      loadRecipes();
    } else {
      setRecipes([]);
      setSelectedId(null);
      setDraft(emptyDraft);
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
    setStatus(error ? error.message : "確認メールが必要な場合はメールを確認してください。");
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDraft);
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
      description: recipe.description ?? "",
      photo_path: recipe.photo_path,
      ingredients:
        recipe.recipe_ingredients.length > 0
          ? recipe.recipe_ingredients
          : [{ name: "", amount: "", position: 0 }],
      steps:
        recipe.recipe_steps.length > 0
          ? recipe.recipe_steps
          : [{ instruction: "", position: 0 }]
    });
  }

  async function uploadPhoto(recipeId: string, file: File) {
    if (!supabase) return null;
    if (!user) return null;

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
      description: draft.description.trim() || null,
      user_id: user.id
    };

    const { data: recipe, error } = draft.id
      ? await supabase
          .from("recipes")
          .update(basePayload)
          .eq("id", draft.id)
          .select("id")
          .single()
      : await supabase
          .from("recipes")
          .insert(basePayload)
          .select("id")
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
      setDraft((current) => ({ ...current, id: recipe.id, photo_path: photoPath }));
      await loadRecipes();
      setStatus("保存しました。");
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "保存中にエラーが発生しました。");
    }
  }

  async function deleteRecipe() {
    if (!supabase) return;

    if (!draft.id) return;
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

  function photoUrl(path: string | null) {
    if (!supabase) return null;

    if (!path) return null;
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
        <p className="muted">`.env.local` に Supabase URL と anon key を設定してください。</p>
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
            <button className="primary-button" onClick={signIn}>
              ログイン
            </button>
            <button className="ghost-button" onClick={signUp}>
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
          <button className="icon-button" title="ログアウト" onClick={signOut}>
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

        <div className="recipe-list">
          {filteredRecipes.map((recipe) => {
            const url = photoUrl(recipe.photo_path);
            return (
              <button
                key={recipe.id}
                className={`recipe-row ${recipe.id === selectedId ? "active" : ""}`}
                onClick={() => openRecipe(recipe)}
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
                  <p className="muted">{recipe.recipe_ingredients.length} 材料</p>
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
          draft={draft}
          photoUrl={selectedPhotoUrl}
          status={status}
          onDraftChange={setDraft}
          onSave={saveRecipe}
          onDelete={deleteRecipe}
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
  onDelete
}: {
  draft: Draft;
  photoUrl: string | null;
  status: string;
  onDraftChange: (draft: Draft) => void;
  onSave: (photoFile?: File) => void;
  onDelete: () => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | undefined>();

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

  const preview = photoFile ? URL.createObjectURL(photoFile) : photoUrl;

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
            >
              <Plus size={16} />
              手順を追加
            </button>
          </section>
        </div>

        <div className="form-actions">
          <div>
            <button className="primary-button" onClick={() => onSave(photoFile)}>
              <Save size={17} />
              保存
            </button>
            {draft.id ? (
              <button className="danger-button" onClick={onDelete} style={{ marginLeft: 10 }}>
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
