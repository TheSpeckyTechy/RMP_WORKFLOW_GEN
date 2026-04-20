// ─── Sidebar.jsx ─────────────────────────────────────────────────────────────
// Left-hand navigation sidebar: RMP branding, main nav links, user chip.
//
// Props:
//   view   (string) — currently active view key ("dashboard" | "settings")
//   onView (fn)     — called with the new view key on nav item click
//
// Exports (via window): Sidebar
// Depends on: React, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const Sidebar = ({ view, onView }) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="sidebar-logo-mark">RMP</div>
      <div className="sidebar-logo-text">Design Studio</div>
    </div>
    <nav className="sidebar-nav">
      <button className={"nav-item " + (view === "dashboard" || !view ? "active" : "")} onClick={() => onView("dashboard")}>
        <Icon.Folder /><span>Schemes</span>
      </button>
      <button className={"nav-item " + (view === "settings" ? "active" : "")} onClick={() => onView("settings")}>
        <Icon.Cog /><span>Settings</span>
      </button>
    </nav>
    <div className="sidebar-foot">
      <div className="user-chip">
        <div className="user-avatar">JM</div>
        <div>
          <div className="user-name">Jake McAllister</div>
          <div className="user-role">Designer · RMP</div>
        </div>
      </div>
    </div>
  </aside>
);

window.Sidebar = Sidebar;
