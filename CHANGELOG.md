# Changelog

## Unreleased

- Security updates: Next.js 16.4 fixes a critical advisory, and PDF.js 6.4 fixes a malicious-PDF advisory.
- More security updates: Next.js 16.4.6 fixes a newer critical advisory, along with patched Undici, Vite and Zod.
- Final Draft (FDX) files are read as screenplay text instead of raw XML, which uses far fewer tokens and no longer shows a false "no scene headings" warning.
- Image generation stops and tells you when your fal.ai balance runs out, instead of failing every remaining image.
- A deck without a TMDB key no longer fires failed poster lookups.
- Choosing the same screenplay file again after cancelling or an error now works.
- Characters without a description still get a portrait.

## 0.1.0 - 2026-07-19

- First open-source release.
- Turns a PDF, FDX or TXT screenplay into an editable visual deck: tone, cast, locations, scenes, storyboards and posters.
- Runs on your own OpenAI, Claude, DeepSeek, Gemini and fal.ai keys.
- Keeps your keys and projects in browser storage, with no accounts, payments or database.
