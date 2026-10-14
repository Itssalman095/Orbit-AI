# Next.js template

This is a Next.js template with shadcn/ui.

## Memory system

Every bot of a signed-in user shares one **global user memory** — durable facts
about the user (pet names, preferences, goals, relationships), stored in the
`memories` Postgres table keyed by `(user_id, key)`. This is separate from
conversation history (Trigger.dev per-chat transcripts) and bot-specific
settings (the `bots` table + each bot's sandbox `MEMORY.md` scratchpad).

**How it works** (in `trigger/chat.ts`, executed on every user message):

1. **Extraction** — `extractMemories` (`lib/memory.ts`) sends the newest user
   message plus the user's existing memories to the LLM, which returns at most
   3 structured facts (key, value, category) or nothing. Hypotheticals,
   questions, and quotes are rejected by the extraction prompt; output is
   re-validated with zod (`lib/memory-shared.ts`). Facts are upserted, so a
   correction ("I renamed my cat to ABC") overwrites the old value under the
   same key.
2. **Retrieval** — the user's newest 100 memories are injected into every
   bot's instructions as a `GLOBAL USER MEMORY` block, so any bot — new or
   old — can answer personal questions. If the fact isn't in memory or the
   conversation, bots are instructed to say they don't know.
3. **Resilience** — extraction/retrieval failures are logged and never break
   the chat; messages persist regardless via the chat transcript.

Apply schema changes with `npm run db:push`. Tests: `npm test` (unit + real
database; LLM pipeline tests run when the gateway key is present). Delete a
memory via the `deleteMemoryAction` server action (`actions/memory.ts`).


## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
