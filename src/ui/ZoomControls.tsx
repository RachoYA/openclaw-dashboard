interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div style={containerStyle}>
      <button onClick={onZoomIn} style={btnStyle} title="Zoom in">＋</button>
      <button onClick={onReset} style={{ ...btnStyle, fontSize: "11px" }} title="Reset zoom">⟳</button>
      <button onClick={onZoomOut} style={btnStyle} title="Zoom out">−</button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 200,
  right: 16,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  zIndex: 15,
};

const btnStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  border: "1px solid rgba(0,0,0,0.1)",
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(10px)",
  fontSize: "18px",
  fontWeight: 700,
  color: "#1d1d1f",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  transition: "background 0.15s",
};
