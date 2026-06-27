# CRM Cintia Paula V6

Base única e profissional do CRM.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase

Execute a migração:

`supabase/migrations/20260627_001_base.sql`

## Deploy

```bash
npx vercel link
npx vercel --prod
```
