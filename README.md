This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

```bash
cp .env.example .env          # set DATABASE_URL (and the optional services)
npm install
npm run db:migrate            # create/upgrade the schema (also runs on every Vercel build)
npm run db:seed               # optional demo data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo seed creates sample accounts (e.g. `admin@fixmydistrict.app`)
with the password set in `seed.ts`; see that file for the full list.

## Tests

```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e
```

See [tests/README.md](tests/README.md). CI runs all of these on every pull
request.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for sessions, roles, rate limits
and the media/upload policy.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
