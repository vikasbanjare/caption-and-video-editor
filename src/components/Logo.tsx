/**
 * The Pulse mark + wordmark, ported verbatim from the Pulse plugin
 * (vikasbanjare/video · CutPilot/index.html). Brand: "Pulse" by aifloh.
 */

export function PulseMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 112"
      width={size}
      height={Math.round(size * 1.12)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="pulse-mark-g"
          x1="14"
          y1="104"
          x2="88"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8FB0FF" />
          <stop offset="1" stopColor="#2C57E6" />
        </linearGradient>
      </defs>
      <circle cx="37" cy="14.5" r="10.5" fill="url(#pulse-mark-g)" />
      <path
        d="M27 43a10 10 0 0 1 10-10h12a27 27 0 0 1 0 54h-4v15a9 9 0 0 1 -18 0Z"
        fill="url(#pulse-mark-g)"
      />
      <line
        x1="33.5"
        y1="64"
        x2="64"
        y2="45.5"
        stroke="#fff"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5 leading-none">
      <span className="text-[15px] font-semibold tracking-tight text-ink">Pulse</span>
      <span className="font-mono text-[10px] text-muted">by aifloh</span>
    </span>
  );
}
