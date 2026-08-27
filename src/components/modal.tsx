"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { useTheme } from "@/hooks/use-theme";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />

      {/* Modal content */}
      <div className={`relative w-full ${maxWidth} overflow-hidden rounded-2xl border shadow-2xl ${
        isDark
          ? "border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]"
          : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
          isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"
        }`}>
          <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
