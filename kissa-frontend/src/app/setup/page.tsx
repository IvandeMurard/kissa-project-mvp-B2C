"use client";

import Link from "next/link";
import { DiscogsImporter } from "@/components/DiscogsImporter";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SetupPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="lightbox-sign inline-block rounded-xl px-4 py-2 text-sm mb-8">
          SETUP
        </h1>

        <section className="space-y-4">
          <h2 className="amp-label text-white">IMPORT EXTERNAL DATA</h2>
          <DiscogsImporter API_URL={API_URL} />
        </section>

        <div className="mt-8">
          <Link
            href="/"
            className="text-neutral-500 hover:text-white text-sm amp-label"
          >
            ← Back to Library
          </Link>
        </div>
      </div>
    </main>
  );
}
