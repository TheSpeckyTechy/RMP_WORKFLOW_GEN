// ── ProgrammePrint.jsx ────────────────────────────────────────────────────────
// A4 landscape print view for the design programme.
// Renders inside the Programme Tracker (display:none on screen).
// @media print makes it visible and hides the rest of the app.
// Triggered by window.print() from the tracker's Print button.
// ─────────────────────────────────────────────────────────────────────────────

const _PP_START  = new Date(2026, 3, 1).getTime();
const _PP_END    = new Date(2027, 2, 31, 23, 59, 59).getTime();
const _PP_SPAN   = _PP_END - _PP_START;
const _PP_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

const _ppParse = (str) => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  return new Date(+y, +m - 1, +d).getTime();
};

const _ppFmtDate = (dmy) => {
  if (!dmy) return '—';
  const [d, m, y] = dmy.split('/');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(+d).padStart(2,'0')} ${mo[+m-1]} ${y}`;
};

const _ppArea = (s) => {
  const a = s.scheme_type === 'Footway' ? s.footway_area_m2 : s.carriageway_area_m2;
  return a ? (+a).toLocaleString() : '—';
};

// ── Gantt bar row ─────────────────────────────────────────────────────────────
const PrintGanttRow = ({ scheme, colour, isLast }) => {
  const startMs  = _ppParse(scheme.date_start);
  const finishMs = _ppParse(scheme.date_finish);
  let left = 0, width = 1, hasBar = false;
  if (startMs) {
    const rawL  = ((startMs - _PP_START) / _PP_SPAN) * 100;
    left        = Math.max(0, Math.min(99, rawL));
    const rawR  = finishMs ? ((finishMs - _PP_START) / _PP_SPAN) * 100 : rawL + 2;
    const clampR = Math.min(100, Math.max(left, rawR));
    width       = Math.max(0.8, clampR - left);
    hasBar      = startMs >= _PP_START - 86400000 * 90 && startMs <= _PP_END + 86400000 * 90;
  }
  const todayPct = ((Date.now() - _PP_START) / _PP_SPAN) * 100;
  return (
    <div style={{ display:'flex', alignItems:'center', borderBottom: isLast ? 'none' : '1px solid #f0f0f0', minHeight:22 }}>
      <div style={{ width:180, flexShrink:0, fontSize:'8.5pt', color:'#333', paddingRight:8, paddingLeft:4, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontFamily:'Inter,system-ui,sans-serif' }} title={scheme.road_name}>
        {scheme.road_name}
      </div>
      <div style={{ flex:1, position:'relative', height:16 }}>
        {_PP_MONTHS.map((_, i) => i > 0 && (
          <div key={i} style={{ position:'absolute', top:0, left:`${(i/12)*100}%`, width:1, height:'100%', background:'#ebebeb' }} />
        ))}
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{ position:'absolute', top:0, left:`${todayPct}%`, width:1.5, height:'100%', background:'#dc2626', opacity:0.7 }} />
        )}
        {hasBar && (
          <div style={{
            position:'absolute', left:`${left}%`, width:`${width}%`,
            top:2, height:12, background:colour, borderRadius:3,
            fontSize:'6.5pt', color:'white', display:'flex', alignItems:'center',
            paddingLeft:3, overflow:'hidden', whiteSpace:'nowrap',
            fontFamily:'JetBrains Mono,monospace', letterSpacing:'-0.02em',
          }}>
            {width > 7 ? (scheme.project_number || '') : ''}
          </div>
        )}
      </div>
    </div>
  );
};

// ── One designer's complete A4 programme page ─────────────────────────────────
const PrintDesignerPage = ({ designer, schemes, today, isEveryoneView }) => {
  const dated   = [...schemes].filter(s => s.date_start).sort((a,b) => _ppParse(a.date_start) - _ppParse(b.date_start));
  const undated = schemes.filter(s => !s.date_start);
  const all     = [...dated, ...undated];
  const totalM2 = schemes.reduce((a,s) => a + (+(s.scheme_type==='Footway' ? s.footway_area_m2 : s.carriageway_area_m2)||0), 0);

  return (
    <div style={{ fontFamily:'Inter,system-ui,sans-serif', color:'#111', background:'white', padding: 0 }}>

      {/* ── Page header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'3px solid #1a1d23', paddingBottom:10, marginBottom:14 }}>
        <div>
          <div style={{ fontSize:'7.5pt', color:'#777', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:3 }}>
            Dundee City Council · Roads Maintenance Partnership · RMP Design Studio
          </div>
          <div style={{ fontSize:'16pt', fontWeight:700, color:'#1a1d23', lineHeight:1.1, marginBottom:5 }}>
            Design Programme — Financial Year 2026/27
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {designer && (
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:'50%', background:designer.colour, color:'white', fontSize:'9pt', fontWeight:700, flexShrink:0 }}>
                {designer.initials}
              </span>
            )}
            <span style={{ fontSize:'12pt', fontWeight:600, color:'#1a1d23' }}>
              {designer ? designer.name : 'All Designers'}
            </span>
            <span style={{ fontSize:'9.5pt', color:'#666', marginLeft:4 }}>
              {all.length} scheme{all.length !== 1 ? 's' : ''}
              {totalM2 > 0 ? ` · ${totalM2.toLocaleString()} m² total area` : ''}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right', lineHeight:1.7, flexShrink:0 }}>
          <div style={{ fontSize:'9pt', fontWeight:600, color:'#333' }}>Printed: {today}</div>
          <div style={{ fontSize:'7.5pt', color:'#888', fontFamily:'JetBrains Mono,monospace' }}>For internal use only</div>
          <div style={{ fontSize:'7.5pt', color:'#888', fontFamily:'JetBrains Mono,monospace' }}>Dates are indicative — verify before use</div>
        </div>
      </div>

      {/* ── Gantt timeline ── */}
      {dated.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:'7.5pt', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#888', marginBottom:5, display:'flex', alignItems:'center', gap:10 }}>
            Programme Timeline · April 2026 – March 2027
            <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>
              {dated.length} dated scheme{dated.length !== 1 ? 's' : ''}
              {undated.length > 0 ? ` · ${undated.length} without start date (see table)` : ''}
            </span>
          </div>

          {/* Month label row */}
          <div style={{ display:'flex', alignItems:'flex-end', marginBottom:3, borderBottom:'1.5px solid #ccc', paddingBottom:3 }}>
            <div style={{ width:180, flexShrink:0 }} />
            <div style={{ flex:1, position:'relative', height:14 }}>
              {_PP_MONTHS.map((m, i) => (
                <div key={i} style={{ position:'absolute', left:`${(i/12)*100}%`, top:0, bottom:0 }}>
                  <div style={{ fontSize:'7pt', color:'#888', whiteSpace:'nowrap', paddingLeft:3, fontFamily:'JetBrains Mono,monospace' }}>{m}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gantt rows */}
          {dated.map((s, i) => (
            <PrintGanttRow key={s.id} scheme={s} colour={designer?.colour || '#9ca3af'} isLast={i === dated.length - 1} />
          ))}
        </div>
      )}

      {/* ── Scheme table ── */}
      <div>
        <div style={{ fontSize:'7.5pt', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#888', marginBottom:6, borderBottom:'1px solid #ddd', paddingBottom:4 }}>
          Scheme Summary
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9.5pt', lineHeight:1.45 }}>
          <thead>
            <tr style={{ background:'#1a1d23', color:'white' }}>
              <th style={{ padding:'6px 6px 6px 8px', textAlign:'center', fontSize:'8pt', fontWeight:600, width:26 }}>#</th>
              <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'8pt', fontWeight:600 }}>Road Name / Location</th>
              <th style={{ padding:'6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:72, fontFamily:'JetBrains Mono,monospace' }}>Reference</th>
              <th style={{ padding:'6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:84 }}>Type</th>
              <th style={{ padding:'6px 6px', textAlign:'right', fontSize:'8pt', fontWeight:600, width:70 }}>Area m²</th>
              <th style={{ padding:'6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:90 }}>Start</th>
              <th style={{ padding:'6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:90 }}>Finish</th>
              <th style={{ padding:'6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:94 }}>Status</th>
              <th style={{ padding:'6px 8px 6px 6px', textAlign:'left', fontSize:'8pt', fontWeight:600, width:80 }}>Ward</th>
            </tr>
          </thead>
          <tbody>
            {all.map((s, i) => {
              const isEven   = i % 2 === 0;
              const noDate   = !s.date_start;
              const rowBg    = noDate ? '#fffbf0' : isEven ? '#fff' : '#f6f6f6';
              const status   = window.STATUS_LABELS?.[s.status] || s.status;
              return (
                <tr key={s.id} style={{ background:rowBg, borderBottom:'1px solid #e4e4e4', pageBreakInside:'avoid' }}>
                  <td style={{ padding:'5px 6px 5px 8px', textAlign:'center', color:'#aaa', fontSize:'8pt', fontFamily:'JetBrains Mono,monospace' }}>{i+1}</td>
                  <td style={{ padding:'5px 8px' }}>
                    <div style={{ fontWeight:600, color:'#1a1d23', fontSize:'10pt' }}>{s.road_name}</div>
                    {s.scheme_extent && <div style={{ fontSize:'8pt', color:'#777', marginTop:1 }}>{s.scheme_extent}</div>}
                  </td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', color:'#555' }}>{s.project_number || '—'}</td>
                  <td style={{ padding:'5px 6px', color:'#555' }}>{s.scheme_type || '—'}</td>
                  <td style={{ padding:'5px 6px', textAlign:'right', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', fontWeight:600, color:'#333' }}>{_ppArea(s)}</td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', color: noDate ? '#ccc' : '#333' }}>{_ppFmtDate(s.date_start)}</td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', color: !s.date_finish ? '#ccc' : '#333' }}>{_ppFmtDate(s.date_finish)}</td>
                  <td style={{ padding:'5px 6px', color:'#555' }}>{status}</td>
                  <td style={{ padding:'5px 8px 5px 6px', color:'#666', fontSize:'8.5pt' }}>{s.ward_selected || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop:14, paddingTop:8, borderTop:'1px solid #ddd', display:'flex', justifyContent:'space-between', fontSize:'7pt', color:'#aaa', fontFamily:'JetBrains Mono,monospace' }}>
        <span>Roads Maintenance Partnership · Dundee City Council</span>
        <span>Design Programme 2026/27 · {designer ? designer.name : 'All Designers'}</span>
        <span>{today}</span>
      </div>
    </div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────
const ProgrammePrint = ({ allSchemes, designerView, designers }) => {
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const getFilteredSchemes = (designerId) =>
    allSchemes.filter(s =>
      (designerId ? s.assigned_designer_id === designerId : true) &&
      s.status !== 'archived' && s.status !== 'constructed' && s.status !== 'shelved'
    );

  if (designerView) {
    const designer = designers.find(d => d.id === designerView);
    const schemes  = getFilteredSchemes(designerView);
    return (
      <div className="programme-print-root">
        <style>{`
          @page { size: A4 landscape; margin: 12mm 15mm; }
          @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        `}</style>
        <PrintDesignerPage designer={designer} schemes={schemes} today={today} />
      </div>
    );
  }

  // Everyone view — one page per designer with page breaks
  const groups = designers
    .map(d => ({ designer: d, schemes: getFilteredSchemes(d.id) }))
    .filter(g => g.schemes.length > 0);

  return (
    <div className="programme-print-root">
      <style>{`
        @page { size: A4 landscape; margin: 12mm 15mm; }
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
      `}</style>
      {groups.map(({ designer, schemes }, i) => (
        <div key={designer.id} style={{ pageBreakAfter: i < groups.length - 1 ? 'always' : 'auto' }}>
          <PrintDesignerPage designer={designer} schemes={schemes} today={today} isEveryoneView />
        </div>
      ))}
    </div>
  );
};

window.ProgrammePrint = ProgrammePrint;
