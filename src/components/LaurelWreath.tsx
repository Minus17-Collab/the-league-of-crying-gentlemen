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
        {/* Bottom stems — start low on the sides and meet at the bottom */}
        <path d="M22 60 C16 68, 22 86, 48 94" />
        <path d="M78 60 C84 68, 78 86, 52 94" />

        {/* Left leaves (top to bottom) */}
        <path d="M23 64 L17 66" />
        <path d="M22 70 L16 72" />
        <path d="M22 76 L16 78" />
        <path d="M23 82 L17 84" />
        <path d="M25 88 L19 90" />
        <path d="M28 92 L22 94" />
        <path d="M32 94 L26 96" />
        <path d="M37 96 L31 98" />
        <path d="M42 96 L36 98" />
        <path d="M47 96 L41 98" />

        {/* Right leaves (top to bottom) */}
        <path d="M77 64 L83 66" />
        <path d="M78 70 L84 72" />
        <path d="M78 76 L84 78" />
        <path d="M77 82 L83 84" />
        <path d="M75 88 L81 90" />
        <path d="M72 92 L78 94" />
        <path d="M68 94 L74 96" />
        <path d="M63 96 L69 98" />
        <path d="M58 96 L64 98" />
        <path d="M53 96 L59 98" />

        {/* Center bow / tie */}
        <path d="M46 94 C46 97, 48 99, 50 99 C52 99, 54 97, 54 94" />
        <path d="M50 99 L50 104" />
      </g>
    </svg>
  );
}
