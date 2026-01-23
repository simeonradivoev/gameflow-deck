import React, { useEffect, useState } from "react";
import { Bell, Library, Store, Settings, Gamepad2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

const games = [
  "Halo Infinite",
  "Cyberpunk",
  "Hades",
  "Stardew Valley",
  "Neon Skies",
  "Void Runner",
  "Rogue Light",
  "Drift City",
];

export const Route = createFileRoute("/GameDetails")({
  loader: ({ params }) => params.postId,
  component: GameDetailsUI,
});

export function GameDetailsUI() {
  // In a component!
  const { postId } = Route.useParams();

  return (
    <main className="flex-1 p-10 flex flex-col gap-10">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-400">Now Playing</div>
          <h1 className="text-3xl font-semibold text-cyan-400">
            Halo Infinite
          </h1>
          <div className="mt-2 text-slate-400 text-sm">
            Action · FPS · Sci-Fi
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <Bell className="w-5 h-5" />
          <span className="text-sm">3</span>
        </div>
      </header>

      {/* Content split */}
      <section className="flex gap-10 flex-1">
        {/* Cover / media */}
        <div className="w-[360px] shrink-0">
          <div className="relative h-[480px] rounded-3xl bg-gradient-to-br from-slate-700/60 to-slate-900/90 ring-4 ring-cyan-400/80 shadow-[0_0_50px_rgba(34,211,238,0.6)]" />

          {/* Primary action */}
          <button className="mt-6 w-full rounded-xl bg-cyan-400 text-black font-semibold py-3 text-lg shadow-[0_0_30px_rgba(34,211,238,0.6)]">
            ▶ Play
          </button>
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Description */}
          <p className="text-slate-300 leading-relaxed max-w-3xl">
            Experience the epic sci-fi saga and master chief’s greatest journey
            yet. Explore vast open worlds, engage in tactical combat, and
            uncover the mysteries of Zeta Halo.
          </p>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-6 max-w-3xl">
            <Detail label="Developer" value="343 Industries" />
            <Detail label="Publisher" value="Xbox Game Studios" />
            <Detail label="Release" value="Dec 8, 2021" />
            <Detail label="Playtime" value="42 hours" />
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-4">
            <SecondaryButton label="Achievements" />
            <SecondaryButton label="DLC" />
            <SecondaryButton label="Settings" />
          </div>
        </div>
      </section>

      {/* Footer hints */}
      <footer className="text-sm text-slate-400 flex gap-6">
        <span>A Play</span>
        <span>B Back</span>
        <span>Y Options</span>
      </footer>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-slate-200 text-sm mt-1">{value}</div>
    </div>
  );
}

function SecondaryButton({ label }: { label: string }) {
  return (
    <button className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200">
      {label}
    </button>
  );
}
