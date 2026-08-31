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
      <g fill="none" stroke="url(#laurel)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Bottom stems */}
        <path d="M28 32 C18 42, 20 72, 48 90" />
        <path d="M72 32 C82 42, 80 72, 52 90" />

        {/* Left leaves (top to bottom) */}
        <path d="M30 36 L24 40" />
        <path d="M28 42 L22 46" />
        <path d="M26 48 L20 52" />
        <path d="M25 54 L19 58" />
        <path d="M24 60 L18 64" />
        <path d="M24 66 L18 70" />
        <path d="M25 72 L19 76" />
        <path d="M27 78 L21 82" />
        <path d="M30 84 L24 88" />
        <path d="M34 88 L28 92" />
        <path d="M39 92 L33 96" />
        <path d="M44 94 L38 98" />

        {/* Right leaves (top to bottom) */}
        <path d="M70 36 L76 40" />
        <path d="M72 42 L78 46" />
        <path d="M74 48 L80 52" />
        <path d="M75 54 L81 58" />
        <path d="M76 60 L82 64" />
        <path d="M76 66 L82 70" />
        <path d="M75 72 L81 76" />
        <path d="M73 78 L79 82" />
        <path d="M70 84 L76 88" />
        <path d="M66 88 L72 92" />
        <path d="M61 92 L67 96" />
        <path d="M56 94 L62 98" />

        {/* Center bow / tie */}
        <path d="M45 92 C45 96, 48 98, 50 98 C52 98, 55 96, 55 92" />
        <path d="M50 98 L50 104" />
      </g>
    </svg>
  );
}
