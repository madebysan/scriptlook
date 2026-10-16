"use client";

import { useState, useRef, useEffect } from "react";
import { STAGE_0_PROMPT } from "@/lib/prompts/stage-0";
import { validateScreenplayJson } from "@/lib/schema";
import { Check, Copy, ChevronDown, Loader2, Upload } from "lucide-react";
import { useApiKeys } from "@/lib/api-keys-context";
import { extractPdfText } from "@/lib/pdf-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StepInstructionsProps = {
  onSubmitJson?: (json: string) => void;
};

// The app intake screen is styled as a physical production form: a paper sheet
// with ruled field rows, a stamped header, and an inline drop zone. The paper
// tokens come from the `.paper` scope applied by WizardShell on step 1.
export function StepInstructions({ onSubmitJson }: StepInstructionsProps) {
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);

  return (
    <div className="form-sheet">
      {/* Form header — stamped masthead */}
      <div className="grid grid-cols-1 items-start gap-6 border-b-2 border-foreground px-6 pb-6 pt-7 sm:grid-cols-[minmax(0,1fr)_auto] md:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Form 01-A · Screenplay → Film vision deck
          </p>
          <h2 className="mt-3 font-display text-[clamp(2.6rem,5.4vw,4.2rem)] font-semibold uppercase leading-[0.95] tracking-[0.02em] text-foreground">
            Generate your{" "}
            <br />
            vision deck.
          </h2>
        </div>
        <div className="form-stamp mt-1 justify-self-start sm:justify-self-end">
          In beta
        </div>
      </div>

      {/* Field rows */}
      <FieldRow label="Production">
        Paste a screenplay, get the deck a{" "}
        <span className="mark-hl">director, producer, or DP</span> can react to.
      </FieldRow>
      <FieldRow label="Deliverables">
        Logline · Mood &amp; tone · Scene map · Characters · Locations · Production
        design · Title treatment · Poster concepts
      </FieldRow>
      <FieldRow label="How it runs">
        <span className="font-bold">Free and open source.</span> Your provider keys stay
        in this browser and are used only for the generation requests you start.
      </FieldRow>

      {/* Inline drop zone */}
      <div className="px-6 py-7 md:px-8">
        <UploadMode onSubmitJson={onSubmitJson} />
        <p className="hidden">
          Already broke it down?{" "}
          <button
            type="button"
            onClick={() => setIsPasteDialogOpen(true)}
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Paste structured JSON
          </button>
        </p>

        <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
          {/* Dialogs portal to <body>, outside the page's `.paper` scope, so
              the class must be re-applied on the content node itself. */}
          <DialogContent className="paper max-h-[min(85vh,720px)] overflow-y-auto border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important] sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="form-sec-head text-[18px] tracking-[0.1em]">
                Paste structured JSON
              </DialogTitle>
              <DialogDescription>
                Run the extraction prompt yourself, then paste the result here.
              </DialogDescription>
            </DialogHeader>
            <ManualMode
              onSubmitJson={(json) => {
                setIsPasteDialogOpen(false);
                onSubmitJson?.(json);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Form footer */}
      <div className="flex flex-wrap justify-between gap-2 border-t-2 border-foreground px-6 py-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:px-8">
        <span>
          <a
            href="https://github.com/madebysan/scriptlook"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Source
          </a>{" "}
          · MIT · No warranty
        </span>
        <span>
          Made by{" "}
          <a
            href="https://santiagoalonso.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            santiagoalonso.com
          </a>
        </span>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 border-b border-foreground sm:grid-cols-[210px_minmax(0,1fr)]">
      <div className="flex items-center px-6 pt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:border-r sm:border-foreground sm:py-3 md:pl-8">
        {label}
      </div>
      <div className="px-6 pb-3 pt-1 text-[14px] leading-[1.6] text-foreground sm:py-3 sm:pl-5">
        {children}
      </div>
    </div>
  );
}

// ---- Upload Mode ----

// Rotating reassurance copy while the (opaque) extraction call runs, so a long
// wait reads as active work rather than a stuck spinner. Paired with a live
// elapsed clock.
const EXTRACTION_PHASES = [
  "Reading the screenplay…",
  "Finding scenes and slug lines…",
  "Mapping characters and locations…",
  "Tallying props, wardrobe, and page counts…",
  "Assembling the structured breakdown…",
];

function countScreenplaySlugLines(text: string): number {
  return text.match(/^\s*(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim)?.length ?? 0;
}

export function UploadMode({ onSubmitJson }: { onSubmitJson?: (json: string) => void }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ensureKeys } = useApiKeys();

  // Tick a one-second clock only while extraction is in flight.
  useEffect(() => {
    if (status !== "extracting") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(pdf|txt|fdx)$/i)) {
      setError("Please upload a PDF, TXT, or FDX file.");
      setStatus("error");
      return;
    }

    setFileName(file.name);
    setError("");
    setWarning("");

    // Prompt for the selected provider key before sending screenplay text.
    // OpenAI uses the low-cost extraction lane; Claude remains supported.
    const keys = await ensureKeys({ alwaysConfirm: true });
    if (!keys) {
      setStatus("idle");
      setFileName("");
      return;
    }
    if (keys.apiProvider !== "anthropic" && keys.apiProvider !== "openai") {
      setError("PDF extraction currently supports OpenAI or Claude. Select one and try again.");
      setStatus("error");
      return;
    }

    setElapsed(0);
    setStatus("extracting");

    try {
      // Pull plain text out of the file in the browser — a PDF goes through
      // PDF.js, plain .txt/.fdx is read directly — then send just the text to
      // the extraction model. Keeps PDF parsing off the serverless function.
      const isPdf = /\.pdf$/i.test(file.name);
      const text = isPdf ? await extractPdfText(file) : await file.text();
      if (!text.trim()) {
        throw new Error(
          "Couldn't read any text from that file. A scanned PDF (images only) has no selectable text — try a text-based script.",
        );
      }
      if (countScreenplaySlugLines(text) === 0) {
        setWarning(
          "No INT. or EXT. scene headings were found. Scriptlook will still continue, but transcript-style files produce a more interpretive deck.",
        );
      }

      const res = await fetch("/api/extract-screenplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          apiKey: keys.apiKey,
          apiProvider: keys.apiProvider,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Extraction failed (${res.status})`);
      }

      const { json } = await res.json();

      // Validate
      const result = validateScreenplayJson(json);
      if (!result.valid) {
        throw new Error(`Extraction produced invalid data: ${result.errors[0]}`);
      }

      setStatus("done");
      onSubmitJson?.(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStatus("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (status === "extracting") {
    const clock = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;
    const phase = EXTRACTION_PHASES[Math.floor(elapsed / 5) % EXTRACTION_PHASES.length];
    return (
      <div className="form-dropzone px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={24} className="animate-spin text-foreground/60" />
          <div>
            <p className="text-[14px] font-bold text-foreground">
              Reading {fileName}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{phase}</p>
            {warning && (
              <p className="mx-auto mt-3 max-w-md border border-foreground/20 bg-[var(--paper-highlight)]/35 px-3 py-2 text-[11.5px] leading-[1.5] text-foreground/75">
                {warning}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            <span className="text-foreground/70">{clock}</span>
            <span className="text-muted-foreground/60">·</span>
            <span>feature scripts can take 1–3 min</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`form-dropzone w-full px-6 py-9 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
          dragOver ? "bg-[rgba(255,227,77,0.35)]" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Upload size={26} className="text-foreground" />
          <div>
            <p className="form-sec-head text-[19px] text-foreground">
              ⟶ Drop screenplay here
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              PDF · FDX · TXT — extracted with your OpenAI or Claude key.
            </p>
          </div>
        </div>
      </button>
      <input
        ref={fileInputRef}
        id="screenplay-upload"
        name="screenplay-upload"
        type="file"
        accept=".pdf,.txt,.fdx"
        onChange={handleFileInput}
        className="hidden"
      />

      {status === "error" && error && (
        <div className="border border-destructive/60 bg-destructive/5 p-3">
          <p className="text-[12px] text-destructive">{error}</p>
        </div>
      )}
      {status === "error" && warning && (
        <div className="border border-foreground/20 bg-[var(--paper-highlight)]/25 p-3">
          <p className="text-[12px] leading-[1.5] text-foreground/70">{warning}</p>
        </div>
      )}
    </div>
  );
}

// ---- Manual Mode ----

function ManualMode({ onSubmitJson }: { onSubmitJson?: (json: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const hasContent = jsonInput.trim().length > 0;

  const handleGenerate = () => {
    const trimmed = jsonInput.trim();
    if (!trimmed) {
      setErrors(["Please paste your JSON data"]);
      return;
    }
    const result = validateScreenplayJson(trimmed);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSubmitJson?.(trimmed);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(STAGE_0_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Step 1 */}
      <div className="border border-border bg-card/40 px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-foreground font-mono text-[12px] font-medium text-background">
            1
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1.5 text-[15px] font-bold tracking-normal">
              Get the extraction from Gemini
            </h3>
            <p className="mb-3 text-[13px] leading-[1.6] text-muted-foreground">
              Open{" "}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
              >
                Gemini
              </a>
              , choose the{" "}
              <span className="text-foreground">Pro</span>{" "}
              model, upload the screenplay, and paste this prompt.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handleCopy}
                className={`inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors sm:px-5 ${
                  copied
                    ? "border border-foreground bg-[var(--paper-highlight)] text-foreground"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy prompt"}
              </button>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPrompt ? "Hide prompt" : "Preview prompt"}
                <ChevronDown size={12} className={`transition-transform ${showPrompt ? "rotate-180" : ""}`} />
              </button>
            </div>
            {showPrompt && (
              <div className="relative mt-3">
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap border border-border bg-background/60 p-4 font-mono text-[11px] leading-[1.7] text-foreground/70">
                  {STAGE_0_PROMPT}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="border border-border bg-card/40 px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-foreground font-mono text-[12px] font-medium text-background">
            2
          </span>
          <div>
            <h3 className="mb-1.5 text-[15px] font-bold tracking-normal">
              Copy the JSON
            </h3>
            <p className="text-[13px] leading-[1.6] text-muted-foreground">
              Select Gemini&apos;s structured answer and copy it.
            </p>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="border border-border bg-card/40 px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-foreground font-mono text-[12px] font-medium text-background">
            3
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1.5 text-[15px] font-bold tracking-normal">
              Paste it here
            </h3>
            <p className="mb-3 text-[13px] leading-[1.6] text-muted-foreground">
              Scriptlook builds the deck from there.
            </p>

            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                if (errors.length > 0) setErrors([]);
              }}
              placeholder='Paste JSON here. It should start with { "title": ...'
              rows={4}
              className="w-full resize-none border border-border bg-background/60 px-4 py-3 font-mono text-[12px] leading-[1.7] text-foreground/85 placeholder:text-muted-foreground/40 focus:border-foreground focus:outline-none"
            />

            {errors.length > 0 && (
              <div className="mt-3 border border-destructive/60 bg-destructive/5 p-3">
                <ul className="space-y-1">
                  {errors.map((error, i) => (
                    <li key={i} className="text-[12px] text-destructive">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!hasContent}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Build deck &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
