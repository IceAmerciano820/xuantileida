"use client";

import { useState, useEffect, useCallback } from "react";

interface RadarLandingPageProps {
  onEnter: () => void;
}

/* Pulsing dot positions on rings (angle in degrees, ring index 0-3) */
const RADAR_DOTS = [
  { angle: 45, ring: 1, delay: 0.3 },
  { angle: 120, ring: 2, delay: 1.2 },
  { angle: 200, ring: 0, delay: 0.8 },
  { angle: 280, ring: 3, delay: 1.8 },
  { angle: 340, ring: 1, delay: 0.5 },
  { angle: 75, ring: 2, delay: 2.1 },
  { angle: 160, ring: 3, delay: 1.5 },
  { angle: 250, ring: 0, delay: 0.1 },
];

export function RadarLandingPage({ onEnter }: RadarLandingPageProps) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onEnter();
    }, 500);
  }, [onEnter]);

  /* Keyboard accessibility: Enter/Space to enter */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEnter]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0B0F1A] transition-all duration-500 ${
        exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
      }`}
      onClick={handleEnter}
      role="button"
      tabIndex={0}
      aria-label="进入选题雷达"
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C6ED]/[0.03] blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C6ED]/[0.05] blur-[60px]" />
      </div>

      {/* Radar container */}
      <div className="relative flex flex-col items-center">
        {/* Radar animation */}
        <div className="relative h-[280px] w-[280px] sm:h-[360px] sm:w-[360px]">
          {/* Concentric rings */}
          {[0, 1, 2, 3].map((i) => {
            const size = 100 + i * 60;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  marginLeft: `${-size / 2}px`,
                  marginTop: `${-size / 2}px`,
                  borderColor: `rgba(0, 198, 237, ${0.08 + i * 0.03})`,
                }}
              />
            );
          })}

          {/* Cross lines */}
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[rgba(0,198,237,0.06)]" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[rgba(0,198,237,0.06)]" />

          {/* Scanning beam */}
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] sm:h-[230px] sm:w-[230px]"
            style={{
              transformOrigin: "0 0",
              animation: "radar-sweep-landing 3s linear infinite",
            }}
          >
            <div
              className="absolute left-0 top-0 h-full w-full"
              style={{
                background: "conic-gradient(from 0deg, transparent 0deg, rgba(0, 198, 237, 0.12) 30deg, transparent 60deg)",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>

          {/* Pulsing dots on rings */}
          {RADAR_DOTS.map((dot, i) => {
            const ringRadius = 50 + dot.ring * 30;
            const rad = (dot.angle * Math.PI) / 180;
            const x = Math.cos(rad) * ringRadius;
            const y = Math.sin(rad) * ringRadius;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#00C6ED]"
                style={{
                  transform: `translate(${x - 4}px, ${y - 4}px)`,
                  animation: `radar-dot-pulse 2s ease-in-out ${dot.delay}s infinite`,
                  boxShadow: "0 0 6px rgba(0, 198, 237, 0.6)",
                }}
              />
            );
          })}

          {/* Center glow */}
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C6ED]" style={{ boxShadow: "0 0 12px rgba(0, 198, 237, 0.5), 0 0 24px rgba(0, 198, 237, 0.2)" }} />
          <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C6ED]/20" style={{ animation: "radar-center-pulse 2s ease-in-out infinite" }} />
        </div>

        {/* Brand name */}
        <h1
          className="mt-8 bg-clip-text text-center text-3xl font-bold tracking-tight text-transparent sm:mt-10 sm:text-4xl"
          style={{
            backgroundImage: "linear-gradient(135deg, #00C6ED 0%, #7DD3FC 50%, #00C6ED 100%)",
            textShadow: "0 0 40px rgba(0, 198, 237, 0.3)",
          }}
        >
          选题雷达
        </h1>

        {/* Slogan */}
        <p className="mt-3 text-sm tracking-widest text-[#64748B] sm:text-base">
          全网热点，一键捕捉
        </p>

        {/* Enter button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleEnter(); }}
          className="mt-8 group flex items-center gap-2 rounded-xl border border-[#00C6ED]/20 bg-[#00C6ED]/5 px-6 py-3 text-sm font-medium text-[#00C6ED] transition-all duration-300 hover:border-[#00C6ED]/40 hover:bg-[#00C6ED]/10 hover:shadow-[0_0_24px_rgba(0,198,237,0.15)] sm:mt-10 sm:px-8 sm:py-3.5"
        >
          开始扫描
          <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      {/* Bottom hint */}
      <p className="absolute bottom-8 text-xs text-[#334155]">
        点击任意位置进入
      </p>
    </div>
  );
}
