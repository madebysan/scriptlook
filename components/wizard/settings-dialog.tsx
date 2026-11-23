"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEXT_PROVIDERS,
  getTextModelLabel,
  getTextProviderOption,
  isExtractionProvider,
  isPlausibleModelId,
  normalizeTextModel,
} from "@/lib/ai-providers";
import { IMAGE_MODEL_OPTIONS } from "@/lib/image-models";
import {
  DEFAULT_IMAGE_PROMPTS,
  loadImagePrompts,
  saveImagePrompts,
  type ImagePromptKind,
} from "@/lib/image-prompts";
import { useApiKeys } from "@/lib/api-keys-context";
import { providersWithKeys, resolveReadingProvider } from "@/lib/settings-storage";
import { playUiAudio, readUiAudioEnabled, setUiAudioEnabled } from "@/lib/ui-audio";
import {
  FIELD_CLASS,
  HINT_CLASS,
  KeyField,
  LABEL_CLASS,
  LINK_CLASS,
  ProviderCells,
  SELECT_CLASS,
  SHEET_CLASS,
} from "@/components/wizard/form-parts";
import { ImageModelSelect } from "@/components/wizard/generation-confirmation-dialogs";
import { cn } from "@/lib/utils";

type SettingsTab = "writing" | "images";

const TABS: readonly { id: SettingsTab; label: string }[] = [
  { id: "writing", label: "Writing" },
  { id: "images", label: "Images" },
];

const CUSTOM_MODEL_VALUE = "custom";

const IMAGE_STYLE_KINDS: readonly { kind: ImagePromptKind; title: string }[] = [
  { kind: "storyboard", title: "Storyboard frames · 16:9" },
  { kind: "portrait", title: "Character portraits · square" },
  { kind: "prop", title: "Prop references · square" },
  { kind: "location", title: "Location references · 16:9" },
  { kind: "poster", title: "Poster concepts · 5:7" },
];

function loadStylePrompts(): Record<ImagePromptKind, string> {
  const stored = loadImagePrompts();
  return {
    storyboard: stored.storyboard ?? DEFAULT_IMAGE_PROMPTS.storyboard,
    portrait: stored.portrait ?? DEFAULT_IMAGE_PROMPTS.portrait,
    prop: stored.prop ?? DEFAULT_IMAGE_PROMPTS.prop,
    location: stored.location ?? DEFAULT_IMAGE_PROMPTS.location,
    poster: stored.poster ?? DEFAULT_IMAGE_PROMPTS.poster,
  };
}

// Settings as two short tabs. Writing holds the text key and model; Images
// holds the image keys, image models and styles. Everything saves as it is
// changed. Mount it only while it is open, so it starts from what is stored.
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>("writing");

  // Arrow keys move between the tabs, as a tab list is expected to.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;
    event.preventDefault();
    const next = TABS[nextIndex];
    setTab(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={`${SHEET_CLASS} max-h-[88vh] overflow-y-auto sm:max-w-xl`}>
        <DialogHeader>
          <DialogTitle className="form-sec-head text-[22px] text-foreground">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Keys, models and image styles. Changes are saved as you make them.
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Settings"
          onKeyDown={handleTabKeyDown}
          className="flex border-b-2 border-foreground"
        >
          {TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`settings-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={selected ? `settings-panel-${item.id}` : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.id)}
                className={cn(
                  "form-sec-head -mb-[2px] border-2 px-4 py-2 text-[12px] tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground",
                  selected
                    ? "border-foreground border-b-[var(--paper-sheet)] bg-[var(--paper-sheet)] text-foreground"
                    : "border-transparent text-foreground/55 hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          className="space-y-5 pt-1"
        >
          {tab === "writing" ? <WritingTab /> : <ImagesTab />}
        </div>

        <SettingsFooter />
      </DialogContent>
    </Dialog>
  );
}

function WritingTab() {
  const { settings, apiProvider, setApiProvider, setTextKey, setModelChoice } = useApiKeys();
  const option = getTextProviderOption(apiProvider);
  const choice = settings.modelChoices[apiProvider];
  const listedModel = normalizeTextModel(apiProvider, choice.model);
  const cannotRead = !isExtractionProvider(apiProvider) && resolveReadingProvider(settings) === null;
  // A typed ID the app cannot send (empty, or not shaped like a model ID) is
  // not used; say so, and name the model that is.
  const customUnusable = choice.useCustom && !isPlausibleModelId(choice.customModel);

  return (
    <>
      <div className="space-y-2">
        <div className={LABEL_CLASS}>Written by</div>
        <ProviderCells
          label="Provider that writes the deck"
          providers={TEXT_PROVIDERS}
          value={apiProvider}
          savedProviders={providersWithKeys(settings)}
          onChange={setApiProvider}
        />
      </div>

      <KeyField
        id="settings-text-key"
        label={option.keyLabel}
        keyUrl={option.keyUrl}
        placeholder={option.placeholder}
        value={settings.textKeys[apiProvider]}
        onChange={(value) => setTextKey(apiProvider, value)}
      />
      {cannotRead && (
        <p className={HINT_CLASS}>Reading a screenplay also needs a Claude or OpenAI key.</p>
      )}

      <div className="space-y-2">
        <label htmlFor="settings-text-model" className={LABEL_CLASS}>
          Model
        </label>
        <select
          id="settings-text-model"
          value={choice.useCustom ? CUSTOM_MODEL_VALUE : listedModel}
          onChange={(event) =>
            event.target.value === CUSTOM_MODEL_VALUE
              ? setModelChoice(apiProvider, { useCustom: true })
              : setModelChoice(apiProvider, { model: event.target.value, useCustom: false })
          }
          className={SELECT_CLASS}
        >
          {option.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} · {model.tier}
            </option>
          ))}
          <option value={CUSTOM_MODEL_VALUE}>Other model…</option>
        </select>

        {choice.useCustom ? (
          <div className="space-y-2 pt-1">
            <label htmlFor="settings-custom-model" className={LABEL_CLASS}>
              Model ID
            </label>
            <input
              id="settings-custom-model"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={option.model}
              value={choice.customModel}
              onChange={(event) => setModelChoice(apiProvider, { customModel: event.target.value })}
              className={FIELD_CLASS}
            />
            {customUnusable && choice.customModel.trim().length > 0 ? (
              <p className={`${HINT_CLASS} font-bold text-foreground`}>
                Not a usable model ID. Writing uses {getTextModelLabel(apiProvider, listedModel)}{" "}
                until this is fixed.
              </p>
            ) : customUnusable ? (
              <p className={HINT_CLASS}>
                Type it exactly as {option.company} lists it. Until then, writing uses{" "}
                {getTextModelLabel(apiProvider, listedModel)}.
              </p>
            ) : (
              <p className={HINT_CLASS}>
                Type it exactly as {option.company} lists it. Used for writing the deck; reading a
                screenplay keeps its own model.
              </p>
            )}
          </div>
        ) : (
          <p className={HINT_CLASS}>
            {option.models.find((model) => model.id === listedModel)?.description}
          </p>
        )}
      </div>
    </>
  );
}

function ImagesTab() {
  const { settings, setFalKey, setTmdbKey, setDeckImageModel, setPosterImageModel } = useApiKeys();
  const [stylesOpen, setStylesOpen] = useState(false);
  const [stylePrompts, setStylePrompts] = useState(loadStylePrompts);

  const editedCount = IMAGE_STYLE_KINDS.filter(
    ({ kind }) => stylePrompts[kind].trim() !== DEFAULT_IMAGE_PROMPTS[kind],
  ).length;

  const changeStyle = (kind: ImagePromptKind, value: string) => {
    const next = { ...stylePrompts, [kind]: value };
    setStylePrompts(next);
    // Store only what differs from the defaults, so clearing a field (or
    // pressing Reset) goes back to the default style.
    const overrides: Partial<Record<ImagePromptKind, string>> = {};
    for (const { kind: each } of IMAGE_STYLE_KINDS) {
      if (next[each].trim() && next[each].trim() !== DEFAULT_IMAGE_PROMPTS[each]) {
        overrides[each] = next[each];
      }
    }
    saveImagePrompts(overrides);
  };

  return (
    <>
      <KeyField
        id="settings-fal-key"
        label="fal.ai API key"
        qualifier="generates images"
        keyUrl="https://fal.ai/dashboard/keys"
        placeholder="fal-..."
        value={settings.falKey}
        onChange={setFalKey}
      />
      <KeyField
        id="settings-tmdb-key"
        label="TMDB API key"
        qualifier="optional, adds poster thumbnails"
        keyUrl="https://www.themoviedb.org/settings/api"
        placeholder="TMDB API key (v3 auth)"
        value={settings.tmdbKey}
        onChange={setTmdbKey}
      />

      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="settings-deck-model" className={LABEL_CLASS}>
              Deck images
            </label>
            <ImageModelSelect
              id="settings-deck-model"
              value={settings.deckImageModel}
              onChange={setDeckImageModel}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-poster-model" className={LABEL_CLASS}>
              Posters
            </label>
            <ImageModelSelect
              id="settings-poster-model"
              value={settings.posterImageModel}
              onChange={setPosterImageModel}
            />
          </div>
        </div>
        <p className={HINT_CLASS}>
          See examples:{" "}
          {IMAGE_MODEL_OPTIONS.map((model, index) => (
            <span key={model.id}>
              {index > 0 && " · "}
              <a href={model.exampleUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {model.label} ↗
              </a>
            </span>
          ))}
        </p>
      </div>

      <div className="space-y-4 border-t border-[var(--paper-rule-soft)] pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[13px]">
            <span className={LABEL_CLASS}>Image styles</span>
            <span className="font-normal text-muted-foreground">
              {" "}
              · {editedCount === 0 ? "default sketch style" : `${editedCount} of 5 edited`}
            </span>
          </div>
          <button
            type="button"
            aria-expanded={stylesOpen}
            aria-controls="settings-image-styles"
            onClick={() => setStylesOpen((open) => !open)}
            className={LINK_CLASS}
          >
            {stylesOpen ? "Hide styles" : "Edit styles"}
          </button>
        </div>

        {stylesOpen && (
          <div id="settings-image-styles" className="space-y-4">
            {IMAGE_STYLE_KINDS.map(({ kind, title }) => {
              const edited = stylePrompts[kind].trim() !== DEFAULT_IMAGE_PROMPTS[kind];
              return (
                <div key={kind} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={`settings-style-${kind}`} className={LABEL_CLASS}>
                      {title}
                    </label>
                    {edited && (
                      <button
                        type="button"
                        onClick={() => changeStyle(kind, DEFAULT_IMAGE_PROMPTS[kind])}
                        className={LINK_CLASS}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <textarea
                    id={`settings-style-${kind}`}
                    value={stylePrompts[kind]}
                    onChange={(event) => changeStyle(kind, event.target.value)}
                    rows={4}
                    placeholder={DEFAULT_IMAGE_PROMPTS[kind]}
                    className={`${FIELD_CLASS} resize-y text-[12px] leading-[1.55]`}
                  />
                </div>
              );
            })}
            <p className={HINT_CLASS}>
              Only new images use these. Existing images stay as they are.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function SettingsFooter() {
  const [soundOn, setSoundOn] = useState(readUiAudioEnabled);

  const toggleSound = (next: boolean) => {
    setUiAudioEnabled(next);
    setSoundOn(next);
    if (next) playUiAudio("success");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-foreground pt-4">
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={soundOn}
          onChange={(event) => toggleSound(event.target.checked)}
          className="size-4 accent-[var(--paper-ink)]"
        />
        Interface sounds
      </label>
      <p className="text-[11px] text-foreground/55">
        Keys stay in this browser and are only sent when you generate.
      </p>
    </div>
  );
}
