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
        <a
          href="https://github.com/devstefancho/claude-pulse"
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-btn github-link"
          title="GitHub Repository"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>
      </div>
    </div>
  );
}
