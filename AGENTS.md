<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project stage

- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.

## Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.

- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

## Database

- Drizzle ORM connects to the Supabase Postgres database (connection string in `DATABASE_URL`, never print or hardcode it).

- Schema changes must be applied with `npm run db:push` (`drizzle-kit push`) only. NEVER use migrations: do not run `drizzle-kit generate` or `drizzle-kit migrate`, do not create `drizzle/` migration files, journals, or snapshots, and do not create `supabase/migrations` or use the Supabase CLI for schema changes.

## Forms

Follow the bot-creation flow as the reference implementation: `lib/validations/bot.ts`, `actions/bot.ts`, and `components/bot-dialog.tsx`.

- Stack: react-hook-form with `zodResolver` from `@hookform/resolvers/zod`, zod schemas, shadcn/ui components from `components/ui/`, and Base UI primitives (`@base-ui/react`). Never Radix, sonner, or react-hot-toast. Dialog forms compose the Base UI wrapper in `components/ui/dialog.tsx` with `render={<Button />}` (not Radix `asChild`).
- Validation schemas live in `lib/validations/<entity>.ts`, generated from the Drizzle table with `createInsertSchema(table, { column: (schema) => ... })` (drizzle-zod). Derive the client-payload schema with `.pick()` over the user-editable columns only, and export its type via `z.output<typeof schema>`. Never accept `userId` or other ownership fields from the client.
- Mutations run in Server Actions in `actions/<entity>.ts` (`"use server"`), not API routes. Every action: `await auth()` (Clerk) first and throw `Unauthorized` without a session; re-validate the payload with `<schema>.safeParse()` — Server Actions are public endpoints, never trust the client; take `userId` from the session; return a discriminated union `{ success: true; ... } | { success: false; error: string }` instead of throwing for expected failures; call `revalidatePath()` for the affected paths.
- The client never refreshes data itself: no `router.refresh()`, no `router.push()` after mutation — the action's `revalidatePath` handles it.
- Form components are `"use client"` and compose shadcn `Field` / `FieldGroup` / `FieldLabel` / `FieldError`, marking invalid state with `data-invalid` on the `Field` and `aria-invalid` on the control. Field errors come from the zod resolver; server-action errors go to `form.setError("root", ...)` and render once below the fields.
- Watch values with `useWatch({ control, name })`, not `form.watch()` — `form.watch` trips React Compiler lint.
- The submit handler is `form.handleSubmit(async (values) => ...)`: call the action; on `!result.success` set the root error; on success fire `toast.add({ title, description, type: "success" })` from `@/components/ui/toast` before closing (the `<Toaster />` is already mounted in `app/layout.tsx` — never add another toaster), then close the dialog and `form.reset(defaultValues)`. Wrap the call in try/catch → root error on unexpected exceptions. Also reset the form whenever the dialog closes.
- While submitting: `disabled={isSubmitting}` on both submit and Cancel buttons, and a `<Spinner />` inside the submit button.
- After wiring up a form, run `npm run typecheck` and `npx eslint` on the touched files before reporting done.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.
