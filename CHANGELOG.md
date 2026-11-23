# Changelog

## Unreleased

- Security updates: Next.js 16.4 fixes a critical advisory, and PDF.js 6.4 fixes a malicious-PDF advisory.
- More security updates: Next.js 16.4.6 fixes a newer critical advisory, along with patched Undici, Vite and Zod.
- Updated to current models: Claude Haiku 5.5 and Sonnet 5.5 (Sonnet 4.5 retires on November 30, 2026), GPT-6 Luna and GPT-6.1 Terra, DeepSeek Flash, and Gemini 4 Hydrogen with Gemini 3.5 Flash-Lite. Claude now starts on Sonnet 5.5.
- Settings is now two short tabs, Writing and Images, instead of one long scroll. Image styles sit behind one line, and the sound switch moved here from the corner of every page.
- The app remembers one key per provider, so switching between Claude and OpenAI no longer wipes the key.
- The three confirmations (Read this screenplay, Write the deck, Generate images) are plain ruled rows with the model choice in the row. A key is asked for only when the one that step needs is missing, and a key typed there is saved only when you confirm.
- Stop now cancels the sections still being written, so a stopped run cannot come back and overwrite a retry.
- Keys saved in one browser tab are no longer overwritten by a change made in another open tab.
- You can type a model name that is not in the list yet (Settings, Model, Other model).
- The Generate images button shows a rough cost estimate.
- Sections that failed can be retried without starting over.
- Regenerating a section, a prompt or a single image now uses the models chosen in Settings.
- The Share button is now called Print view, which is what it opens.
- Film references on Mood & Tone no longer show an empty frame when there is no poster.
- The Start over button is solid ink like the form's other buttons, instead of a faded red.
- Wording: the app asks you to drop in a screenplay (it never accepted pasted text), and error messages no longer point to a hidden option.
- Long scripts are less likely to be cut off: output limits are raised to match what the current models allow.
- Errors from OpenAI, DeepSeek and Gemini now name the right provider instead of Claude, and a reply stopped by a provider's content filter says so.
- Storyboard, portrait and prop prompts now ask for no text or labels in the image.
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
