# Idea2App v5 — Live AI

This version uses a Netlify Function to call the OpenAI Responses API securely.

## Files
- `index.html` — no-code AI app builder
- `netlify/functions/ai.mjs` — secure AI backend
- `netlify.toml` — Netlify function configuration

## Required Netlify setup
1. Deploy this entire folder to Netlify.
2. In your Netlify site settings, add an environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: your OpenAI API key
3. Optional:
   - Key: `OPENAI_MODEL`
   - Value: a model available to your OpenAI project, e.g. `gpt-5`
4. Redeploy the site after setting/updating environment variables.

Never paste your OpenAI API key into `index.html` or any browser-side JavaScript.

## What Live AI does
- Generates an app plan from plain English.
- Chooses screens, features, modules, colors, name, and description.
- Modifies the current app from natural-language instructions.
- Preserves a manual no-code editor.
- Generates a downloadable working starter HTML app.

## Important limitation
Third-party modules (payments, maps, cloud database, actual login, etc.) are represented in the generated starter, but each external service still needs its own real integration and credentials.
