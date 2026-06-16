# Recipe Keeper

Next.js と Supabase で作るレシピ保存アプリです。タイトル、材料、手順、写真を保存できます。

## セットアップ

1. Supabase プロジェクトを作成します。
2. Supabase の SQL Editor で `supabase/schema.sql` を実行します。
3. `.env.example` を参考に `.env.local` を作ります。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. アプリを起動します。

```bash
npm install
npm run dev
```

## 主な機能

- メール/パスワード認証
- レシピの作成、編集、削除
- 材料と分量の保存
- 手順の保存
- Supabase Storage への写真アップロード
- 自分のレシピだけ見える RLS
