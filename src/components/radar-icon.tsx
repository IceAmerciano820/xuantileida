"use client";

interface RadarIconProps {
  className?: string;
  size?: number;
}

/**
 * Radar icon: concentric circles + crosshair + scan line
 */
export function RadarIcon({ className = "", size = 24 }: RadarIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 32 32"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {/* Outer circle */}
      <circle cx="16" cy="16" r="14" />
      {/* Middle circle */}
      <circle cx="16" cy="16" r="9.5" />
      {/* Inner circle */}
      <circle cx="16" cy="16" r="5" />
      {/* Crosshair lines */}
      <line x1="16" y1="2" x2="16" y2="30" strokeLinecap="round" />
      <line x1="2" y1="16" x2="30" y2="16" strokeLinecap="round" />
      {/* Scan sector (swept area) */}
      <path d="M 16 16 L 27.07 4.93 A 15.5 15.5 0 0 1 31 16 Z" fill="currentColor" fillOpacity="0.15" stroke="none" />
      {/* Scan line */}
      <line x1="16" y1="16" x2="27" y2="5" strokeLinecap="round" strokeOpacity="0.6" />
      {/* Center dot */}
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Radar scan loading animation: rotating scan sector inside a circle
 */
export function RadarScanAnimation({ className = "", size = 20 }: RadarIconProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className="absolute inset-0"
      >
        {/* Outer ring */}
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
        {/* Inner ring */}
        <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1" strokeOpacity="0.15" />
        {/* Center dot */}
        <circle cx="16" cy="16" r="1.5" fill="currentColor" fillOpacity="0.5" />
      </svg>
      {/* Rotating scan sector */}
      <div
        className="absolute inset-0 origin-center"
        style={{
          animation: "radar-sweep 1.5s linear infinite",
        }}
      >
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="absolute inset-0">
          <defs>
            <linearGradient id="radar-grad" x1="16" y1="16" x2="30" y2="2" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 16 16 L 30 2 A 19.8 19.8 0 0 1 35.8 16 Z" fill="url(#radar-grad)" stroke="none" transform={`scale(${size / 32})`} />
          <line x1="16" y1="16" x2="30" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Radar pulse dots: small dot with expanding ring animation
 */
export function RadarPulseDot({ className = "", color = "#00D4FF" }: { className?: string; color?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color, animation: "radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/**
 * Large decorative radar background: concentric circles + crosshair
 */
export function RadarBackground({ isDark }: { isDark: boolean }) {
  const strokeColor = isDark ? "#00D4FF" : "#6B7280";
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-0 overflow-hidden no-print" style={{ width: 480, height: 480, opacity: isDark ? 0.06 : 0.04 }}>
      <svg width="480" height="480" viewBox="0 0 480 480" fill="none" className="absolute inset-0">
        {/* Concentric circles */}
        <circle cx="240" cy="240" r="220" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="240" cy="240" r="160" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="240" cy="240" r="100" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="240" cy="240" r="40" stroke={strokeColor} strokeWidth="1.5" />
        {/* Crosshair lines */}
        <line x1="240" y1="20" x2="240" y2="460" stroke={strokeColor} strokeWidth="1" />
        <line x1="20" y1="240" x2="460" y2="240" stroke={strokeColor} strokeWidth="1" />
        {/* Diagonal lines */}
        <line x1="85" y1="85" x2="395" y2="395" stroke={strokeColor} strokeWidth="0.5" strokeOpacity="0.5" />
        <line x1="395" y1="85" x2="85" y2="395" stroke={strokeColor} strokeWidth="0.5" strokeOpacity="0.5" />
        {/* Center dot */}
        <circle cx="240" cy="240" r="4" fill={strokeColor} />
      </svg>
    </div>
  );
}
