import { useRef, useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  snapHeights?: string[]; // e.g. ["30%", "60%", "90%"]
  defaultSnap?: number; // index into snapHeights
  children: React.ReactNode;
  label?: string;
}

/**
 * Mobile bottom sheet with drag-to-close handle.
 * Handles touch drag to close (swipe down past threshold).
 */
export function BottomSheet({ open, onClose, children, label }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const currentDeltaY = useRef(0);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      currentDeltaY.current = 0;
      el.style.transition = "none";
    };

    const onTouchMove = (e: TouchEvent) => {
      const delta = e.touches[0].clientY - dragStartY.current;
      if (delta > 0) {
        currentDeltaY.current = delta;
        el.style.transform = `translateY(${delta}px)`;
      }
    };

    const onTouchEnd = () => {
      el.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      if (currentDeltaY.current > 120) {
        onClose();
      } else {
        el.style.transform = "translateY(0)";
      }
      currentDeltaY.current = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 29,
          background: open ? "rgba(0,0,0,0.35)" : "transparent",
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
          background: "rgba(15, 14, 23, 0.97)",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: "12px 0 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 36, height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.2)",
          }} />
          {label && (
            <span style={{ fontSize: 12, color: "#a7a9be", fontWeight: 600, paddingBottom: 4 }}>{label}</span>
          )}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  );
}
