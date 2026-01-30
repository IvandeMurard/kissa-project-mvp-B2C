"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const CHUNK_SIZE = 5;

export interface DiscogsCollectionItem {
  discogs_id: number;
  artist: string;
  title: string;
  year?: string | null;
  thumb?: string | null;
  resource_url?: string | null;
}

interface DiscogsImportBatchResponse {
  processed: number;
  success: number;
  failed: number;
}

interface DiscogsImporterProps {
  API_URL: string;
}

type Phase = "input" | "review" | "processing" | "complete";

export function DiscogsImporter({ API_URL }: DiscogsImporterProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [username, setUsername] = useState("");
  const [collection, setCollection] = useState<DiscogsCollectionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [lastAlbum, setLastAlbum] = useState<DiscogsCollectionItem | null>(null);
  const [importSummary, setImportSummary] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const handleScan = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Enter a Discogs username.");
      return;
    }
    setError(null);
    setIsScanning(true);
    try {
      const res = await fetch(
        `${API_URL}/discogs/collection/${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data.detail ||
          (res.status === 401 && "Token Discogs invalide ou expiré.") ||
          (res.status === 404 && `User "${trimmed}" not found or empty collection.`) ||
          (res.status === 502 && "Discogs API unavailable.") ||
          `Error ${res.status}`;
        setError(msg);
        return;
      }
      const data: DiscogsCollectionItem[] = await res.json();
      setCollection(Array.isArray(data) ? data : []);
      setPhase("review");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to fetch Discogs collection."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartImport = async () => {
    if (collection.length === 0) return;
    setPhase("processing");
    setDone(0);
    setTotal(collection.length);
    setLastAlbum(null);
    setImportSummary(null);

    const chunks: DiscogsCollectionItem[][] = [];
    for (let i = 0; i < collection.length; i += CHUNK_SIZE) {
      chunks.push(collection.slice(i, i + CHUNK_SIZE));
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const chunk of chunks) {
      try {
        const res = await fetch(`${API_URL}/discogs/import-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albums: chunk }),
        });
        const data: DiscogsImportBatchResponse = await res.json();
        totalSuccess += data.success ?? 0;
        totalFailed += data.failed ?? 0;
        setDone((prev) => prev + chunk.length);
        setLastAlbum(chunk[chunk.length - 1] ?? null);
      } catch {
        totalFailed += chunk.length;
        setDone((prev) => prev + chunk.length);
        setLastAlbum(chunk[chunk.length - 1] ?? null);
      }
    }

    setImportSummary({ success: totalSuccess, failed: totalFailed });
    setPhase("complete");
  };

  const preview = collection.slice(0, 5);

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-6">
      {/* State A: Input */}
      {phase === "input" && (
        <>
          <h3 className="amp-label text-white mb-4">DISCOGS COLLECTION</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Discogs Username (e.g. liuyi0922)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="w-full bg-[#222] border border-neutral-700 rounded px-4 py-2 text-sm focus:border-white focus:outline-none placeholder:text-neutral-600 text-white"
              disabled={isScanning}
            />
            {error && (
              <p className="text-red-400 text-sm" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="bg-white text-black px-4 py-2 rounded text-sm font-bold uppercase hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              SCAN COLLECTION
            </button>
          </div>
        </>
      )}

      {/* State B: Review */}
      {phase === "review" && (
        <>
          <h3 className="amp-label text-white mb-4">REVIEW</h3>
          <p className="text-neutral-400 text-sm mb-4">
            Found {collection.length} records in this collection.
          </p>
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {preview.map((item) => (
              <div
                key={item.discogs_id}
                className="flex items-center gap-3 bg-[#222] rounded p-2 border border-white/5"
              >
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-800 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">
                    {item.title}
                  </p>
                  <p className="text-neutral-500 text-xs truncate">
                    {item.artist}
                    {item.year ? ` · ${item.year}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase("input");
                setCollection([]);
                setError(null);
              }}
              className="px-4 py-2 rounded text-sm text-neutral-400 hover:text-white border border-neutral-600 hover:border-neutral-500"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              className="bg-white text-black px-4 py-2 rounded text-sm font-bold uppercase hover:bg-neutral-200"
            >
              START IMPORT
            </button>
          </div>
        </>
      )}

      {/* State C: Processing */}
      {phase === "processing" && (
        <>
          <h3 className="amp-label text-white mb-4">IMPORTING</h3>
          <p className="text-neutral-400 text-sm mb-2">
            Importing: {done} / {total}
          </p>
          <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
          {lastAlbum && (
            <div className="flex items-center gap-3 bg-[#222] rounded p-3 border border-white/10">
              {lastAlbum.thumb ? (
                <img
                  src={lastAlbum.thumb}
                  alt=""
                  className="w-12 h-12 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-neutral-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">
                  {lastAlbum.title}
                </p>
                <p className="text-neutral-500 text-xs truncate">
                  {lastAlbum.artist}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* State D: Complete */}
      {phase === "complete" && (
        <>
          <h3 className="amp-label text-white mb-4">IMPORT COMPLETE</h3>
          <p className="lightbox-sign inline-block rounded-xl px-4 py-2 text-sm mb-4">
            Import Complete! 🎉
          </p>
          {importSummary && (
            <p className="text-neutral-400 text-sm mb-4">
              {importSummary.success} imported
              {importSummary.failed > 0
                ? `, ${importSummary.failed} failed`
                : ""}
              .
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-stretch">
            <Link
              href="/"
              className="px-4 py-2 rounded text-sm bg-white text-black font-bold uppercase hover:bg-neutral-200 text-center transition-colors"
            >
              GO TO COLLECTION
            </Link>
            <button
              type="button"
              onClick={() => {
                setPhase("input");
                setCollection([]);
                setDone(0);
                setTotal(0);
                setLastAlbum(null);
                setImportSummary(null);
              }}
              className="px-3 py-1.5 rounded text-xs text-neutral-400 hover:text-white border border-neutral-600 hover:border-neutral-500 transition-colors"
            >
              Import more
            </button>
          </div>
        </>
      )}
    </div>
  );
}
