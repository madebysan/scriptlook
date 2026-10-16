"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Settings, RotateCcw, FileText, Download, Share2, Images, Loader2 } from "lucide-react";
import { parseStoryboardPrompts } from "@/components/viewers/storyboard-viewer";
import { parsePosterConcepts } from "@/components/viewers/poster-concepts-viewer";
import { HeaderButton, MoreMenu } from "./header-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StepInstructions } from "./step-instructions";
import { StepGenerating } from "./step-generating";
import { StepResults } from "./step-results";
import { TextProviderFields } from "./text-provider-fields";
import {
  ImageConfirmationDialog,
  TextConfirmationDialog,
} from "./generation-confirmation-dialogs";
import { DeliverablesDialog } from "./deliverables-dialog";
import {
  type SavedImage,
  type SavedProject,
  loadProject,
  saveProject,
  clearProject,
  extractTitle,
} from "@/lib/reports";
import { useApiKeys } from "@/lib/api-keys-context";
import {
  getTextProviderOption,
  normalizeTextModel,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  DEFAULT_DECK_IMAGE_MODEL,
  DEFAULT_POSTER_IMAGE_MODEL,
  type ImageModel,
} from "@/lib/image-models";
import {
  type ImagePromptKind,
  DEFAULT_IMAGE_PROMPTS,
  loadImagePrompts,
  saveImagePrompts,
  getStylePrefix,
} from "@/lib/image-prompts";
import {
  buildLocationImagePrompt,
  getLocationImageKey,
  getPriorityLocations,
} from "@/lib/location-images";
import { cn, downloadBlob } from "@/lib/utils";
import { normalizeScreenplayData } from "@/lib/schema";
import {
  DEFAULT_DELIVERABLES,
  LEGACY_DELIVERABLES,
  getGeneratedDocuments,
  hasImageDeliverables,
  normalizeDeliverables,
  resolveDeliverableDependencies,
  type DeliverableId,
} from "@/lib/deliverables";

export type DocumentResult = {
  name: string;
  slug: string;
  status: "pending" | "generating" | "done" | "error";
  content: string | null;
  error: string | null;
};

function buildPendingDocuments(deliverables: readonly DeliverableId[]): DocumentResult[] {
  return getGeneratedDocuments(deliverables).map((document) => ({
    ...document,
    status: "pending",
    content: null,
    error: null,
  }));
}

export function WizardShell() {
  const {
    apiProvider,
    apiKey,
    falKey,
    tmdbKey,
    setApiProvider,
    setApiKey,
    setFalKey,
    setTmdbKey,
  } = useApiKeys();
  const [hydrated, setHydrated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [jsonData, setJsonData] = useState<string>("");
  const [deliverables, setDeliverables] = useState<DeliverableId[]>([...DEFAULT_DELIVERABLES]);
  const [documents, setDocuments] = useState<DocumentResult[]>(() => buildPendingDocuments(DEFAULT_DELIVERABLES));
  const [showSettings, setShowSettings] = useState(false);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [showTextConfirmation, setShowTextConfirmation] = useState(false);
  const [textModel, setTextModel] = useState(getTextProviderOption(apiProvider).model);
  const [confirmedTextModel, setConfirmedTextModel] = useState(getTextProviderOption(apiProvider).model);
  const [showImageConfirmation, setShowImageConfirmation] = useState(false);
  const [deckImageModel, setDeckImageModel] = useState<ImageModel>(DEFAULT_DECK_IMAGE_MODEL);
  const [posterImageModel, setPosterImageModel] = useState<ImageModel>(DEFAULT_POSTER_IMAGE_MODEL);
  const [imageConfirmationCounts, setImageConfirmationCounts] = useState({ deck: 0, posters: 0 });
  const [imagePrompts, setImagePrompts] = useState<Record<ImagePromptKind, string>>({
    storyboard: DEFAULT_IMAGE_PROMPTS.storyboard,
    portrait: DEFAULT_IMAGE_PROMPTS.portrait,
    prop: DEFAULT_IMAGE_PROMPTS.prop,
    location: DEFAULT_IMAGE_PROMPTS.location,
    poster: DEFAULT_IMAGE_PROMPTS.poster,
  });
  const [storyboardImages, setStoryboardImages] = useState<Record<number, SavedImage>>({});
  const [promptOverrides, setPromptOverrides] = useState<Record<number, string>>({});
  const [posterImages, setPosterImages] = useState<Record<number, SavedImage>>({});
  const [portraits, setPortraits] = useState<Record<string, SavedImage>>({});
  const [propImages, setPropImages] = useState<Record<string, SavedImage>>({});
  const [locationImages, setLocationImages] = useState<Record<string, SavedImage>>({});
  const [disabledItems, setDisabledItems] = useState<Record<string, boolean>>({});
  const hasImageGenerationKey = Boolean(falKey.trim());
  const projectSnapshotRef = useRef<SavedProject | null>(null);
  const portraitsRef = useRef<Record<string, SavedImage>>(portraits);
  const propImagesRef = useRef<Record<string, SavedImage>>(propImages);
  const locationImagesRef = useRef<Record<string, SavedImage>>(locationImages);
  const storyboardImagesRef = useRef<Record<number, SavedImage>>(storyboardImages);
  const posterImagesRef = useRef<Record<number, SavedImage>>(posterImages);

  const persistProject = useCallback(
    (project: SavedProject) => {
      projectSnapshotRef.current = project;
      saveProject(project);
    },
    [],
  );

  const persistProjectPatch = useCallback(
    (patch: Partial<SavedProject>) => {
      const current = projectSnapshotRef.current;
      if (!current) return;
      persistProject({ ...current, ...patch });
    },
    [persistProject],
  );

  // Hydrate from localStorage on mount.
  // setState in an effect is intentional here: we need SSR to render a neutral
  // "Loading..." state and only read localStorage after client hydration to
  // avoid hydration mismatch. React 18+ auto-batches these updates.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const project = loadProject();
    if (project) {
      projectSnapshotRef.current = project;
      setJsonData(project.jsonData || "");
      setDocuments(
        project.documents.map((d) => ({
          ...d,
          status: d.status as DocumentResult["status"],
        }))
      );
      setDeliverables(normalizeDeliverables(project.deliverables, LEGACY_DELIVERABLES));
      setStoryboardImages(project.images || {});
      setPromptOverrides(project.promptOverrides || {});
      setPosterImages(project.posterImages || {});
      setPortraits(project.portraits || {});
      setPropImages(project.propImages || {});
      setLocationImages(project.locationImages || {});
      setDisabledItems(project.disabledItems || {});
      setCurrentStep(3);
    }
    document.documentElement.classList.add("dark");
    // Merge stored overrides into defaults so blank fields fall back cleanly.
    const stored = loadImagePrompts();
    setImagePrompts({
      storyboard: stored.storyboard ?? DEFAULT_IMAGE_PROMPTS.storyboard,
      portrait: stored.portrait ?? DEFAULT_IMAGE_PROMPTS.portrait,
      prop: stored.prop ?? DEFAULT_IMAGE_PROMPTS.prop,
      location: stored.location ?? DEFAULT_IMAGE_PROMPTS.location,
      poster: stored.poster ?? DEFAULT_IMAGE_PROMPTS.poster,
    });
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleImagePromptChange = (kind: ImagePromptKind, value: string) => {
    const next = { ...imagePrompts, [kind]: value };
    setImagePrompts(next);
    // Persist only entries that differ from defaults so a blank reset restores defaults.
    const overrides: Partial<Record<ImagePromptKind, string>> = {};
    for (const k of Object.keys(next) as ImagePromptKind[]) {
      if (next[k].trim() && next[k].trim() !== DEFAULT_IMAGE_PROMPTS[k]) {
        overrides[k] = next[k];
      }
    }
    saveImagePrompts(overrides);
  };

  const handleTextProviderChange = (provider: TextProvider) => {
    if (provider === apiProvider) return;
    setApiProvider(provider);
    setApiKey("");
    setTextModel(getTextProviderOption(provider).model);
  };

  const handleResetImagePrompt = (kind: ImagePromptKind) => {
    handleImagePromptChange(kind, DEFAULT_IMAGE_PROMPTS[kind]);
  };

  const handleJsonSubmit = (json: string) => {
    setPendingJson(normalizeScreenplayData(json));
    setTextModel((currentModel) => normalizeTextModel(apiProvider, currentModel));
    setDeliverables([...DEFAULT_DELIVERABLES]);
    setShowDeliverables(true);
  };

  const handleConfirmDeliverables = () => {
    if (!pendingJson) return;
    const resolvedDeliverables = resolveDeliverableDependencies(deliverables);
    const pendingDocuments = buildPendingDocuments(resolvedDeliverables);
    setDeliverables(resolvedDeliverables);
    setDocuments(pendingDocuments);
    setShowDeliverables(false);

    if (pendingDocuments.length > 0) {
      setShowTextConfirmation(true);
      return;
    }

    const nextJsonData = pendingJson;
    setJsonData(nextJsonData);
    setPendingJson(null);
    setStoryboardImages({});
    setPromptOverrides({});
    setPosterImages({});
    setPortraits({});
    setPropImages({});
    setLocationImages({});
    setDisabledItems({});
    setCurrentStep(3);
    persistProject({
      title: extractTitle(nextJsonData),
      createdAt: new Date().toISOString(),
      jsonData: nextJsonData,
      deliverables: resolvedDeliverables,
      documents: [],
      images: {},
      posterImages: {},
      portraits: {},
      propImages: {},
      locationImages: {},
      disabledItems: {},
    });
  };

  const handleConfirmTextGeneration = () => {
    if (!pendingJson) return;
    const selectedModel = normalizeTextModel(apiProvider, textModel);
    setConfirmedTextModel(selectedModel);
    setJsonData(pendingJson);
    setPendingJson(null);
    setShowTextConfirmation(false);
    setCurrentStep(2);
  };

  const handleGenerationComplete = useCallback(
    (results: DocumentResult[]) => {
      setDocuments(results);
      setCurrentStep(3);

      persistProject({
        title: extractTitle(jsonData),
        createdAt: new Date().toISOString(),
        jsonData,
        deliverables,
        documents: results.map((d) => ({
          name: d.name,
          slug: d.slug,
          status: d.status === "done" ? "done" : "error",
          content: d.content,
          error: d.error,
        })),
        images: storyboardImagesRef.current,
        promptOverrides,
        posterImages: posterImagesRef.current,
        portraits: portraitsRef.current,
        propImages: propImagesRef.current,
        locationImages: locationImagesRef.current,
        disabledItems,
      });
    },
    [
      disabledItems,
      deliverables,
      jsonData,
      persistProject,
      promptOverrides,
    ]
  );

  const handleDownloadAll = () => {
    documents
      .filter((d) => d.status === "done" && d.content)
      .forEach((doc) => {
        downloadBlob(doc.content!, `${doc.slug}.md`, "text/markdown");
      });
    if (jsonData) {
      downloadBlob(jsonData, "screenplay-data.json", "application/json");
    }
  };

  const handleStartOver = () => {
    clearProject();
    setCurrentStep(1);
    setJsonData("");
    setDeliverables([...DEFAULT_DELIVERABLES]);
    setDocuments(buildPendingDocuments(DEFAULT_DELIVERABLES));
    setStoryboardImages({});
    setPromptOverrides({});
    setPosterImages({});
    setPortraits({});
    setPropImages({});
    setLocationImages({});
    setDisabledItems({});
  };

  const handleImagesChange = useCallback((images: Record<number, SavedImage>) => {
    setStoryboardImages(images);
    persistProjectPatch({ images });
  }, [persistProjectPatch]);

  const handlePromptOverridesChange = useCallback((promptOverrides: Record<number, string>) => {
    setPromptOverrides(promptOverrides);
    persistProjectPatch({ promptOverrides });
  }, [persistProjectPatch]);

  const handlePosterImagesChange = useCallback((posterImages: Record<number, SavedImage>) => {
    setPosterImages(posterImages);
    persistProjectPatch({ posterImages });
  }, [persistProjectPatch]);

  const handlePortraitsChange = useCallback((portraits: Record<string, SavedImage>) => {
    setPortraits(portraits);
    persistProjectPatch({ portraits });
  }, [persistProjectPatch]);

  const handlePropImagesChange = useCallback((images: Record<string, SavedImage>) => {
    setPropImages(images);
    persistProjectPatch({ propImages: images });
  }, [persistProjectPatch]);

  const handleLocationImagesChange = useCallback((images: Record<string, SavedImage>) => {
    setLocationImages(images);
    persistProjectPatch({ locationImages: images });
  }, [persistProjectPatch]);

  const handleDisabledItemsChange = useCallback((disabled: Record<string, boolean>) => {
    setDisabledItems(disabled);
    persistProjectPatch({ disabledItems: disabled });
  }, [persistProjectPatch]);

  const handleJsonDataChange = useCallback((newJsonData: string) => {
    setJsonData(newJsonData);
    persistProjectPatch({ jsonData: newJsonData });
  }, [persistProjectPatch]);

  // --- Image generation: task queue ---
  //
  // Tasks are enqueued incrementally. Portraits + props fire the moment JSON
  // is ready; storyboard + poster images fire the moment their parent Claude
  // doc lands. Everything runs in the background in parallel with text
  // generation. A single worker drains the queue with 500ms stagger between
  // task starts — each task runs independently and updates its accumulator
  // ref atomically (JS's single-threaded event loop makes the read-modify-
  // write safe for concurrent task resolutions).
  type ImageTaskKind = "portrait" | "prop" | "location" | "storyboard" | "poster";
  type ImageTask = {
    key: string;
    kind: ImageTaskKind;
    run: (falKey: string) => Promise<void>;
  };

  const [imageGen, setImageGen] = useState<{
    running: boolean;
    done: number;
    total: number;
    failed: number;
  }>({ running: false, done: 0, total: 0, failed: 0 });

  const imageQueueRef = useRef<ImageTask[]>([]);
  const imageEnqueuedKeysRef = useRef<Set<string>>(new Set());
  const imageWorkerActiveRef = useRef(false);
  const imageInFlightRef = useRef(0);
  const imageCancelRef = useRef(false);

  // Accumulator refs stay in sync with state so concurrent tasks can merge
  // results without clobbering each other. Declared BEFORE the auto-enqueue
  // effect so hydration syncs land before we start reading refs.
  const falKeyRef = useRef<string>(falKey);
  const promptOverridesRef = useRef<Record<number, string>>(promptOverrides);
  const deckImageModelRef = useRef<ImageModel>(deckImageModel);
  const posterImageModelRef = useRef<ImageModel>(posterImageModel);
  const pendingImageTasksRef = useRef<ImageTask[]>([]);

  useEffect(() => { portraitsRef.current = portraits; }, [portraits]);
  useEffect(() => { propImagesRef.current = propImages; }, [propImages]);
  useEffect(() => { locationImagesRef.current = locationImages; }, [locationImages]);
  useEffect(() => { storyboardImagesRef.current = storyboardImages; }, [storyboardImages]);
  useEffect(() => { posterImagesRef.current = posterImages; }, [posterImages]);
  useEffect(() => { falKeyRef.current = falKey; }, [falKey]);
  useEffect(() => { promptOverridesRef.current = promptOverrides; }, [promptOverrides]);
  useEffect(() => { deckImageModelRef.current = deckImageModel; }, [deckImageModel]);
  useEffect(() => { posterImageModelRef.current = posterImageModel; }, [posterImageModel]);

  const buildPortraitTasks = (
    json: string,
    existing: Record<string, SavedImage>,
  ): ImageTask[] => {
    let parsed: { characters?: { name: string; description?: string }[] } = {};
    try { parsed = JSON.parse(json); } catch { return []; }
    const tasks: ImageTask[] = [];
    const characters = parsed.characters || [];
    for (const char of characters) {
      if (existing[char.name]) continue;
      tasks.push({
        key: `portrait:${char.name}`,
        kind: "portrait",
        run: async (fk) => {
          const res = await fetch("/api/generate-portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: char.name,
              description: char.description,
              stylePrefix: getStylePrefix("portrait"),
              imageModel: deckImageModelRef.current,
              apiKey: fk,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { url } = await res.json();
          const next = { ...portraitsRef.current, [char.name]: { status: "done" as const, url } };
          portraitsRef.current = next;
          handlePortraitsChange(next);
        },
      });
    }
    return tasks;
  };

  const buildPropTasks = (
    json: string,
    existing: Record<string, SavedImage>,
  ): ImageTask[] => {
    let parsed: { props_master?: { item: string; notes?: string }[] } = {};
    try { parsed = JSON.parse(json); } catch { return []; }
    const tasks: ImageTask[] = [];
    const props = parsed.props_master || [];
    for (const prop of props) {
      if (existing[prop.item]) continue;
      tasks.push({
        key: `prop:${prop.item}`,
        kind: "prop",
        run: async (fk) => {
          const res = await fetch("/api/generate-prop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: prop.item,
              notes: prop.notes,
              stylePrefix: getStylePrefix("prop"),
              imageModel: deckImageModelRef.current,
              apiKey: fk,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { url } = await res.json();
          const next = { ...propImagesRef.current, [prop.item]: { status: "done" as const, url } };
          propImagesRef.current = next;
          handlePropImagesChange(next);
        },
      });
    }
    return tasks;
  };

  const buildLocationTasks = (
    json: string,
    existing: Record<string, SavedImage>,
  ): ImageTask[] => {
    let parsed: {
      locations?: {
        name: string;
        description?: string;
        scenes?: number[];
        int_ext?: string;
        time_variations?: string[];
        set_requirements?: string[];
      }[];
      scenes?: {
        scene_number: number;
        location?: string;
        key_visual_moment?: string;
        time_of_day?: string;
        int_ext?: string;
        vfx_stunts?: string[];
      }[];
    } = {};
    try { parsed = JSON.parse(json); } catch { return []; }

    const locations = parsed.locations ?? [];
    const scenes = parsed.scenes ?? [];
    const priorityLocations = getPriorityLocations(locations, scenes);
    const tasks: ImageTask[] = [];
    for (const location of priorityLocations) {
      const key = getLocationImageKey(location);
      if (existing[key]) continue;
      tasks.push({
        key: `location:${key}`,
        kind: "location",
        run: async (fk) => {
          const res = await fetch("/api/generate-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: location.name,
              prompt: buildLocationImagePrompt(location, scenes),
              stylePrefix: getStylePrefix("location"),
              imageModel: deckImageModelRef.current,
              apiKey: fk,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { url } = await res.json();
          const next = {
            ...locationImagesRef.current,
            [key]: { status: "done" as const, url },
          };
          locationImagesRef.current = next;
          handleLocationImagesChange(next);
        },
      });
    }
    return tasks;
  };

  const buildStoryboardTasks = (
    sbContent: string,
    existing: Record<number, SavedImage>,
    overrides: Record<number, string>,
  ): ImageTask[] => {
    const tasks: ImageTask[] = [];
    const { acts } = parseStoryboardPrompts(sbContent);
    for (const act of acts) {
      for (const scene of act.scenes) {
        if (existing[scene.number]) continue;
        const prompt = overrides[scene.number] || scene.prompt;
        const camera = scene.camera;
        const num = scene.number;
        tasks.push({
          key: `storyboard:${num}`,
          kind: "storyboard",
          run: async (fk) => {
            const res = await fetch("/api/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                camera,
                stylePrefix: getStylePrefix("storyboard"),
                imageModel: deckImageModelRef.current,
                apiKey: fk,
              }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { url } = await res.json();
            const next = { ...storyboardImagesRef.current, [num]: { status: "done" as const, url } };
            storyboardImagesRef.current = next;
            handleImagesChange(next);
          },
        });
      }
    }
    return tasks;
  };

  const buildPosterTasks = (
    posterContent: string,
    existing: Record<number, SavedImage>,
  ): ImageTask[] => {
    const tasks: ImageTask[] = [];
    const { concepts } = parsePosterConcepts(posterContent);
    for (const concept of concepts) {
      if (existing[concept.number]) continue;
      // Build the poster prompt from the richest field that parsed. Different
      // text providers format poster concepts differently (the prompts were
      // tuned against one), so fall back across fields and skip the task entirely
      // if nothing usable parsed — firing an empty prompt 400s the route and
      // spams the console.
      const descriptor =
        concept.aiPrompt.trim() ||
        concept.composition.trim() ||
        [concept.name, concept.mood, concept.tagline]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(". ");
      if (!descriptor) continue;
      const prompt = concept.style.trim()
        ? `${descriptor} Style: ${concept.style.trim()}.`
        : descriptor;
      const num = concept.number;
      tasks.push({
        key: `poster:${num}`,
        kind: "poster",
        run: async (fk) => {
          const res = await fetch("/api/generate-poster-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              stylePrefix: getStylePrefix("poster"),
              imageModel: posterImageModelRef.current,
              apiKey: fk,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { url } = await res.json();
          const next = { ...posterImagesRef.current, [num]: { status: "done" as const, url } };
          posterImagesRef.current = next;
          handlePosterImagesChange(next);
        },
      });
    }
    return tasks;
  };

  function runImageWorker() {
    if (imageWorkerActiveRef.current) return;
    imageWorkerActiveRef.current = true;
    imageCancelRef.current = false;
    (async () => {
      let paymentAborted = false;
      // Outer loop: after the drain + settle cycle, re-check the queue. If
      // enqueueImageTasks was called while we were waiting for in-flight
      // tasks to finish, those tasks would otherwise be orphaned here —
      // adding this re-check means the worker picks up mid-settle enqueues
      // instead of going idle with unprocessed tasks sitting in the queue.
      while (!imageCancelRef.current) {
        // Drain loop — fire tasks with 500ms stagger between starts.
        while (imageQueueRef.current.length > 0) {
          if (imageCancelRef.current) break;
          const fk = falKeyRef.current;
          if (!fk) {
            imageQueueRef.current.length = 0;
            imageEnqueuedKeysRef.current.clear();
            break;
          }
          const task = imageQueueRef.current.shift()!;
          imageInFlightRef.current++;
          // Fire-and-forget — stagger starts by 500ms but let each task
          // resolve independently so a slow one doesn't block the rest.
          task.run(fk)
            .catch((e) => {
              const msg = e instanceof Error ? e.message : String(e);
              if (/402|payment|quota|insufficient/.test(msg)) {
                paymentAborted = true;
                imageCancelRef.current = true;
                imageQueueRef.current.length = 0;
                console.error("[images] credits exhausted", msg);
              } else {
                console.error(`[images] ${task.kind} ${task.key} failed:`, msg);
              }
              setImageGen((p) => ({ ...p, failed: p.failed + 1 }));
            })
            .finally(() => {
              imageInFlightRef.current--;
              imageEnqueuedKeysRef.current.delete(task.key);
              setImageGen((p) => {
                const newDone = p.done + 1;
                const idle =
                  imageQueueRef.current.length === 0 &&
                  imageInFlightRef.current === 0;
                // On the final settle, snap counters clean so the next wave
                // starts from 0/0 instead of inheriting stale progress.
                if (idle) {
                  return { running: false, done: 0, total: 0, failed: p.failed };
                }
                // Never let done exceed total — clamp as a safety net so
                // the badge can't display impossible states like "49/33".
                return {
                  ...p,
                  done: newDone,
                  total: Math.max(p.total, newDone),
                  running: true,
                };
              });
            });
          await new Promise((r) => setTimeout(r, 500));
        }
        // Wait for the last in-flight tasks to settle.
        while (imageInFlightRef.current > 0) {
          await new Promise((r) => setTimeout(r, 100));
        }
        // Re-check: if enqueue pushed new tasks while we were settling, loop
        // back into the drain phase instead of going idle.
        if (imageQueueRef.current.length === 0) break;
      }
      imageWorkerActiveRef.current = false;
      if (paymentAborted) {
        alert("Image generation stopped — your fal.ai API key is out of credits.");
      }
    })();
  }

  // Core enqueue + worker. Dedupes via a Set so overlapping enqueues don't
  // fire the same task twice, but releases the key on task settle so failed
  // tasks can be retried on a subsequent manual run.
  const enqueueImageTasks = useCallback((tasks: ImageTask[]) => {
    if (!falKeyRef.current) return;
    const novel = tasks.filter((t) => !imageEnqueuedKeysRef.current.has(t.key));
    if (novel.length === 0) return;
    for (const t of novel) imageEnqueuedKeysRef.current.add(t.key);
    imageQueueRef.current.push(...novel);
    const workerWasIdle = !imageWorkerActiveRef.current;
    // When the worker was idle, we're starting a fresh wave — reset counters
    // so the progress badge reads cleanly for this run.
    setImageGen((p) =>
      workerWasIdle
        ? { running: true, done: 0, total: novel.length, failed: 0 }
        : { ...p, total: p.total + novel.length, running: true },
    );
    if (workerWasIdle) runImageWorker();
  }, []);

  const cancelImageGen = () => {
    imageCancelRef.current = true;
    imageQueueRef.current.length = 0;
    imageEnqueuedKeysRef.current.clear();
  };

  const handleGenerateAllImages = () => {
    if (imageGen.running) {
      cancelImageGen();
      return;
    }
    if (!jsonData) return;

    const selected = new Set(deliverables);
    const tasks: ImageTask[] = [];
    if (selected.has("cast-and-crew")) {
      tasks.push(...buildPortraitTasks(jsonData, portraitsRef.current));
    }
    if (selected.has("production")) {
      tasks.push(...buildPropTasks(jsonData, propImagesRef.current));
    }
    if (selected.has("locations")) {
      tasks.push(...buildLocationTasks(jsonData, locationImagesRef.current));
    }
    const sbDoc = documents.find((d) => d.slug === "storyboard-prompts");
    if (selected.has("storyboards") && sbDoc?.content) {
      tasks.push(
        ...buildStoryboardTasks(sbDoc.content, storyboardImagesRef.current, promptOverridesRef.current),
      );
    }
    const posterDoc = documents.find((d) => d.slug === "poster-concepts");
    if (selected.has("posters") && posterDoc?.content) {
      tasks.push(...buildPosterTasks(posterDoc.content, posterImagesRef.current));
    }

    pendingImageTasksRef.current = tasks;
    const posterCount = tasks.filter((task) => task.kind === "poster").length;
    setImageConfirmationCounts({ deck: tasks.length - posterCount, posters: posterCount });
    setShowImageConfirmation(true);
  };

  const handleConfirmImageGeneration = () => {
    falKeyRef.current = falKey;
    deckImageModelRef.current = deckImageModel;
    posterImageModelRef.current = posterImageModel;
    setShowImageConfirmation(false);
    enqueueImageTasks(pendingImageTasksRef.current);
    pendingImageTasksRef.current = [];
  };

  const handleDocumentUpdate = (slug: string, newContent: string) => {
    const updated = documents.map((d) =>
      d.slug === slug ? { ...d, content: newContent } : d
    );
    setDocuments(updated);
    persistProjectPatch({
      documents: updated.map((d) => ({
        name: d.name,
        slug: d.slug,
        status: d.status === "done" ? ("done" as const) : ("error" as const),
        content: d.content,
        error: d.error,
      })),
    });
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading Scriptlook...</p>
      </div>
    );
  }

  const hasActiveProject = currentStep === 3;
  const hasSelectedImageDeliverables = hasImageDeliverables(deliverables);
  const settingsIsPaper = true;
  const settingsInputClass = cn(
    "w-full px-3 py-2.5 font-mono text-[13px] placeholder:text-muted-foreground/50 focus:outline-none",
    settingsIsPaper
      ? "border border-border bg-background/60 text-foreground [border-radius:0!important] focus:border-foreground focus:ring-2 focus:ring-foreground/20"
      : "rounded-[8px] bg-card/60 shadow-pill focus:shadow-paper-hover",
  );
  const settingsTextareaClass = cn(
    "w-full resize-y px-3 py-2.5 font-mono text-[12px] leading-[1.55] text-foreground/90 placeholder:text-muted-foreground/50 focus:outline-none",
    settingsIsPaper
      ? "border border-border bg-background/60 [border-radius:0!important] focus:border-foreground focus:ring-2 focus:ring-foreground/20"
      : "rounded-[8px] bg-card/60 shadow-pill focus:shadow-paper-hover",
  );
  const settingsSectionLabelClass = cn(
    "font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground pb-3 border-b",
    settingsIsPaper ? "border-foreground" : "border-border/60",
  );

  return (
    <div className="paper min-h-screen bg-background">
      <header className="relative z-50 border-b-2 border-foreground bg-background text-foreground">
        <div
          className={`mx-auto max-w-[1180px] px-4 sm:px-6 ${
            currentStep === 1 ? "py-3.5" : "py-2.5"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {currentStep === 1 ? (
                <Link
                  href="/"
                  data-ui-audio="open"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border-2 border-foreground bg-background px-5 py-2.5 font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-[var(--paper-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <span>Go back</span>
                </Link>
              ) : (
                <Link
                  href="/"
                  data-ui-audio="open"
                  className="paper-motion-button inline-flex min-h-10 shrink-0 items-center border-2 border-foreground bg-[var(--paper-sheet)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  aria-label="Back to Scriptlook homepage"
                >
                  <span className="form-sec-head text-[15px] leading-none">Scriptlook</span>
                  <span className="ml-3 hidden border-l border-foreground/40 pl-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/60 sm:inline">
                    Film vision deck
                  </span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {imageGen.running && (
                <button
                  onClick={handleGenerateAllImages}
                  title="Click to cancel"
                  className="inline-flex min-h-9 items-center gap-1.5 border border-foreground bg-[var(--paper-highlight)] px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-foreground transition-colors sm:px-3"
                >
                  <Loader2 size={13} className="animate-spin" />
                  <span className="tabular-nums">
                    {imageGen.done}/{imageGen.total}
                  </span>
                  <span className="hidden text-primary/70 sm:inline">images</span>
                </button>
              )}
              {hasActiveProject && (
                <HeaderButton
                  icon={<Share2 size={14} />}
                  label="Share"
                  audioCue="open"
                  onClick={() => { window.location.href = "/app/share"; }}
                  title="Open share view"
                />
              )}
              {hasActiveProject && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <HeaderButton
                      icon={<RotateCcw size={14} />}
                      label="Start Over"
                      audioCue="cancel"
                      onClick={() => {}}
                      title="Clear this project"
                    />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="paper border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start over?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This clears the report, images, and edits from this browser.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={handleStartOver}
                        className="min-w-28"
                      >
                        Start over
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  title="Settings"
                  aria-label="Settings"
                  data-ui-audio="toggle"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-foreground bg-background px-3 py-2.5 text-foreground transition-colors hover:bg-[var(--paper-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <Settings size={18} />
                </button>
              ) : (
                <MoreMenu
                  items={[
                    hasActiveProject && hasSelectedImageDeliverables
                      ? {
                          icon: imageGen.running ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Images size={14} />
                          ),
                          label: imageGen.running
                            ? `Generating ${imageGen.done}/${imageGen.total}… (click to cancel)`
                            : "Generate missing images",
                          onClick: handleGenerateAllImages,
                        }
                      : null,
                    // Show a separate "Retry N failed" action when the last batch
                    // had failures. It's literally the same handler — but the
                    // label primes the user that we know something went wrong.
                    !imageGen.running && imageGen.failed > 0 && hasActiveProject
                      ? {
                          icon: <RotateCcw size={14} />,
                          label: `Retry ${imageGen.failed} failed ${
                            imageGen.failed === 1 ? "image" : "images"
                          }`,
                          onClick: handleGenerateAllImages,
                        }
                      : null,
                    hasActiveProject
                      ? "divider"
                      : null,
                    hasActiveProject
                      ? {
                          icon: <FileText size={14} />,
                          label: "Download as PDF",
                          onClick: () => {
                            // Open the print-ready /app/share view in a new tab and
                            // auto-trigger the browser print dialog so the user
                            // can save as PDF (Cmd/Ctrl+P also works there).
                            const win = window.open("/app/share", "_blank");
                            if (!win) return;
                            win.addEventListener("load", () => {
                              // Small delay so fonts + TMDB posters settle.
                              setTimeout(() => win.print(), 800);
                            });
                          },
                        }
                      : null,
                    hasActiveProject && documents.some((d) => d.status === "done")
                      ? {
                          icon: <Download size={14} />,
                          label: "Download documents",
                          onClick: handleDownloadAll,
                        }
                      : null,
                    "divider",
                    {
                      icon: <Settings size={14} />,
                      label: "Settings",
                      onClick: () => setShowSettings(true),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 ${
          currentStep === 3
            ? "max-w-[1240px]"
            : currentStep === 1
              ? "max-w-[980px] sm:pt-10"
              : "max-w-[1000px]"
        }`}
      >
        {currentStep === 1 && (
          <StepInstructions
            onSubmitJson={(json) => {
              handleJsonSubmit(json);
            }}
          />
        )}
        {currentStep === 2 && (
          <div className="form-sheet p-6 sm:p-9">
            <StepGenerating
              apiProvider={apiProvider}
              apiKey={apiKey}
              textModel={confirmedTextModel}
              jsonData={jsonData}
              documents={documents}
              setDocuments={setDocuments}
              onComplete={handleGenerationComplete}
              onStop={() => handleGenerationComplete(documents)}
            />
          </div>
        )}
        {currentStep === 3 && (
          <StepResults
            documents={documents}
            deliverables={deliverables}
            jsonData={jsonData}
            onJsonDataChange={handleJsonDataChange}
            onStartOver={handleStartOver}
            onDocumentUpdate={handleDocumentUpdate}
            storyboardImages={storyboardImages}
            onStoryboardImagesChange={handleImagesChange}
            promptOverrides={promptOverrides}
            onPromptOverridesChange={handlePromptOverridesChange}
            posterImages={posterImages}
            onPosterImagesChange={handlePosterImagesChange}
            portraits={portraits}
            onPortraitsChange={handlePortraitsChange}
            propImages={propImages}
            onPropImagesChange={handlePropImagesChange}
            locationImages={locationImages}
            onLocationImagesChange={handleLocationImagesChange}
            disabledItems={disabledItems}
            onDisabledItemsChange={handleDisabledItemsChange}
          />
        )}
      </main>

      <DeliverablesDialog
        open={showDeliverables}
        selection={deliverables}
        onSelectionChange={setDeliverables}
        onCancel={() => {
          setShowDeliverables(false);
          setPendingJson(null);
        }}
        onConfirm={handleConfirmDeliverables}
      />

      <TextConfirmationDialog
        open={showTextConfirmation}
        provider={apiProvider}
        apiKey={apiKey}
        model={normalizeTextModel(apiProvider, textModel)}
        onProviderChange={handleTextProviderChange}
        onApiKeyChange={setApiKey}
        onModelChange={setTextModel}
        onCancel={() => {
          setShowTextConfirmation(false);
          setShowDeliverables(true);
        }}
        onConfirm={handleConfirmTextGeneration}
      />

      <ImageConfirmationDialog
        open={showImageConfirmation}
        falKey={falKey}
        deckModel={deckImageModel}
        posterModel={posterImageModel}
        deckCount={imageConfirmationCounts.deck}
        posterCount={imageConfirmationCounts.posters}
        onFalKeyChange={setFalKey}
        onDeckModelChange={setDeckImageModel}
        onPosterModelChange={setPosterImageModel}
        onCancel={() => {
          setShowImageConfirmation(false);
          pendingImageTasksRef.current = [];
        }}
        onConfirm={handleConfirmImageGeneration}
      />

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent
          className={cn(
            "max-h-[85vh] overflow-y-auto sm:max-w-2xl",
            settingsIsPaper &&
              "paper border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important]",
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={
                settingsIsPaper
                  ? "form-sec-head text-[22px] text-foreground"
                  : "tracking-normal"
              }
            >
              Settings
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose the active text provider, API keys, and image style settings.
            </DialogDescription>
          </DialogHeader>

          {/* API keys section */}
          <section className="space-y-5 pt-2">
            <div className={settingsSectionLabelClass}>
              API Keys
            </div>
            <TextProviderFields
              provider={apiProvider}
              apiKey={apiKey}
              model={normalizeTextModel(apiProvider, textModel)}
              onProviderChange={handleTextProviderChange}
              onApiKeyChange={setApiKey}
              onModelChange={setTextModel}
              surface={settingsIsPaper ? "paper" : "default"}
            />
            <div className="space-y-2">
              <label className="text-[13px] font-medium tracking-normal">
                fal.ai API key{" "}
                <span className="text-muted-foreground font-normal">· optional</span>
              </label>
              <p className="text-[12px] text-foreground/60 tracking-normal">
                Generates images. Leave blank for text only.{" "}
                <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Get a key
                </a>
              </p>
              <input
                type="password"
                placeholder="fal-..."
                value={falKey}
                onChange={(e) => setFalKey(e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium tracking-normal">
                TMDB API key{" "}
                <span className="text-muted-foreground font-normal">· optional</span>
              </label>
              <p className="text-[12px] text-foreground/60 tracking-normal">
                Adds poster thumbnails. Optional.{" "}
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  Get a key
                </a>
              </p>
              <input
                type="password"
                placeholder="TMDB API key (v3 auth)"
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <p className="text-[11px] text-foreground/50 tracking-normal">
              Keys stay in this browser and are only sent when you generate.
            </p>
          </section>

          {/* Image style prompts */}
          <section className="space-y-4 pt-6">
            <div className={settingsSectionLabelClass}>
              Image Styles
            </div>
            {hasImageGenerationKey ? (
              <>
                <p className="text-[12px] text-foreground/60 tracking-normal leading-[1.55]">
                  Choose the look for new generated images. Provider-specific model
                  tags are added by Scriptlook.
                </p>

                {(["storyboard", "portrait", "prop", "location", "poster"] as ImagePromptKind[]).map(
                  (kind) => {
                    const labels: Record<ImagePromptKind, { title: string; sub: string }> = {
                      storyboard: {
                        title: "Storyboard frames",
                        sub: "Scene-by-scene shot illustrations, 16:9.",
                      },
                      portrait: {
                        title: "Character portraits",
                        sub: "Head-and-shoulders cast references, square.",
                      },
                      prop: {
                        title: "Prop references",
                        sub: "Isolated art-department sketches, square.",
                      },
                      location: {
                        title: "Location references",
                        sub: "Priority scout plates, 16:9.",
                      },
                      poster: {
                        title: "Poster concepts",
                        sub: "Tall poster compositions from Posters, 5:7.",
                      },
                    };
                    const isModified =
                      imagePrompts[kind].trim() !== DEFAULT_IMAGE_PROMPTS[kind];
                    return (
                      <div key={kind} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <label className="text-[13px] font-medium tracking-normal">
                              {labels[kind].title}
                            </label>
                            <p className="text-[11px] text-foreground/55 tracking-normal mt-0.5">
                              {labels[kind].sub}
                            </p>
                          </div>
                          {isModified && (
                            <button
                              onClick={() => handleResetImagePrompt(kind)}
                              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
                              title="Restore the default style prefix"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <textarea
                          value={imagePrompts[kind]}
                          onChange={(e) => handleImagePromptChange(kind, e.target.value)}
                          rows={4}
                          className={settingsTextareaClass}
                          placeholder={DEFAULT_IMAGE_PROMPTS[kind]}
                        />
                      </div>
                    );
                  },
                )}

                <p className="text-[11px] text-foreground/50 tracking-normal">
                  Only new images use these settings. Existing images stay as they are.
                </p>
              </>
            ) : (
              <p className="border border-foreground/20 bg-foreground/[0.03] px-3 py-2.5 text-[12px] text-foreground/60 tracking-normal leading-[1.55]">
                Add a fal.ai key above to edit image style prompts.
              </p>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}
