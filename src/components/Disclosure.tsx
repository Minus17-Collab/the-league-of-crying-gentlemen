/**
 * Keyboard-accessible "how this is calculated" affordance, built on
 * native <details>/<summary> rather than a hover-only tooltip (hover
 * doesn't work on mobile or for keyboard users -- see the site upgrade
 * plan's Phase 2.4/3.4). Server-renderable, no client JS needed.
 */
export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group text-sm text-ivory/80">
      <summary className="cursor-pointer list-none text-xs font-medium text-gold-400 underline decoration-dotted underline-offset-4 hover:text-amber [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="mt-2 border-l-2 border-gold-500/30 pl-3 text-xs text-ivory/70">
        {children}
      </div>
    </details>
  );
}
