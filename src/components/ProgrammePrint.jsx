// ── ProgrammePrint.jsx ────────────────────────────────────────────────────────
// A4 landscape print view for the design programme.
// Uses <table> layouts for both the Gantt and summary — tables paginate
// reliably across browsers and support repeating <thead> on every page.
// Triggered by window.print() from the Programme Tracker print button.
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

// CSS injected once into the document for print-specific rules
const PP_STYLE = `
  @page { size: A4 landscape; margin: 12mm 15mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .pp-thead { display: table-header-group !important; }
    .pp-tfoot { display: table-footer-group !important; }
    .pp-hd    { break-after: avoid; page-break-after: avoid; }
    .pp-row   { break-inside: avoid; page-break-inside: avoid; }
    .pp-page  { break-before: auto; }
  }
`;

// ── Gantt section ─────────────────────────────────────────────────────────────
// Rendered as a <table> so each row has reliable height in print and the
// month-label header aligns pixel-perfectly with every bar row beneath it.
const PrintGantt = ({ schemes, colour }) => {
  const todayPct = ((Date.now() - _PP_START) / _PP_SPAN) * 100;

  return (
    <table style={{ width:'100%', tableLayout:'fixed', borderCollapse:'collapse', marginBottom:4 }}>
      <colgroup>
        <col style={{ width:182 }} />
        <col />
      </colgroup>

      {/* Month labels — thead so they repeat if gantt spans page */}
      <thead className="pp-thead">
        <tr>
          <td />
          <td style={{ position:'relative', height:18, borderBottom:'1.5px solid #ccc', verticalAlign:'bottom', paddingBottom:2 }}>
            {_PP_MONTHS.map((m, i) => (
              <span key={i} style={{
                position:'absolute',
                left:`${(i/12)*100}%`,
                bottom:3,
                fontSize:'7pt',
                color:'#888',
                fontFamily:'JetBrains Mono,monospace',
                whiteSpace:'nowrap',
              }}>{m}</span>
            ))}
            {/* month grid lines in header */}
            {_PP_MONTHS.map((_, i) => i > 0 && (
              <span key={`l${i}`} style={{
                position:'absolute',
                left:`${(i/12)*100}%`,
                top:0, bottom:0,
                width:1,
                background:'#e0e0e0',
              }} />
            ))}
          </td>
        </tr>
      </thead>

      <tbody>
        {schemes.map((s, idx) => {
          const startMs  = _ppParse(s.date_start);
          const finishMs = _ppParse(s.date_finish);
          let left = 0, width = 1, hasBar = false;
          if (startMs) {
            const rawL   = ((startMs - _PP_START) / _PP_SPAN) * 100;
            left         = Math.max(0, Math.min(99, rawL));
            const rawR   = finishMs ? ((finishMs - _PP_START) / _PP_SPAN) * 100 : rawL + 2;
            const clampR = Math.min(100, Math.max(left, rawR));
            width        = Math.max(0.8, clampR - left);
            hasBar       = startMs >= _PP_START - 86400000*90 && startMs <= _PP_END + 86400000*90;
          }
          const isLast = idx === schemes.length - 1;
          return (
            <tr key={s.id} className="pp-row" style={{ borderBottom: isLast ? 'none' : '1px solid #f0f0f0' }}>
              {/* Road name label */}
              <td style={{
                fontSize:'8.5pt', color:'#333', paddingRight:6, paddingLeft:2,
                overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                fontFamily:'Inter,system-ui,sans-serif', verticalAlign:'middle',
                height:22, maxWidth:182,
              }} title={s.road_name}>
                {s.road_name}
              </td>

              {/* Bar track */}
              <td style={{ position:'relative', height:22, verticalAlign:'middle' }}>
                {/* month grid lines */}
                {_PP_MONTHS.map((_, i) => i > 0 && (
                  <span key={i} style={{
                    position:'absolute', top:0, left:`${(i/12)*100}%`,
                    width:1, height:'100%', background:'#ebebeb',
                  }} />
                ))}
                {/* today line */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <span style={{
                    position:'absolute', top:0, left:`${todayPct}%`,
                    width:1.5, height:'100%', background:'#dc2626', opacity:0.65,
                  }} />
                )}
                {/* bar */}
                {hasBar && (
                  <span style={{
                    position:'absolute', left:`${left}%`, width:`${width}%`,
                    top:'50%', transform:'translateY(-50%)',
                    height:12, background:colour, borderRadius:3,
                    display:'inline-flex', alignItems:'center',
                    paddingLeft:3, overflow:'hidden', whiteSpace:'nowrap',
                    fontSize:'6.5pt', color:'white',
                    fontFamily:'JetBrains Mono,monospace',
                  }}>
                    {width > 7 ? (s.project_number || '') : ''}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ── One designer's programme page ─────────────────────────────────────────────
const PrintDesignerPage = ({ designer, schemes, today }) => {
  const dated   = [...schemes].filter(s => s.date_start).sort((a,b) => _ppParse(a.date_start) - _ppParse(b.date_start));
  const undated = schemes.filter(s => !s.date_start);
  const all     = [...dated, ...undated];
  const totalM2 = schemes.reduce((a,s) => a+(+(s.scheme_type==='Footway' ? s.footway_area_m2 : s.carriageway_area_m2)||0), 0);

  // Column header style
  const TH = ({ children, align='left', w }) => (
    <th style={{
      padding:'6px 6px', textAlign:align, fontSize:'8pt', fontWeight:700,
      color:'white', background:'#1a1d23', verticalAlign:'bottom',
      borderBottom:'2px solid #333', whiteSpace:'nowrap',
      ...(w ? { width:w } : {}),
    }}>{children}</th>
  );

  return (
    <div className="pp-page" style={{ fontFamily:'Inter,system-ui,sans-serif', color:'#111', background:'white' }}>

      {/* ── Page header — keep together, never orphan ── */}
      <div className="pp-hd" style={{
        display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        borderBottom:'3px solid #1a1d23', paddingBottom:10, marginBottom:12,
      }}>
        <div>
          <div style={{ fontSize:'7.5pt', color:'#777', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:3 }}>
            Dundee City Council · Roads Maintenance Partnership · RMP Design Studio
          </div>
          <div style={{ fontSize:'16pt', fontWeight:700, color:'#1a1d23', lineHeight:1.1, marginBottom:5 }}>
            Design Programme — Financial Year 2026/27
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {designer && (
              <span style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:26, height:26, borderRadius:'50%',
                background:designer.colour, color:'white', fontSize:'9pt', fontWeight:700, flexShrink:0,
              }}>{designer.initials}</span>
            )}
            <span style={{ fontSize:'12pt', fontWeight:600, color:'#1a1d23' }}>
              {designer ? designer.name : 'All Designers'}
            </span>
            <span style={{ fontSize:'9.5pt', color:'#666', marginLeft:4 }}>
              {all.length} scheme{all.length!==1?'s':''}
              {totalM2>0 ? ` · ${totalM2.toLocaleString()} m² total area` : ''}
              {undated.length>0 ? ` · ${undated.length} undated` : ''}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right', lineHeight:1.7, flexShrink:0, marginLeft:20 }}>
          <div style={{ fontSize:'9pt', fontWeight:600, color:'#333' }}>Printed: {today}</div>
          <div style={{ fontSize:'7.5pt', color:'#888', fontFamily:'JetBrains Mono,monospace' }}>For internal use only</div>
          <div style={{ fontSize:'7.5pt', color:'#888', fontFamily:'JetBrains Mono,monospace' }}>Dates are indicative — verify before use</div>
        </div>
      </div>

      {/* ── Gantt timeline ── */}
      {dated.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div className="pp-hd" style={{
            fontSize:'7.5pt', fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.1em', color:'#555', marginBottom:6,
            borderBottom:'1px solid #ccc', paddingBottom:4,
          }}>
            Programme Timeline · April 2026 – March 2027
            <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:10, color:'#888' }}>
              {dated.length} dated scheme{dated.length!==1?'s':''}
            </span>
          </div>
          <PrintGantt schemes={dated} colour={designer?.colour || '#9ca3af'} />
        </div>
      )}

      {/* ── Scheme summary table ── */}
      <div>
        <div className="pp-hd" style={{
          fontSize:'7.5pt', fontWeight:700, textTransform:'uppercase',
          letterSpacing:'0.1em', color:'#555', marginBottom:6,
          borderBottom:'1px solid #ccc', paddingBottom:4,
        }}>
          Scheme Summary
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9.5pt', lineHeight:1.5, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:26 }} />     {/* # */}
            <col />                           {/* Road Name — fills space */}
            <col style={{ width:72 }} />     {/* Ref */}
            <col style={{ width:90 }} />     {/* Type */}
            <col style={{ width:68 }} />     {/* Area */}
            <col style={{ width:92 }} />     {/* Start */}
            <col style={{ width:92 }} />     {/* Finish */}
            <col style={{ width:96 }} />     {/* Status */}
            <col style={{ width:82 }} />     {/* Ward */}
          </colgroup>
          <thead className="pp-thead">
            <tr>
              <TH align="center">#</TH>
              <TH>Road Name / Location</TH>
              <TH>Reference</TH>
              <TH>Type</TH>
              <TH align="right">Area m²</TH>
              <TH>Start</TH>
              <TH>Finish</TH>
              <TH>Status</TH>
              <TH>Ward</TH>
            </tr>
          </thead>
          <tbody>
            {all.map((s, i) => {
              const noDate = !s.date_start;
              const isEven = i % 2 === 0;
              const rowBg  = noDate ? '#fffbf0' : isEven ? '#fff' : '#f5f5f5';
              const status = window.STATUS_LABELS?.[s.status] || s.status;
              return (
                <tr key={s.id} className="pp-row" style={{ background:rowBg, borderBottom:'1px solid #e8e8e8' }}>
                  <td style={{ padding:'5px 4px', textAlign:'center', color:'#bbb', fontSize:'8pt', fontFamily:'JetBrains Mono,monospace', verticalAlign:'middle' }}>
                    {i+1}
                  </td>
                  <td style={{ padding:'5px 6px 5px 8px', verticalAlign:'middle', overflow:'hidden' }}>
                    <div style={{ fontWeight:600, color:'#1a1d23', fontSize:'9.5pt', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.road_name}</div>
                    {s.scheme_extent && <div style={{ fontSize:'7.5pt', color:'#777', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.scheme_extent}</div>}
                  </td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8pt', color:'#555', verticalAlign:'middle', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {s.project_number || '—'}
                  </td>
                  <td style={{ padding:'5px 6px', fontSize:'9pt', color:'#555', verticalAlign:'middle' }}>
                    {s.scheme_type || '—'}
                  </td>
                  <td style={{ padding:'5px 6px', textAlign:'right', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', fontWeight:600, color:'#333', verticalAlign:'middle' }}>
                    {_ppArea(s)}
                  </td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', color: noDate ? '#ccc' : '#333', verticalAlign:'middle' }}>
                    {_ppFmtDate(s.date_start)}
                  </td>
                  <td style={{ padding:'5px 6px', fontFamily:'JetBrains Mono,monospace', fontSize:'8.5pt', color: !s.date_finish ? '#ccc' : '#333', verticalAlign:'middle' }}>
                    {_ppFmtDate(s.date_finish)}
                  </td>
                  <td style={{ padding:'5px 6px', fontSize:'9pt', color:'#555', verticalAlign:'middle' }}>
                    {status}
                  </td>
                  <td style={{ padding:'5px 6px', fontSize:'8.5pt', color:'#666', verticalAlign:'middle', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {s.ward_selected || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop:14, paddingTop:8, borderTop:'1px solid #ddd',
        display:'flex', justifyContent:'space-between',
        fontSize:'7pt', color:'#bbb', fontFamily:'JetBrains Mono,monospace',
      }}>
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

  const getSchemes = (designerId) =>
    allSchemes.filter(s =>
      (designerId ? s.assigned_designer_id === designerId : true) &&
      s.status !== 'archived' && s.status !== 'constructed' && s.status !== 'shelved'
    );

  const styleEl = <style>{PP_STYLE}</style>;

  if (designerView) {
    const designer = designers.find(d => d.id === designerView);
    return (
      <div className="programme-print-root">
        {styleEl}
        <PrintDesignerPage designer={designer} schemes={getSchemes(designerView)} today={today} />
      </div>
    );
  }

  const groups = designers
    .map(d => ({ designer: d, schemes: getSchemes(d.id) }))
    .filter(g => g.schemes.length > 0);

  return (
    <div className="programme-print-root">
      {styleEl}
      {groups.map(({ designer, schemes }, i) => (
        <div key={designer.id} style={i < groups.length - 1 ? { pageBreakAfter:'always', breakAfter:'page' } : {}}>
          <PrintDesignerPage designer={designer} schemes={schemes} today={today} />
        </div>
      ))}
    </div>
  );
};

window.ProgrammePrint = ProgrammePrint;
