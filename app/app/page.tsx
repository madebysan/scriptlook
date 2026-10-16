import { WizardShell } from "@/components/wizard/wizard-shell";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "App",
  description: "Turn a screenplay into a film deck.",
  alternates: { canonical: "/app" },
  openGraph: {
    title: "Scriptlook App",
    description: "Turn a screenplay into a film deck.",
    url: "/app",
  },
};

export default function AppPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Scriptlook",
    description: "Turn a screenplay into a film deck.",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    url: `${getSiteUrl()}/app`,
    offers: {
      "@type": "Offer",
      name: "Open-source BYOK",
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
      <WizardShell />
    </>
  );
}
