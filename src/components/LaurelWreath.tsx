export function LaurelWreath({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="laurel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6530" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#laurel)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Left branch */}
        <path d="M48 8 C35 15, 22 28, 18 45" />
        <path d="M17 40 L14 46" />
        <path d="M19 48 L16 54" />
        <path d="M22 38 L19 44" />
        <path d="M24 46 L21 52" />
        <path d="M27 34 L24 40" />
        <path d="M29 42 L26 48" />
        <path d="M32 30 L29 36" />
        <path d="M34 38 L31 44" />
        <path d="M37 26 L34 32" />
        <path d="M39 34 L36 40" />

        {/* Right branch */}
        <path d="M52 8 C65 15, 78 28, 82 45" />
        <path d="M83 40 L86 46" />
        <path d="M81 48 L84 54" />
        <path d="M78 38 L81 44" />
        <path d="M76 46 L79 52" />
        <path d="M73 34 L76 40" />
        <path d="M71 42 L74 48" />
        <path d="M68 30 L71 36" />
        <path d="M66 38 L69 44" />
        <path d="M63 26 L66 32" />
        <path d="M61 34 L64 40" />

        {/* Tie at the bottom */}
        <path d="M46 92 C46 96, 50 98, 50 98 C50 98, 54 96, 54 92" />
        <path d="M50 98 L50 104" />
      </g>
    </svg>
  );
}
