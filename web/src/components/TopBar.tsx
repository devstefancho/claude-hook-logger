import type { LayoutMode, SidebarView, VariantType } from "../App";

function PulseLogo() {
  return (
    <img
      className="topbar-logo"
      src="/logo.png"
      alt="Claude Pulse"
    />
  );
}

interface TopBarProps {
  files: string[];
  currentFile: string;
  onFileChange: (file: string) => void;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  variant: VariantType;
  onVariantChange: (variant: VariantType) => void;
  feedOpen?: boolean;
  onToggleFeed?: () => void;
  feedUnreadCount?: number;
}

const LAYOUT_ICONS: Record<LayoutMode, string> = {
  full: "\u2261",
  compact: "\u2502",
  focus: "\u25A1",
};

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  full: "Sidebar",
  compact: "Icons",
  focus: "Focus",
};

const NAV_ITEMS: { key: SidebarView; label: string }[] = [
  { key: "agents", label: "Agents" },
  { key: "tools", label: "Tools" },
  { key: "skills", label: "Skills" },
  { key: "events", label: "Events" },
];

export function TopBar({
  files,
  currentFile,
  onFileChange,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  chatOpen,
  onToggleChat,
  layoutMode,
  onLayoutChange,
  activeView,
  onChangeView,
  variant,
  onVariantChange,
  feedOpen,
  onToggleFeed,
  feedUnreadCount,
}: TopBarProps) {
  const nextMode = (): LayoutMode => {
    if (layoutMode === "full") return "compact";
    if (layoutMode === "compact") return "focus";
    return "full";
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          className="topbar-btn layout-toggle"
          onClick={() => onLayoutChange(nextMode())}
          title={`Layout: ${LAYOUT_LABELS[layoutMode]}`}
        >
          <span className="layout-icon">{LAYOUT_ICONS[layoutMode]}</span>
        </button>
        <PulseLogo />
        <span className="topbar-title">CLAUDE PULSE</span>
        {layoutMode === "focus" && (
          <div className="topbar-nav">
            {NAV_ITEMS.map(({ key, label }) => (
              <button
                key={key}
                className={`topbar-nav-btn${activeView === key ? " active" : ""}`}
                onClick={() => onChangeView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <select
          className="topbar-select"
          value={currentFile}
          onChange={(e) => onFileChange(e.target.value)}
        >
          {files.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button className="topbar-btn" onClick={onRefresh}>
          Refresh
        </button>
        <button
          className={`topbar-btn${autoRefresh ? " active" : ""}`}
          onClick={onToggleAutoRefresh}
        >
          Auto {autoRefresh ? "ON" : "OFF"}
        </button>
        <select
          className="topbar-select variant-select"
          value={variant}
          onChange={(e) => onVariantChange(e.target.value as VariantType)}
          title="Status display variant"
        >
          <option value="a">A: Inline</option>
          <option value="b">B: Overlay</option>
          <option value="c">C: Feed</option>
        </select>
        {variant === "c" && onToggleFeed && (
          <button
            className={`topbar-btn${feedOpen ? " active" : ""}`}
            onClick={onToggleFeed}
            title="Activity Feed"
          >
            &#128276;{feedUnreadCount ? <span className="feed-badge">{feedUnreadCount}</span> : null}
          </button>
        )}
        <button
          className={`topbar-btn${chatOpen ? " active" : ""}`}
          onClick={onToggleChat}
        >
          Chat
        </button>
      </div>
    </div>
  );
}
