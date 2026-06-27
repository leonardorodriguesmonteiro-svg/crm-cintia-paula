# Implantação V6

1. Execute a migração SQL no Supabase:
   `supabase/migrations/20260627_001_base.sql`
2. Configure `.env.local` com URL e Publishable Key do Supabase.
3. Rode `npm install`.
4. Teste com `npm run dev`.
5. Vincule ao projeto existente da Vercel e publique com `npx vercel --prod`.
