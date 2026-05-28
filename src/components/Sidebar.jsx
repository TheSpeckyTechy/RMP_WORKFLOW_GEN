// ─── Sidebar.jsx ─────────────────────────────────────────────────────────────────────────────
// Left-hand navigation sidebar: RMP branding, main nav links, user chip.
//
// Props:
//   view   (string) — currently active view key ("dashboard" | "settings")
//   onView (fn)     — called with the new view key on nav item click
//
// Exports (via window): Sidebar
// Depends on: React, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const Sidebar = ({ view, onView, open, onClose }) => {
  const navRef = React.useRef(null);
  const indicatorRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (!navRef.current || !indicatorRef.current) return;
    const activeItem = navRef.current.querySelector('.nav-item.active');
    if (!activeItem) return;
    const navRect = navRef.current.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    indicatorRef.current.style.top    = (itemRect.top  - navRect.top)  + 'px';
    indicatorRef.current.style.height = itemRect.height + 'px';
  }, [view, open]);

  return (
    <aside className={"sidebar" + (open ? " sidebar--open" : "")}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">RMP</div>
        <div className="sidebar-logo-text">Design Studio</div>
      </div>
      <nav className="sidebar-nav" ref={navRef}>
        <div className="sidebar-nav-indicator" ref={indicatorRef} />
        <button className={"nav-item " + (view === "dashboard" || !view ? "active" : "")} onClick={() => onView("dashboard")}>
          <Icon.Folder /><span>Schemes</span>
        </button>
        <button className={"nav-item " + (view === "analytics" ? "active" : "")} onClick={() => onView("analytics")}>
          <Icon.BarChart /><span>Analysis</span>
        </button>
        <button className={"nav-item " + (view === "tracker" ? "active" : "")} onClick={() => onView("tracker")}>
          <Icon.Calendar /><span>Programme</span>
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
        <div className="sidebar-version">{window.APP_VERSION}</div>
      </div>
    </aside>
  );
};

window.Sidebar = Sidebar;
