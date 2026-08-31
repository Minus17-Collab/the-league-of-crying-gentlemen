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

      {/* Stems */}
      <path
        d="M50 96 C32 96, 14 78, 12 52 C10 30, 25 10, 48 8"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M50 96 C68 96, 86 78, 88 52 C90 30, 75 10, 52 8"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Cross at bottom */}
      <path
        d="M42 96 C46 92, 54 92, 58 96 M42 100 C46 96, 54 96, 58 100"
        fill="none"
        stroke="url(#laurel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Left leaves (bottom to top) */}
      <use href="#laurel-leaf" x="50" y="95" transform="rotate(90, 50, 95)" />
      <use href="#laurel-leaf" x="31" y="88" transform="rotate(120, 31, 88)" />
      <use href="#laurel-leaf" x="17" y="73" transform="rotate(150, 17, 73)" />
      <use href="#laurel-leaf" x="12" y="52" transform="rotate(180, 12, 52)" />
      <use href="#laurel-leaf" x="17" y="31" transform="rotate(-150, 17, 31)" />
      <use href="#laurel-leaf" x="31" y="16" transform="rotate(-120, 31, 16)" />
      <use href="#laurel-leaf" x="48" y="8" transform="rotate(-95, 48, 8)" />

      {/* Right leaves (bottom to top) */}
      <use href="#laurel-leaf" x="50" y="95" transform="rotate(90, 50, 95)" />
      <use href="#laurel-leaf" x="69" y="88" transform="rotate(60, 69, 88)" />
      <use href="#laurel-leaf" x="83" y="73" transform="rotate(30, 83, 73)" />
      <use href="#laurel-leaf" x="88" y="52" transform="rotate(0, 88, 52)" />
      <use href="#laurel-leaf" x="83" y="31" transform="rotate(-30, 83, 31)" />
      <use href="#laurel-leaf" x="69" y="16" transform="rotate(-60, 69, 16)" />
      <use href="#laurel-leaf" x="52" y="8" transform="rotate(-85, 52, 8)" />

      {/* Extra leaves to fill gaps */}
      <use href="#laurel-leaf" x="24" y="62" transform="rotate(135, 24, 62)" />
      <use href="#laurel-leaf" x="76" y="62" transform="rotate(45, 76, 62)" />
      <use href="#laurel-leaf" x="25" y="42" transform="rotate(-135, 25, 42)" />
      <use href="#laurel-leaf" x="75" y="42" transform="rotate(-45, 75, 42)" />
    </svg>
  );
}
