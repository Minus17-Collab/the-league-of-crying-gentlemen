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
          <stop offset="0%" stopColor="#e4c35a" />
          <stop offset="100%" stopColor="#9a6e2e" />
        </linearGradient>
        <path
          id="laurel-leaf"
          d="M0 0 C3 -4 6 -4 9 0 C6 4 3 4 0 0"
          fill="url(#laurel)"
          stroke="none"
        />
      </defs>

      {/* Left branch stem */}
      <path
        d="M55 96 C48 86, 38 70, 30 52 C24 38, 18 24, 16 16"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Right branch stem */}
      <path
        d="M45 96 C52 86, 62 70, 70 52 C76 38, 82 24, 84 16"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Cross at the bottom */}
      <path
        d="M42 98 C46 94, 54 94, 58 98 M44 100 C48 96, 52 96, 56 100"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Left leaves */}
      <use href="#laurel-leaf" x="14" y="18" transform="rotate(170, 14, 18) scale(1.1)" />
      <use href="#laurel-leaf" x="18" y="28" transform="rotate(155, 18, 28)" />
      <use href="#laurel-leaf" x="22" y="38" transform="rotate(145, 22, 38)" />
      <use href="#laurel-leaf" x="27" y="48" transform="rotate(135, 27, 48)" />
      <use href="#laurel-leaf" x="32" y="58" transform="rotate(125, 32, 58)" />
      <use href="#laurel-leaf" x="37" y="68" transform="rotate(115, 37, 68)" />
      <use href="#laurel-leaf" x="42" y="78" transform="rotate(105, 42, 78)" />
      <use href="#laurel-leaf" x="47" y="87" transform="rotate(100, 47, 87)" />

      {/* Right leaves */}
      <use href="#laurel-leaf" x="86" y="18" transform="rotate(10, 86, 18) scale(1.1)" />
      <use href="#laurel-leaf" x="82" y="28" transform="rotate(25, 82, 28)" />
      <use href="#laurel-leaf" x="78" y="38" transform="rotate(35, 78, 38)" />
      <use href="#laurel-leaf" x="73" y="48" transform="rotate(45, 73, 48)" />
      <use href="#laurel-leaf" x="68" y="58" transform="rotate(55, 68, 58)" />
      <use href="#laurel-leaf" x="63" y="68" transform="rotate(65, 63, 68)" />
      <use href="#laurel-leaf" x="58" y="78" transform="rotate(75, 58, 78)" />
      <use href="#laurel-leaf" x="53" y="87" transform="rotate(80, 53, 87)" />
    </svg>
  );
}
