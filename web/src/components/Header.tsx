interface HeaderProps {
  files: string[];
  currentFile: string;
  onFileChange: (file: string) => void;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}

export function Header({
  files,
  currentFile,
  onFileChange,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  chatOpen,
  onToggleChat,
}: HeaderProps) {
  return (
    <div className="header">
      <h1>Hook Events Log Viewer</h1>
      <select
        value={currentFile}
        onChange={(e) => onFileChange(e.target.value)}
      >
        {files.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div className="spacer" />
      <button onClick={onRefresh}>Refresh</button>
      <button
        className={autoRefresh ? "active" : ""}
        onClick={onToggleAutoRefresh}
      >
        Auto-refresh: {autoRefresh ? "ON" : "OFF"}
      </button>
      <button
        className={chatOpen ? "active" : ""}
        onClick={onToggleChat}
      >
        Chat
      </button>
    </div>
  );
}
