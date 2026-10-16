import Link from "next/link";
import { Clapperboard, FileText, Send } from "lucide-react";
import { LandingMotion } from "@/components/landing/landing-motion";
import { getSiteUrl } from "@/lib/site-url";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Scriptlook",
    description:
      "An open-source workspace for turning scripts into film vision decks, references, storyboards, and posters.",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    url: getSiteUrl(),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Santiago Alonso",
      url: "https://santiagoalonso.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main
        id="scriptlook-landing"
        className="paper min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8"
      >
        <LandingMotion rootId="scriptlook-landing" />
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
          <header className="form-sheet paper-motion-reveal paper-motion-sheet overflow-hidden">
            <div className="grid grid-cols-1 items-start gap-6 border-b-2 border-foreground px-5 pb-6 pt-6 sm:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:pt-7">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Creative planning toolkit
                </p>
                <h1 className="mt-3 max-w-[820px] font-display text-[clamp(2.9rem,7vw,6.3rem)] font-semibold uppercase leading-[0.88] tracking-[0.02em] text-foreground">
                  Scriptlook
                </h1>
                <p className="mt-5 max-w-[720px] text-[15px] leading-[1.6] text-foreground sm:text-[17px]">
                  An open-source workspace for{" "}
                  <span className="mark-hl">filmmakers and creative teams</span>{" "}
                  turning scripts into decks, references, storyboards, and posters.
                </p>
              </div>
              <div className="form-stamp paper-motion-reveal paper-motion-stamp mt-1 justify-self-start sm:justify-self-end">
                Open source
              </div>
            </div>

            <div className="border-b-2 border-foreground">
              <FieldRow label="Pitch faster">
                Start with a screenplay. Scriptlook turns it into a deck you can inspect,
                edit, print, and share: tone, scenes, characters, production references,
                storyboards, and poster ideas.
              </FieldRow>
              <FieldRow label="Local by design">
                Run Scriptlook on your own computer. Provider keys are saved in your
                browser and are used only for generation requests you start.
              </FieldRow>

              <aside className="border-t-2 border-foreground">
                <div className="border-b border-foreground px-5 pb-3 pt-5 md:px-8">
                  <p className="form-sec-head text-[15px] text-foreground">Production docket</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <CapabilityItem
                    icon={<FileText size={18} strokeWidth={1.8} />}
                    number="01"
                    title="Script intelligence"
                    description="Upload or paste a screenplay. Scriptlook pulls logline, tone, scenes, characters, locations, and props."
                  />
                  <CapabilityItem
                    icon={<Clapperboard size={18} strokeWidth={1.8} />}
                    number="02"
                    title="Visual development"
                    description="Generate storyboards, posters, portraits, prop references, and location plates from the same project."
                  />
                  <CapabilityItem
                    icon={<Send size={18} strokeWidth={1.8} />}
                    number="03"
                    title="Shareable package"
                    description="Review, print, or send a paper-style deck with overview, mood, scenes, cast, design, identity, and posters."
                  />
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5 md:px-8">
              <Link
                href="/app"
                data-ui-audio="select"
                className="inline-flex min-h-11 items-center border-2 border-foreground bg-foreground px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-background transition-colors hover:bg-[var(--paper-highlight)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                Open Scriptlook
              </Link>
              <a
                href="https://www.scriptlook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-[0.12em] text-foreground underline underline-offset-4 hover:bg-[var(--paper-highlight)]"
              >
                View the hosted demo gallery
              </a>
            </div>
          </header>

          <footer className="flex flex-wrap justify-between gap-2 px-1 pb-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
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
          </footer>
        </div>
      </main>
    </>
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
    <div className="paper-motion-reveal paper-motion-row grid grid-cols-1 border-b border-foreground last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex items-center px-5 pt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:border-r sm:border-foreground sm:py-3 md:pl-8">
        {label}
      </div>
      <div className="px-5 pb-3 pt-1 text-[14px] leading-[1.6] text-foreground sm:py-3 sm:pl-5 md:pr-8">
        {children}
      </div>
    </div>
  );
}

function CapabilityItem({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="paper-motion-reveal paper-motion-row grid grid-cols-[64px_minmax(0,1fr)] border-b border-foreground last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex flex-col items-center gap-2 border-r border-foreground bg-white px-2 py-4 text-foreground">
        <span className="grid size-8 place-items-center border border-foreground bg-[var(--paper-sheet)]">
          {icon}
        </span>
        <span className="font-sans text-[10px] font-bold tabular-nums">{number}</span>
      </div>
      <div className="px-4 py-3.5">
        <p className="form-sec-head text-[14px] text-foreground">{title}</p>
        <p className="mt-2 text-[12px] leading-[1.5] text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
