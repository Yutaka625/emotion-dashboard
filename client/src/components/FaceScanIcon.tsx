/*
 * DESIGN: emoSense Facial Expression Analyzer
 * Animated face scan icon — scanning line sweeps across a stylized face outline
 */

interface FaceScanIconProps {
  size?: number;
  color?: string;
  scanColor?: string;
}

export default function FaceScanIcon({ size = 24, color = 'oklch(0.88 0.005 80)', scanColor = 'oklch(0.62 0.18 160)' }: FaceScanIconProps) {
  const id = `face-scan-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Face scan icon"
    >
      {/* Corner brackets — top-left */}
      <path d="M3 9 L3 3 L9 3" stroke={scanColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Corner brackets — top-right */}
      <path d="M23 3 L29 3 L29 9" stroke={scanColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Corner brackets — bottom-left */}
      <path d="M3 23 L3 29 L9 29" stroke={scanColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Corner brackets — bottom-right */}
      <path d="M23 29 L29 29 L29 23" stroke={scanColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Face outline — oval */}
      <ellipse cx="16" cy="15.5" rx="7" ry="8.5" stroke={color} strokeWidth="1.4" />

      {/* Eyes */}
      <circle cx="13" cy="13.5" r="1" fill={color} />
      <circle cx="19" cy="13.5" r="1" fill={color} />

      {/* Mouth — subtle smile arc */}
      <path d="M13 18.5 Q16 20.5 19 18.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Scan line — animated */}
      <line
        x1="6"
        y1="16"
        x2="26"
        y2="16"
        stroke={scanColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.85"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 -8; 0 8; 0 -8"
          dur="2.4s"
          repeatCount="indefinite"
          calcMode="ease-in-out"
        />
        <animate
          attributeName="opacity"
          values="0.9; 0.4; 0.9"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </line>

      {/* Scan glow */}
      <line
        x1="6"
        y1="16"
        x2="26"
        y2="16"
        stroke={scanColor}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.15"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 -8; 0 8; 0 -8"
          dur="2.4s"
          repeatCount="indefinite"
          calcMode="ease-in-out"
        />
      </line>
    </svg>
  );
}
