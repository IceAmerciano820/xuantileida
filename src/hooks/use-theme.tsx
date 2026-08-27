"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

type Theme = "dark" | "light";
type TransitionDirection = "to-light" | "to-dark" | null;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  transitionDirection: TransitionDirection;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  isDark: true,
  transitionDirection: null,
});

const THEME_KEY = "hotspot_theme";

function loadTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(null);
  const prevThemeRef = useRef<Theme>("dark");

  useEffect(() => {
    setTheme(loadTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.remove("light-theme");
    } else {
      root.classList.add("light-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      // Trigger transition animation
      prevThemeRef.current = prev;
      setTransitionDirection(next === "light" ? "to-light" : "to-dark");
      return next;
    });
  }, []);

  const clearTransition = useCallback(() => {
    setTransitionDirection(null);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark", transitionDirection }}>
      {children}
      {transitionDirection && (
        <ThemeTransition direction={transitionDirection} onComplete={clearTransition} />
      )}
    </ThemeContext.Provider>
  );
}

/* ── Theme transition animation ── */

function ThemeTransition({ direction, onComplete }: { direction: "to-light" | "to-dark"; onComplete: () => void }) {
  const isSun = direction === "to-light";

  return (
    <div
      className="theme-transition-overlay"
      onAnimationEnd={onComplete}
    >
      {/* Background flash */}
      <div
        className="theme-transition-bg"
        style={{
          background: isSun
            ? "radial-gradient(circle at 50% 100%, rgba(255,215,0,0.15) 0%, transparent 60%)"
            : "radial-gradient(circle at 50% 100%, rgba(176,196,222,0.1) 0%, transparent 60%)",
        }}
      />
      {/* Celestial body */}
      <div
        className="theme-transition-body"
        style={{
          background: isSun
            ? "radial-gradient(circle at 40% 40%, #FFD700, #FFA500)"
            : "radial-gradient(circle at 40% 40%, #E8E8E8, #B0C4DE)",
          boxShadow: isSun
            ? "0 0 60px 20px rgba(255,215,0,0.3), 0 0 120px 60px rgba(255,165,0,0.15)"
            : "0 0 60px 20px rgba(200,210,230,0.25), 0 0 120px 60px rgba(176,196,222,0.1)",
        }}
      />
      {/* Moon crescent shadow (only for moon) */}
      {!isSun && (
        <div
          className="theme-transition-body"
          style={{
            background: "radial-gradient(circle at 60% 35%, rgba(30,30,60,0.7) 0%, transparent 50%)",
            boxShadow: "none",
          }}
        />
      )}
    </div>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
