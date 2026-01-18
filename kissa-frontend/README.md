This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

Before running the application, you need to configure environment variables for Supabase.

### Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` : Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_KEY` : Your Supabase anon/public API key
- `NEXT_PUBLIC_API_URL` : Your backend API URL (optional, defaults to `http://127.0.0.1:8000`)

### Quick Setup

For detailed setup instructions, see [SETUP_ENV.md](./SETUP_ENV.md).

**Quick start:**
1. Copy `.env.example` to `.env.local` (or create it manually)
2. Add your Supabase credentials from [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API
3. For production on Vercel, add these variables in Settings → Environment Variables

> **Security Note**: The `NEXT_PUBLIC_*` variables are public keys designed to be exposed in the browser. Security is ensured by Row Level Security (RLS) policies in Supabase. See [SETUP_ENV.md](./SETUP_ENV.md#sécurité-des-clés-api) for more details.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
