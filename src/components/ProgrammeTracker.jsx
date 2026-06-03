// ─── ProgrammeTracker.jsx ────────────────────────────────────────────────────
// Dedicated full-page Gantt timeline showing the entire programme, grouped by
// designer. Colour-coded by designer. Click any row to open that scheme.
//
// Props:
//   onOpen          (fn)     — called with schemeId when a row is clicked
//   designerView    (string) — active designer filter id (null = everyone)
//   setDesignerView (fn)     — updates the active designer filter
//   statusFilter    (string) — active status filter key (lifted to AppInner)
//   setStatusFilter (fn)     — updates the status filter
//
// Exports (via window): ProgrammeTracker
// Depends on: React, window.SchemeContext, window.DESIGNERS,
//             window.STATUS_LABELS, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

// Local-time constructors match ptParseDMY (also local time) — avoids UTC/BST drift
const PT_START  = new Date(2026, 3, 1).getTime();            // 1 Apr 2026 00:00 local
const PT_END    = new Date(2027, 2, 31, 23, 59, 59).getTime(); // 31 Mar 2027 end-of-day local
const PT_SPAN   = PT_END - PT_START;
const PT_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const URGENT_MS = 42 * 24 * 60 * 60 * 1000;

const ptParseDMY = (str) => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  return new Date(+y, +m - 1, +d).getTime();
};

const ptIsUrgent = (s) => {
  const ms = ptParseDMY(s.date_start);
  if (!ms) return false;
  const now = Date.now();
  return ms > now && ms - now <= URGENT_MS;
};

// ── Individual Gantt row ──────────────────────────────────────────────────────
const TrackerRow = ({ scheme, onOpen, idx, showDesigner }) => {
  const designer = (window.DESIGNERS||[]).find(d => d.id === scheme.assigned_designer_id);
  const colour   = designer?.colour || 'var(--ink-3)';
  const startMs  = ptParseDMY(scheme.date_start);
  const finishMs = ptParseDMY(scheme.date_finish);
  const todayPct = ((Date.now() - PT_START) / PT_SPAN) * 100;
  const urgent   = ptIsUrgent(scheme);

  // Clamp both edges before computing width so bars never overflow the grid
  let clampL = 0, widthPct = 0.6, inRange = false;
  if (startMs) {
    const rawL  = ((startMs - PT_START) / PT_SPAN) * 100;
    clampL      = Math.max(0, Math.min(99, rawL));
    const rawR  = finishMs ? ((finishMs - PT_START) / PT_SPAN) * 100 : rawL + 1.5;
    const clampR = Math.min(100, Math.max(clampL, rawR));
    widthPct    = Math.max(0.6, clampR - clampL);
    inRange     = startMs >= PT_START - 86400000 * 90 && startMs <= PT_END + 86400000 * 90;
  }
  const delay = `${Math.min(idx * 8, 320)}ms`;

  // Derive "On Site" from dates — only show it if today actually falls within
  // the construction window; otherwise fall back to the stored status.
  const now = Date.now();
  const displayStatus = (startMs && finishMs && now >= startMs && now <= finishMs)
    ? 'works'
    : scheme.status;

  return (
    <div className="tracker-row" onClick={() => onOpen(scheme.id)}>
      <div className="tracker-row-label">
        {showDesigner && (
          designer
            ? <span className="tracker-dot" style={{ background: designer.colour }} title={designer.name}>{designer.initials}</span>
            : <span className="tracker-dot tracker-dot--unassigned">?</span>
        )}
        <div className="tracker-row-info">
          <div className="tracker-row-name">
            {scheme.road_name}
            {urgent && <span className="urgent-chip" style={{ marginLeft:4, fontSize:10, padding:'1px 6px' }}>⚡</span>}
          </div>
          <div className="tracker-row-ref mono">{scheme.project_number || '—'}</div>
        </div>
      </div>
      <div className="tracker-row-status">
        <span className={`pill ${displayStatus}`} style={{ fontSize:10, padding:'1px 6px', lineHeight:1.6 }}>
          {window.STATUS_LABELS?.[displayStatus] || displayStatus}
        </span>
      </div>
      <div className="gantt-track">
        <div className="gantt-track-bg" />
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="gantt-today-line" style={{ left:`${todayPct}%` }} />
        )}
        {startMs ? (
          inRange ? (
            <div
              className="gantt-bar"
              style={{ left:`${clampL}%`, width:`${widthPct}%`, background:colour, animationDelay:delay }}
              title={`${scheme.road_name} · ${scheme.date_start}${scheme.date_finish ? ' → '+scheme.date_finish : ''}`}
            >
              {widthPct > 6 ? (scheme.project_number || '') : ''}
            </div>
          ) : (
            <div className="gantt-dot" style={{ background:colour, left:'1%', animationDelay:delay }}
              title={`${scheme.road_name} (${scheme.date_start} — outside Apr 26–Mar 27)`} />
          )
        ) : null}
      </div>
    </div>
  );
};

// ── Designer summary card (top strip) ────────────────────────────────────────
const DesignerCard = ({ designer, schemes, onSelect }) => {
  const active = schemes.filter(s => s.status !== 'archived' && s.status !== 'constructed');
  const urgent = active.filter(ptIsUrgent).length;
  const dated  = active.filter(s => s.date_start).length;
  return (
    <div className="tracker-designer-card" onClick={() => onSelect(designer.id)}>
      <div className="tracker-card-avatar" style={{ background: designer.colour }}>{designer.initials}</div>
      <div>
        <div className="tracker-card-name">{designer.name.split(' ')[0]}</div>
        <div className="tracker-card-meta">{active.length} schemes</div>
        <div className="tracker-card-meta">{dated} dated{urgent > 0 ? ` · ${urgent} ⚡` : ''}</div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ProgrammeTracker = ({ onOpen, designerView, setDesignerView, statusFilter, setStatusFilter }) => {
  const { schemes } = React.useContext(window.SchemeContext);

  const designers      = (window.DESIGNERS||[]).filter(d => d.id !== 'new');
  const activeDesigner = designerView ? designers.find(d => d.id === designerView) : null;

  const byStatus = (s) => {
    if (statusFilter === 'active') return s.status !== 'archived' && s.status !== 'constructed' && s.status !== 'shelved';
    if (statusFilter === 'all')    return true;
    return s.status === statusFilter;
  };

  const viewSchemes = schemes
    .filter(s => designerView ? s.assigned_designer_id === designerView : true)
    .filter(byStatus);

  const dated   = [...viewSchemes].filter(s => s.date_start).sort((a,b) => ptParseDMY(a.date_start) - ptParseDMY(b.date_start));
  const undated = viewSchemes.filter(s => !s.date_start);

  const groups = designerView
    ? [{ designer: activeDesigner, rows: dated }]
    : [
        ...designers.map(d => ({ designer: d, rows: dated.filter(s => s.assigned_designer_id === d.id) })),
        { designer: null, rows: dated.filter(s => !designers.find(d => d.id === s.assigned_designer_id)) },
      ].filter(g => g.rows.length > 0);

  let rowIdx = 0;

  return (
    <>
      <div className="designer-selector">
        <button className={`designer-chip${!designerView ? ' active' : ''}`}
          onClick={() => setDesignerView && setDesignerView(null)}>Everyone</button>
        {designers.map(d => (
          <button key={d.id} className={`designer-chip${designerView === d.id ? ' active' : ''}`}
            style={designerView === d.id ? { borderColor: d.colour } : {}}
            onClick={() => setDesignerView && setDesignerView(designerView === d.id ? null : d.id)}>
            <span className="designer-chip-avatar" style={{ background: d.colour }}>{d.initials}</span>
            {d.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="page-head">
        <div>
          <h1 className="page-title">
            {activeDesigner ? `${activeDesigner.name.split(' ')[0]}'s Programme` : 'Programme Tracker'}
          </h1>
          <p className="page-sub">
            {activeDesigner
              ? `${activeDesigner.name}'s scheme timeline · FY 2026/27 · click any row to open`
              : 'Full design programme · FY 2026/27 · colour-coded by designer · click any row to open'}
          </p>
        </div>
        <button className="btn" style={{ flexShrink:0 }}
          onClick={() => window.printProgramme && window.printProgramme(schemes, designerView, designers)}
          title="Print this programme as A4 landscape — one page per designer">
          ⎙ Print Programme
        </button>
      </div>

      {!designerView && (
        <div className="tracker-designer-strip">
          {designers.map(d => (
            <DesignerCard key={d.id}
              designer={d}
              schemes={schemes.filter(s => s.assigned_designer_id === d.id)}
              onSelect={(id) => setDesignerView && setDesignerView(id)}
            />
          ))}
        </div>
      )}

      <div className="filters" style={{ marginBottom:4 }}>
        {[
          { k:'active',  l:'Active' },
          { k:'all',     l:'All' },
          { k:'design',  l:'In design' },
          { k:'review',  l:'In review' },
          { k:'ready',   l:'Ready' },
          { k:'works',   l:'On site' },
          { k:'shelved', l:'Shelved' },
        ].map(f => (
          <button key={f.k} className={`chip${statusFilter === f.k ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.k)}>{f.l}</button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>
          {viewSchemes.length} scheme{viewSchemes.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="tracker-gantt-wrap">
        {/* Month header — minWidth 600 matches gantt-track to keep columns aligned */}
        <div className="tracker-gantt-header">
          <div className="tracker-label-col" />
          <div className="tracker-status-col" />
          <div style={{ flex:1, position:'relative', minWidth:600, height:18 }}>
            {PT_MONTHS.map((m,i) => (
              <div key={i} className="gantt-month-label" style={{ left:`${(i/12)*100}%` }}>{m}</div>
            ))}
          </div>
        </div>

        {groups.map(({ designer, rows }) => (
          <div key={designer?.id || 'unassigned'}>
            {!designerView && (
              <div className="tracker-group-header">
                {designer ? (
                  <>
                    <span className="tracker-dot" style={{ background:designer.colour, flexShrink:0 }}>{designer.initials}</span>
                    <span>{designer.name}</span>
                  </>
                ) : <span>Unassigned</span>}
                <span style={{ marginLeft:8, fontWeight:400, color:'var(--ink-3)' }}>
                  {rows.length} scheme{rows.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {rows.map(s => {
              const i = rowIdx++;
              return <TrackerRow key={s.id} scheme={s} onOpen={onOpen} idx={i} showDesigner={!designerView} />;
            })}
          </div>
        ))}

        {undated.length > 0 && (
          <div>
            <div className="tracker-group-header" style={{ opacity:0.55 }}>
              <span>No start date</span>
              <span style={{ marginLeft:8, fontWeight:400, color:'var(--ink-3)' }}>
                {undated.length} scheme{undated.length !== 1 ? 's' : ''}
              </span>
            </div>
            {undated.map(s => {
              const i = rowIdx++;
              return <TrackerRow key={s.id} scheme={s} onOpen={onOpen} idx={i} showDesigner={!designerView} />;
            })}
          </div>
        )}

        {viewSchemes.length === 0 && (
          <div style={{ padding:'48px 0', textAlign:'center', color:'var(--ink-3)', fontSize:13 }}>
            No schemes match this filter.
          </div>
        )}
      </div>

    </>
  );
};

window.ProgrammeTracker = ProgrammeTracker;
