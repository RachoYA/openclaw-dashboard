import { useRef, useEffect, useCallback } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label?: string;
}

/**
 * Mobile bottom sheet with drag-to-close handle.
 * Only the handle zone captures drag events (avoids fighting scrollable content).
 * Swipe down > 100px → closes. Release < 100px → snaps back.
 */
export function BottomSheet({ open, onClose, children, label }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startY: 0, delta: 0 });

  // Reset inline transform when sheet becomes visible so CSS transition takes over
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    if (open) {
      el.style.transform = "";
      el.style.transition = "";
    }
  }, [open]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    dragState.current = { active: true, startY: e.touches[0].clientY, delta: 0 };
    const el = sheetRef.current;
    if (el) el.style.transition = "none";
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragState.current.active) return;
    const delta = e.touches[0].clientY - dragState.current.startY;
    if (delta <= 0) return; // only downward drag
    dragState.current.delta = delta;
    const el = sheetRef.current;
    if (el) el.style.transform = `translateY(${delta}px)`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    if (dragState.current.delta > 100) {
      // Animate out then close
      el.style.transform = "translateY(100%)";
      setTimeout(() => {
        el.style.transform = "";
        onClose();
      }, 300);
    } else {
      el.style.transform = "translateY(0)";
    }
    dragState.current.delta = 0;
  }, [onClose]);

  // Attach listeners to handle only
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.addEventListener("touchstart", handleTouchStart, { passive: true });
    handle.addEventListener("touchmove", handleTouchMove, { passive: true });
    handle.addEventListener("touchend", handleTouchEnd);
    return () => {
      handle.removeEventListener("touchstart", handleTouchStart);
      handle.removeEventListener("touchmove", handleTouchMove);
      handle.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 29,
          background: open ? "var(--backdrop)" : "transparent",
          pointerEvents: open ? "auto" : "none",
          transition: "background 0.3s ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          background: "var(--panel-bg)",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 -4px 24px var(--shadow)",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          willChange: "transform",
        }}
      >
        {/* Drag handle — touch events captured here only */}
        <div
          ref={handleRef}
          style={{
            padding: "12px 0 8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            touchAction: "none", // prevent scroll on handle
            cursor: "grab",
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 36, height: 4,
            borderRadius: 2,
            background: "var(--drag-handle)",
          }} />
          {label && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, paddingTop: 2 }}>{label}</span>
          )}
        </div>

        {/* Scrollable content */}
        <div
          className="hide-scrollbar"
          style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </>
  );
}
