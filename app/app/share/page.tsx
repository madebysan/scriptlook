"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShareableView } from "@/components/share/shareable-view";
import { loadProject, type SavedProject } from "@/lib/reports";

const SHARE_PAGE_CLASS = "paper min-h-screen bg-background text-foreground";

export default function AppSharePage() {
  const [project, setProject] = useState<SavedProject | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setProject(loadProject());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (!hydrated) {
    return (
      <main className={`${SHARE_PAGE_CLASS} flex items-center justify-center text-sm text-muted-foreground`}>
        Loading deck...
      </main>
    );
  }

  if (!project) {
    return (
      <main className={`${SHARE_PAGE_CLASS} flex flex-col items-center justify-center gap-3 px-6 text-center`}>
        <p className="text-sm text-muted-foreground">
          No active project yet. Start one from Scriptlook first.
        </p>
        <Link href="/app" className="text-sm text-foreground underline underline-offset-4">
          Go to Scriptlook
        </Link>
      </main>
    );
  }

  return (
    <main className={SHARE_PAGE_CLASS}>
      <ShareableView project={project} />
    </main>
  );
}
