/**
 * HAL Express box truck, side view, drawn for the login page. It faces left, wheels
 * turn and the road moves (keyframes in app/globals.css); both stop for reduced motion.
 */
export function Truck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 250" role="img" aria-label="ລົດຂົນສົ່ງ HAL Express" className={className}>
      <defs>
        <linearGradient id="truck-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0222e" />
          <stop offset="1" stopColor="#c90510" />
        </linearGradient>
        <linearGradient id="truck-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b4250" />
          <stop offset="1" stopColor="#1a1d23" />
        </linearGradient>
      </defs>

      {/* Road */}
      <path d="M0 226h520" stroke="#d4d7dc" strokeWidth="3" />
      <path d="M0 238h520" stroke="#e5e7eb" strokeWidth="4" strokeDasharray="26 14" className="truck-road" />
      <ellipse cx="290" cy="222" rx="215" ry="7" fill="#1f2329" opacity="0.12" />

      <g className="truck-body">
        {/* Cargo box */}
        <rect x="190" y="30" width="315" height="150" rx="8" fill="url(#truck-box)" />
        <rect x="190" y="30" width="315" height="10" rx="5" fill="#ff4a55" opacity="0.5" />
        <g stroke="#fff" strokeOpacity="0.12" strokeWidth="2">
          <path d="M268 44v124M347 44v124M426 44v124" />
        </g>
        <text x="347" y="104" textAnchor="middle" fill="#fff" fontSize="38" fontWeight="800" letterSpacing="1.5" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
          HAL EXPRESS
        </text>
        <text x="347" y="134" textAnchor="middle" fill="#fff" fillOpacity="0.85" fontSize="17" style={{ fontFamily: "var(--font-lao), sans-serif" }}>
          ຮຸ່ງອາລຸນ ຂົນສົ່ງດ່ວນ
        </text>

        {/* Cab */}
        <path d="M60 186V128c0-12 4-22 12-31l26-30c6-7 13-10 22-10h58c6 0 10 4 10 10v119Z" fill="#e30613" />
        <path d="M112 50h66c6 0 10 4 10 10v6H104Z" fill="#b8050f" />
        <path d="M84 104l24-28c4-5 9-7 15-7h47v42H88c-5 0-7-4-4-7Z" fill="url(#truck-glass)" />
        <path d="M118 74h18l-24 34h-14Z" fill="#fff" opacity="0.12" />
        <rect x="150" y="118" width="16" height="4" rx="2" fill="#b8050f" />
        <path d="M188 70v116" stroke="#b8050f" strokeWidth="3" />

        {/* Front, lights, bumper, chassis */}
        <rect x="54" y="140" width="10" height="16" rx="3" fill="#ffd34d" />
        <rect x="50" y="170" width="140" height="18" rx="5" fill="#2b2f36" />
        <rect x="180" y="178" width="330" height="12" rx="3" fill="#2b2f36" />
        <rect x="236" y="186" width="70" height="16" rx="3" fill="#3a3f48" />

        <Wheel cx={112} />
        <Wheel cx={385} />
        <Wheel cx={450} />
      </g>
    </svg>
  );
}

function Wheel({ cx }: { cx: number }) {
  const cy = 196;
  return (
    <g>
      <circle cx={cx} cy={cy} r="27" fill="#1f2329" />
      <g className="truck-wheel" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r="14" fill="#c7cbd1" />
        <path d={`M${cx - 14} ${cy}h28M${cx} ${cy - 14}v28`} stroke="#8b919b" strokeWidth="3" />
      </g>
      <circle cx={cx} cy={cy} r="5" fill="#6b7280" />
    </g>
  );
}
