const REPO_URL = "https://github.com/RachoYA/openclaw-dashboard";

export function TaskButton() {
  return (
    <div style={containerStyle}>
      <a
        href={`${REPO_URL}/issues/new`}
        target="_blank"
        rel="noopener noreferrer"
        style={buttonStyle}
        title="Создать задачу на GitHub"
      >
        ➕ Новая задача
      </a>
      <a
        href={`${REPO_URL}/issues`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...buttonStyle, background: "#2a2a4a" }}
        title="Список задач"
      >
        📋 Задачи
      </a>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  display: "flex",
  gap: "6px",
  zIndex: 10,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#fffffe",
  background: "#7f5af0",
  border: "none",
  borderRadius: "8px",
  textDecoration: "none",
  cursor: "pointer",
  transition: "opacity 0.2s",
};
