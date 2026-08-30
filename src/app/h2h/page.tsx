import type { Metadata } from "next";
import { getHeadToHead } from "@/lib/data/league";
import { HeadToHeadMatrix } from "@/components/HeadToHeadMatrix";

export const metadata: Metadata = {
  title: "Head-to-Head",
  description: "Franchise win/loss records against every other franchise.",
};

const DISCLAIMER =
  "Regular season matchups across all seasons, excluding the 2023 founding " +
  "season because its rules and league size were materially different. By " +
  "default only active managers are shown; retired managers can be revealed " +
  "with the toggle. A franchise that inherits an old ESPN slot is tracked " +
  "separately from its predecessor.";

export default async function HeadToHeadPage() {
  const rows = await getHeadToHead();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Head-to-Head</h1>
        <p className="text-sm text-ivory/75">No regular season matchups recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Head-to-Head</h1>
      </div>

      <HeadToHeadMatrix rows={rows} disclaimer={DISCLAIMER} />
    </div>
  );
}
