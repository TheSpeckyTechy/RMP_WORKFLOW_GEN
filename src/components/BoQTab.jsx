// ─── BoQTab.jsx ───────────────────────────────────────────────────────────────
// Bill of Quantities tab — auto-generates a priced BoQ from scheme inputs
// using the embedded Tayside Contracts JMCA rate schedule (window.BOQ_RATES).
//
// Layout: two-panel
//   Left  (340px): scrollable input form — Treatment, Layers, TM, Ironwork,
//                  Footways/Kerbs, Markings
//   Right (flex):  live grouped BoQ table with series totals + Download .xlsx
//
// Exports (via window): BoQTab
// Depends on: React, window.BOQ_RATES, window.boqPickRate, window.boqItem,
//             window.SchemeContext, window.Icon, window.XLSX
// ─────────────────────────────────────────────────────────────────────────────

// ── Material option tables ────────────────────────────────────────────────────

const SURFACE_OPTIONS = [
  { tag:'surf_hra3014_40_14', label:'HRA 30/14F 40mm · 14mm chips' },
  { tag:'surf_hra3014_40_20', label:'HRA 30/14F 40mm · 20mm chips' },
  { tag:'surf_hra3514_45_14', label:'HRA 35/14F 45mm · 14mm chips' },
  { tag:'surf_hra3514_45_20', label:'HRA 35/14F 45mm · 20mm chips' },
  { tag:'surf_sma10_40',      label:'SMA 10 surf 40mm' },
  { tag:'surf_ac10_40',       label:'AC 10 close surf 40mm' },
  { tag:'surf_ac14_40',       label:'AC 14 close surf 40mm' },
  { tag:'surf_ac10hb_40',     label:'AC 10 HBC surf 40mm' },
  { tag:'surf_ac14hb_40',     label:'AC 14 HBC surf 40mm' },
  { tag:'surf_hra5510_40',    label:'HRA 55/10C surf 40mm' },
  { tag:'surf_ac6_30',        label:'AC 6 dense surf 30mm' },
];

const BINDER_OPTIONS = [
  { tag:'bin_hra5020_60',  label:'HRA 50/20 bin 60mm' },
  { tag:'bin_ac20d_60',    label:'AC 20 dense bin 60mm' },
  { tag:'bin_ac20hdm_60',  label:'AC 20 HDM bin 60mm' },
];

const BASE_OPTIONS = [
  { tag:'base_ac32d_100',   label:'AC 32 dense base 100mm' },
  { tag:'base_ac32d_150',   label:'AC 32 dense base 150mm' },
  { tag:'base_ac32hdm_100', label:'AC 32 HDM base 100mm' },
  { tag:'base_ac32hdm_150', label:'AC 32 HDM base 150mm' },
];

const MILLING_DEPTHS = [25, 40, 50, 60, 70, 80, 100, 150, 200];

const FOOTWAY_SURFACE_OPTIONS = [
  { tag:'fw_ac6_30',     label:'AC 6 close surf 30mm' },
  { tag:'fw_ac10_30',    label:'AC 10 close surf 30mm' },
  { tag:'fw_hra156_30',  label:'HRA 15/6F surf 30mm' },
  { tag:'fw_hra1510_30', label:'HRA 15/10F surf 30mm' },
];

const KERB_OPTIONS = [
  { tag:'kerb_k1_laid',   label:'K1 half-batter — laid' },
  { tag:'kerb_k1_raised', label:'K1 half-batter — raised' },
  { tag:'kerb_k2_laid',   label:'K2 transition — laid' },
  { tag:'kerb_k2_raised', label:'K2 transition — raised' },
  { tag:'kerb_k3_laid',   label:'K3 bullnose — laid' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const matchSurfaceTag = (treatmentType) => {
  const t = (treatmentType || '').toLowerCase();
  if (t.includes('hra 30') || t.includes('hra30')) return 'surf_hra3014_40_14';
  if (t.includes('hra 35') || t.includes('hra35')) return 'surf_hra3514_45_14';
  if (t.includes('hra 55') || t.includes('hra55')) return 'surf_hra5510_40';
  if (t.includes('sma 10') || t.includes('sma10')) return 'surf_sma10_40';
  if (t.includes('ac 14')  || t.includes('ac14'))  return 'surf_ac14_40';
  if (t.includes('ac 10')  || t.includes('ac10'))  return 'surf_ac10_40';
  if (t.includes('ac 6')   || t.includes('ac6'))   return 'surf_ac6_30';
  return 'surf_hra3014_40_14';
};

const snapMillingDepth = (depth) => {
  const d = +depth || 40;
  return MILLING_DEPTHS.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a);
};

const fmtGBP = (v) =>
  '£' + (+v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const fmtQty = (v, unit) => {
  const n = +v || 0;
  if (unit === 'No' || unit === 'Item') return n.toFixed(0);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
};

// ── Core calculation ──────────────────────────────────────────────────────────

function buildBoQLines(inputs) {
  const getItem = window.boqItem;
  const pickRate = window.boqPickRate;
  if (!getItem || !pickRate) return { groups: [], grandTotal: 0 };

  const lines = [];

  const push = (tag, qty, measurement) => {
    const item = getItem(tag);
    if (!item || !(qty > 0)) return;
    const meas = measurement !== undefined ? measurement : qty;
    const rate = pickRate(item, meas);
    const n = parseInt(item.id.split('/')[0]);
    let seriesKey, seriesTitle, seriesNum;
    if      (n ===  1)   { seriesKey='s100';  seriesTitle='Preliminaries';                seriesNum=100;  }
    else if (n ===  7)   { seriesKey='s700';  seriesTitle='Pavements';                   seriesNum=700;  }
    else if (n === 11)   { seriesKey='s1100'; seriesTitle='Footways & Paved Areas';      seriesNum=1100; }
    else if (n === 12)   { seriesKey='s1200'; seriesTitle='Traffic Signs & Road Markings'; seriesNum=1200; }
    else                 { seriesKey='s2700'; seriesTitle='Accommodation Works';         seriesNum=2700; }
    lines.push({ seriesKey, seriesTitle, seriesNum, id:item.id, desc:item.desc, qty, unit:item.unit, rate, total:qty*rate });
  };

  const cw   = +inputs.carriageway_area || 0;
  const fw   = +inputs.footway_area     || 0;
  const days = Math.max(1, +inputs.duration_days || 1);

  // Series 100: Traffic Management
  const tm = inputs.tm_type;
  if (tm === 'full_closure') {
    push('tm_closure_day', days, 1);
    if (inputs.include_diversion) {
      push('tm_diversion_erect',  1,    1);
      push('tm_diversion_day',    days, 1);
      push('tm_diversion_remove', 1,    1);
    }
  } else if (tm === 'portable_signals') {
    push('tm_pts_erect',  1,    1);
    push('tm_pts_day',    days, 1);
    push('tm_pts_remove', 1,    1);
  } else if (tm === 'stop_go') {
    push('tm_sg_erect',  1,    1);
    push('tm_sg_day',    days, 1);
    push('tm_sg_remove', 1,    1);
  } else if (tm === 'footway_works') {
    push('tm_fw_erect',  1,    1);
    push('tm_fw_day',    days, 1);
    push('tm_fw_remove', 1,    1);
  }

  // Series 700: Pavements (carriageway)
  if (cw > 0) {
    if (inputs.include_milling) {
      push(`mill_${snapMillingDepth(inputs.milling_depth)}`, cw, cw);
    }
    if (inputs.include_tack)   push('tack', cw, cw);
    if (inputs.include_base)   push(inputs.base_tag   || 'base_ac32d_100', cw, cw);
    if (inputs.include_subbase) {
      const vol = Math.round(cw * (+inputs.subbase_depth || 150) / 1000 * 10) / 10;
      push('subbase_t1', vol, vol);
    }
    if (inputs.include_binder) push(inputs.binder_tag || 'bin_hra5020_60', cw, cw);
    push(inputs.surface_tag || 'surf_hra3014_40_14', cw, cw);
  }

  // Series 1100: Kerbs
  const kl = +inputs.kerb_length || 0;
  if (kl > 0) push(inputs.kerb_type || 'kerb_k1_laid', kl, kl);

  // Series 1100: Footway surfacing
  if (fw > 0) {
    push(inputs.fw_surface_tag || 'fw_ac6_30', fw, fw);
    if (inputs.include_fw_subbase) push('fw_subbase_150', fw, fw);
  }

  // Series 1200: Road markings
  if (inputs.include_markings && +inputs.markings_area > 0)
    push('mark_area', +inputs.markings_area, +inputs.markings_area);
  if (inputs.include_line_marks && +inputs.line_marks_m > 0)
    push('mark_cont_100', +inputs.line_marks_m, +inputs.line_marks_m);

  // Series 2700: Ironwork
  if (+inputs.iw_sw_cway  > 0) push('iw_sw_cway',  +inputs.iw_sw_cway,  1);
  if (+inputs.iw_sse_cway > 0) push('iw_sse_cway', +inputs.iw_sse_cway, 1);
  if (+inputs.iw_bt_cway  > 0) push('iw_bt_cway',  +inputs.iw_bt_cway,  1);
  if (+inputs.iw_sw_fw    > 0) push('iw_sw_fw',    +inputs.iw_sw_fw,    1);
  if (+inputs.iw_sse_fw   > 0) push('iw_sse_fw',   +inputs.iw_sse_fw,   1);
  if (+inputs.iw_bt_fw    > 0) push('iw_bt_fw',    +inputs.iw_bt_fw,    1);

  // Group by series
  const SERIES_ORDER = ['s100','s700','s1100','s1200','s2700'];
  const grouped = {};
  for (const line of lines) {
    if (!grouped[line.seriesKey])
      grouped[line.seriesKey] = { title:line.seriesTitle, num:line.seriesNum, lines:[] };
    grouped[line.seriesKey].lines.push(line);
  }
  const orderedGroups = SERIES_ORDER
    .filter(k => grouped[k])
    .map(k => ({ key:k, ...grouped[k], subtotal: grouped[k].lines.reduce((s,l) => s+l.total, 0) }));

  const grandTotal = orderedGroups.reduce((s,g) => s+g.subtotal, 0);
  return { groups: orderedGroups, grandTotal };
}

// ── Excel export ──────────────────────────────────────────────────────────────

function exportBoQXlsx(scheme, inputs) {
  const { groups, grandTotal } = buildBoQLines(inputs);
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('XLSX library not loaded');

  // Style definitions
  const S = {
    hdr:    { fill:{fgColor:{rgb:'1F4E79'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:10}, alignment:{wrapText:false} },
    colHdr: { fill:{fgColor:{rgb:'D6E4F0'}}, font:{bold:true,sz:9}, alignment:{horizontal:'center'}, border:{bottom:{style:'medium',color:{rgb:'2E75B6'}}} },
    series: { fill:{fgColor:{rgb:'2E75B6'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:9} },
    item:   { font:{sz:9} },
    itemR:  { font:{sz:9}, alignment:{horizontal:'right'} },
    money:  { font:{sz:9}, alignment:{horizontal:'right'}, numFmt:'"£"#,##0.00' },
    altBg:  { fill:{fgColor:{rgb:'F2F7FB'}}, font:{sz:9} },
    altBgR: { fill:{fgColor:{rgb:'F2F7FB'}}, font:{sz:9}, alignment:{horizontal:'right'} },
    altMon: { fill:{fgColor:{rgb:'F2F7FB'}}, font:{sz:9}, alignment:{horizontal:'right'}, numFmt:'"£"#,##0.00' },
    sub:    { fill:{fgColor:{rgb:'DAE3F3'}}, font:{bold:true,sz:9}, alignment:{horizontal:'right'}, numFmt:'"£"#,##0.00' },
    subLbl: { fill:{fgColor:{rgb:'DAE3F3'}}, font:{bold:true,sz:9}, alignment:{horizontal:'right'} },
    grand:  { fill:{fgColor:{rgb:'1F4E79'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:10}, alignment:{horizontal:'right'}, numFmt:'"£"#,##0.00' },
    grandL: { fill:{fgColor:{rgb:'1F4E79'}}, font:{color:{rgb:'FFFFFF'},bold:true,sz:10}, alignment:{horizontal:'right'} },
    blank:  { fill:{fgColor:{rgb:'FFFFFF'}} },
  };

  const cell = (v, s) => ({ v, t: typeof v === 'number' ? 'n' : 's', s });
  const blank = () => cell('', S.blank);

  const rows = [];

  // Title block (4 info rows + spacer)
  const ext = scheme.scheme_extent ? ` — ${scheme.scheme_extent}` : '';
  rows.push([cell('BILL OF QUANTITIES', {...S.hdr,font:{...S.hdr.font,sz:13,bold:true}}), ...Array(5).fill(cell('',S.hdr))]);
  rows.push([cell(`${scheme.road_name||''}${ext}`, S.hdr), ...Array(5).fill(cell('',S.hdr))]);
  rows.push([cell(`Ref: ${scheme.project_number||''}`, S.hdr), cell('',S.hdr), cell(`Ward: ${scheme.ward_selected||''}`,S.hdr), cell('',S.hdr), cell(`Area: ${(+scheme.area_m2||0).toLocaleString()} m²`,S.hdr), cell('',S.hdr)]);
  rows.push([cell(`Start: ${scheme.date_start||''}`,S.hdr), cell('',S.hdr), cell(`Finish: ${scheme.date_finish||''}`,S.hdr), cell('',S.hdr), cell(`Duration: ${inputs.duration_days} working days`,S.hdr), cell('',S.hdr)]);
  rows.push(Array(6).fill(blank()));

  // Column headers
  rows.push([
    cell('Item No',      S.colHdr),
    cell('Description',  S.colHdr),
    cell('Qty',          S.colHdr),
    cell('Unit',         S.colHdr),
    cell('Rate (£)',     S.colHdr),
    cell('Total (£)',    S.colHdr),
  ]);

  for (const g of groups) {
    // Series header — span all 6 cols
    rows.push([cell(`Series ${g.num} — ${g.title}`, S.series), ...Array(5).fill(cell('',S.series))]);

    for (let i = 0; i < g.lines.length; i++) {
      const l = g.lines[i];
      const alt = i % 2 === 1;
      rows.push([
        cell(l.id,    alt ? S.altBg  : S.item),
        cell(l.desc,  alt ? S.altBg  : S.item),
        cell(l.qty,   alt ? S.altBgR : S.itemR),
        cell(l.unit,  alt ? S.altBg  : S.item),
        cell(l.rate,  alt ? S.altMon : S.money),
        cell(l.total, alt ? S.altMon : S.money),
      ]);
    }

    // Series subtotal
    rows.push([blank(), blank(), blank(), blank(),
      cell(`Series ${g.num} Total`, S.subLbl),
      cell(g.subtotal, S.sub),
    ]);
    rows.push(Array(6).fill(blank()));
  }

  // Grand total
  rows.push([blank(), blank(), blank(), blank(),
    cell('TOTAL (excl. VAT)', S.grandL),
    cell(grandTotal, S.grand),
  ]);

  // Build worksheet
  const ws = {};
  const numRows = rows.length;
  rows.forEach((row, r) => {
    row.forEach((c, col) => {
      ws[XLSX.utils.encode_cell({r, c:col})] = c;
    });
  });
  ws['!ref']  = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:numRows-1,c:5} });
  ws['!cols'] = [{wch:12},{wch:62},{wch:10},{wch:8},{wch:16},{wch:16}];
  ws['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:5}},
    {s:{r:1,c:0},e:{r:1,c:5}},
  ];

  // Summary sheet
  const sumRows = [
    [cell('Series',S.colHdr), cell('Title',S.colHdr), cell('Total (£)',S.colHdr)],
    ...groups.map(g => [cell(`Series ${g.num}`,S.item), cell(g.title,S.item), cell(g.subtotal,S.money)]),
    [blank(), cell('TOTAL',S.subLbl), cell(grandTotal,S.grand)],
  ];
  const ws2 = {};
  sumRows.forEach((row, r) => {
    row.forEach((c, col) => { ws2[XLSX.utils.encode_cell({r,c:col})] = c; });
  });
  ws2['!ref']  = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:sumRows.length-1,c:2}});
  ws2['!cols'] = [{wch:12},{wch:42},{wch:16}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,  'Bill of Quantities');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const filename = `${scheme.project_number||'BoQ'}_${(scheme.road_name||'').replace(/[\s/\\:*?"<>|]+/g,'_')}_BoQ.xlsx`;
  XLSX.writeFile(wb, filename);

  window.dispatchEvent(new CustomEvent('rmp-download', {
    detail: { label:`BoQ — ${scheme.road_name}`, ref:scheme.project_number }
  }));
}

// ── Shared sub-components (defined outside BoQTab to prevent remount) ─────────

const BQSectionLabel = ({ n, label }) => (
  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--ink-3)',padding:'14px 0 6px',borderTop:'1px solid var(--line)',marginTop:12}}>
    <span className="section-num" style={{fontSize:9,marginRight:6,verticalAlign:'middle'}}>{n}</span>{label}
  </div>
);

const BQField = ({ label, children }) => (
  <div style={{marginBottom:9}}>
    <div style={{fontSize:11,fontWeight:500,color:'var(--ink-2)',marginBottom:3}}>{label}</div>
    {children}
  </div>
);

const BQToggle = ({ value, onChange, label }) => (
  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',userSelect:'none',color:'var(--ink-2)',marginBottom:7}}>
    <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)}
      style={{accentColor:'var(--accent)',width:14,height:14,flexShrink:0}} />
    {label}
  </label>
);

const BQNum = ({ value, onChange, label, unit, min=0, step=1 }) => (
  <BQField label={label}>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <input type="number" className="mono" min={min} step={step} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{width:84,fontSize:12}} />
      {unit && <span style={{fontSize:11,color:'var(--ink-3)'}}>{unit}</span>}
    </div>
  </BQField>
);

const BQSelect = ({ value, onChange, label, options }) => (
  <BQField label={label}>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:'100%',fontSize:12}}>
      {options.map(o => <option key={o.tag||o.value} value={o.tag||o.value}>{o.label}</option>)}
    </select>
  </BQField>
);

// ── BoQTab component ──────────────────────────────────────────────────────────

const BoQTab = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);

  const initInputs = React.useMemo(() => {
    const area = +scheme.area_m2 || 0;
    let dur = +scheme.duration_days || 5;
    if (scheme.date_start && scheme.date_finish) {
      const p = s => { const [d,m,y]=(s||'').split('/'); return new Date(+y,+m-1,+d); };
      const a = p(scheme.date_start), b = p(scheme.date_finish);
      if (!isNaN(a) && !isNaN(b)) dur = Math.max(1, Math.round((b-a)/86400000*5/7));
    }
    return {
      carriageway_area:   area,
      footway_area:       0,
      surface_tag:        matchSurfaceTag(scheme.treatment_type),
      binder_tag:         'bin_hra5020_60',
      include_binder:     !!(+scheme.binder_depth_mm > 0),
      base_tag:           'base_ac32d_100',
      include_base:       false,
      subbase_depth:      150,
      include_subbase:    false,
      milling_depth:      snapMillingDepth(+scheme.surface_depth_mm || 40),
      include_milling:    true,
      include_tack:       true,
      tm_type:            scheme.tm_type || 'full_closure',
      duration_days:      dur,
      include_diversion:  false,
      kerb_length:        +scheme.kerb_length || 0,
      kerb_type:          'kerb_k1_laid',
      fw_surface_tag:     'fw_ac6_30',
      include_fw_subbase: false,
      include_markings:   false,
      markings_area:      0,
      include_line_marks: false,
      line_marks_m:       0,
      iw_sw_cway:         +scheme.iron_mh || 0,
      iw_sse_cway:        0,
      iw_bt_cway:         0,
      iw_sw_fw:           0,
      iw_sse_fw:          0,
      iw_bt_fw:           0,
    };
  }, [schemeId]);

  const [inputs, setInputs] = React.useState(initInputs);
  const set = (k, v) => setInputs(prev => ({ ...prev, [k]: v }));

  const { groups, grandTotal } = React.useMemo(() => buildBoQLines(inputs), [inputs]);
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      exportBoQXlsx(scheme, inputs);
      updateScheme(schemeId, { docs_generated: { ...(scheme.docs_generated||{}), boq:true } });
    } catch(e) {
      alert('Download failed: ' + e.message);
    } finally { setDownloading(false); }
  };

  React.useEffect(() => {
    window.__downloadBoQ = () => exportBoQXlsx(scheme, inputs);
    return () => { window.__downloadBoQ = null; };
  }, [scheme, inputs]);

  const bandLabel = React.useMemo(() => {
    const a = +inputs.carriageway_area || 0;
    if (a < 500)  return 'Band A (<500 m²)';
    if (a < 5000) return 'Band B (500–5000 m²)';
    return 'Band C (>5000 m²)';
  }, [inputs.carriageway_area]);

  return (
    <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:20,alignItems:'start'}}>

      {/* ── Left: input panel ── */}
      <div style={{background:'var(--bg-elev)',border:'1px solid var(--line)',borderRadius:'var(--radius)',padding:'0 16px 20px',overflowY:'auto',maxHeight:'calc(100vh - 210px)'}}>

        {/* 01 Carriageway treatment */}
        <BQSectionLabel n="01" label="Carriageway Treatment" />
        <BQNum value={inputs.carriageway_area} onChange={v=>set('carriageway_area',v)} label="Area (m²)" unit="m²" />
        {+inputs.carriageway_area > 0 && (
          <div style={{fontSize:10,color:'var(--accent)',fontFamily:'var(--font-mono)',marginBottom:8,marginTop:-4}}>{bandLabel}</div>
        )}
        <BQSelect value={inputs.surface_tag} onChange={v=>set('surface_tag',v)} label="Surface course" options={SURFACE_OPTIONS} />
        <BQToggle value={inputs.include_milling} onChange={v=>set('include_milling',v)} label="Include milling" />
        {inputs.include_milling && (
          <BQField label="Milling depth (mm)">
            <select value={snapMillingDepth(inputs.milling_depth)} onChange={e=>set('milling_depth',+e.target.value)}
              style={{width:'100%',fontSize:12}}>
              {MILLING_DEPTHS.map(d=><option key={d} value={d}>{d}mm</option>)}
            </select>
          </BQField>
        )}
        <BQToggle value={inputs.include_tack} onChange={v=>set('include_tack',v)} label="Include tack coat" />

        {/* 02 Layer build-up */}
        <BQSectionLabel n="02" label="Layer Build-Up" />
        <BQToggle value={inputs.include_binder} onChange={v=>set('include_binder',v)} label="Binder course" />
        {inputs.include_binder && (
          <BQSelect value={inputs.binder_tag} onChange={v=>set('binder_tag',v)} label="Binder type" options={BINDER_OPTIONS} />
        )}
        <BQToggle value={inputs.include_base} onChange={v=>set('include_base',v)} label="Base course" />
        {inputs.include_base && (
          <BQSelect value={inputs.base_tag} onChange={v=>set('base_tag',v)} label="Base type" options={BASE_OPTIONS} />
        )}
        <BQToggle value={inputs.include_subbase} onChange={v=>set('include_subbase',v)} label="Granular sub-base (Type 1)" />
        {inputs.include_subbase && (
          <BQNum value={inputs.subbase_depth} onChange={v=>set('subbase_depth',v)} label="Sub-base depth (mm)" unit="mm" />
        )}

        {/* 03 Traffic Management */}
        <BQSectionLabel n="03" label="Traffic Management" />
        <BQField label="TM type">
          <select value={inputs.tm_type} onChange={e=>set('tm_type',e.target.value)} style={{width:'100%',fontSize:12}}>
            <option value="full_closure">Full road closure (Type 1)</option>
            <option value="portable_signals">Portable traffic signals</option>
            <option value="stop_go">Stop/Go boards</option>
            <option value="footway_works">Works on footways only</option>
            <option value="none">None</option>
          </select>
        </BQField>
        <BQNum value={inputs.duration_days} onChange={v=>set('duration_days',v)} label="Duration (working days)" unit="days" min={1} />
        {inputs.tm_type === 'full_closure' && (
          <BQToggle value={inputs.include_diversion} onChange={v=>set('include_diversion',v)} label="Include diversion route (erect + maintain + remove)" />
        )}

        {/* 04 Ironwork */}
        <BQSectionLabel n="04" label="Ironwork (Accommodation Works)" />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 10px'}}>
          <BQNum value={inputs.iw_sw_cway}  onChange={v=>set('iw_sw_cway',v)}  label="SW covers — C'way" unit="No" />
          <BQNum value={inputs.iw_sw_fw}    onChange={v=>set('iw_sw_fw',v)}    label="SW covers — F'way" unit="No" />
          <BQNum value={inputs.iw_sse_cway} onChange={v=>set('iw_sse_cway',v)} label="SSE covers — C'way" unit="No" />
          <BQNum value={inputs.iw_sse_fw}   onChange={v=>set('iw_sse_fw',v)}   label="SSE covers — F'way" unit="No" />
          <BQNum value={inputs.iw_bt_cway}  onChange={v=>set('iw_bt_cway',v)}  label="BT covers — C'way" unit="No" />
          <BQNum value={inputs.iw_bt_fw}    onChange={v=>set('iw_bt_fw',v)}    label="BT covers — F'way" unit="No" />
        </div>

        {/* 05 Footways & Kerbs */}
        <BQSectionLabel n="05" label="Footways & Kerbs" />
        <BQNum value={inputs.footway_area} onChange={v=>set('footway_area',v)} label="Footway area (m²)" unit="m²" />
        {+inputs.footway_area > 0 && (
          <>
            <BQSelect value={inputs.fw_surface_tag} onChange={v=>set('fw_surface_tag',v)} label="Footway surface" options={FOOTWAY_SURFACE_OPTIONS} />
            <BQToggle value={inputs.include_fw_subbase} onChange={v=>set('include_fw_subbase',v)} label="Include footway sub-base (150mm)" />
          </>
        )}
        <BQNum value={inputs.kerb_length} onChange={v=>set('kerb_length',v)} label="Kerb length (m)" unit="m" />
        {+inputs.kerb_length > 0 && (
          <BQSelect value={inputs.kerb_type} onChange={v=>set('kerb_type',v)} label="Kerb type" options={KERB_OPTIONS} />
        )}

        {/* 06 Road markings */}
        <BQSectionLabel n="06" label="Road Markings" />
        <BQToggle value={inputs.include_markings} onChange={v=>set('include_markings',v)} label="Solid area markings (m²)" />
        {inputs.include_markings && (
          <BQNum value={inputs.markings_area} onChange={v=>set('markings_area',v)} label="Markings area (m²)" unit="m²" />
        )}
        <BQToggle value={inputs.include_line_marks} onChange={v=>set('include_line_marks',v)} label="Line markings 100mm (m)" />
        {inputs.include_line_marks && (
          <BQNum value={inputs.line_marks_m} onChange={v=>set('line_marks_m',v)} label="Total line length (m)" unit="m" />
        )}
      </div>

      {/* ── Right: BoQ table ── */}
      <div style={{minWidth:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={{fontWeight:600,fontSize:14}}>Bill of Quantities</div>
            <div style={{fontSize:11,color:'var(--ink-3)',fontFamily:'var(--font-mono)'}}>{scheme.project_number} · {scheme.road_name}</div>
          </div>
          <button className="btn sm" onClick={handleDownload} disabled={downloading || groups.length===0}>
            <Icon.Download /> {downloading ? 'Generating…' : 'Download .xlsx'}
          </button>
        </div>

        {groups.length === 0 ? (
          <div style={{padding:'48px 20px',textAlign:'center',color:'var(--ink-3)',fontSize:13,border:'1px dashed var(--line)',borderRadius:'var(--radius)'}}>
            Enter an area and configure the treatment on the left to generate the BoQ.
          </div>
        ) : (
          <div style={{border:'1px solid var(--line)',borderRadius:'var(--radius)',overflow:'hidden',fontSize:12}}>
            {/* Column header */}
            <div style={{display:'grid',gridTemplateColumns:'82px 1fr 58px 46px 78px 90px',padding:'6px 10px',background:'var(--bg-sunken)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--ink-3)',borderBottom:'2px solid var(--line)'}}>
              <div>Item No</div>
              <div>Description</div>
              <div style={{textAlign:'right'}}>Qty</div>
              <div>Unit</div>
              <div style={{textAlign:'right'}}>Rate</div>
              <div style={{textAlign:'right'}}>Total</div>
            </div>

            {groups.map(g => (
              <div key={g.key}>
                {/* Series header */}
                <div style={{display:'grid',gridTemplateColumns:'82px 1fr 58px 46px 78px 90px',padding:'5px 10px',background:'var(--accent)',color:'white',fontWeight:600,fontSize:11}}>
                  <div style={{gridColumn:'1/7'}}>Series {g.num} — {g.title}</div>
                </div>

                {/* Item rows */}
                {g.lines.map((line, li) => (
                  <div key={li} style={{display:'grid',gridTemplateColumns:'82px 1fr 58px 46px 78px 90px',padding:'5px 10px',borderBottom:'1px solid var(--line)',background:li%2===1?'var(--bg-sunken)':'var(--bg)',alignItems:'start'}}>
                    <div className="mono" style={{fontSize:10,color:'var(--ink-3)',paddingTop:1}}>{line.id}</div>
                    <div style={{paddingRight:8,lineHeight:1.35,fontSize:11}}>{line.desc}</div>
                    <div className="mono" style={{textAlign:'right',fontSize:11}}>{fmtQty(line.qty, line.unit)}</div>
                    <div style={{fontSize:11,color:'var(--ink-3)'}}>{line.unit}</div>
                    <div className="mono" style={{textAlign:'right',fontSize:11}}>{fmtGBP(line.rate)}</div>
                    <div className="mono" style={{textAlign:'right',fontSize:11,fontWeight:500}}>{fmtGBP(line.total)}</div>
                  </div>
                ))}

                {/* Subtotal */}
                <div style={{display:'grid',gridTemplateColumns:'82px 1fr 58px 46px 78px 90px',padding:'5px 10px',background:'var(--accent-wash)',borderBottom:'1px solid var(--line)'}}>
                  <div style={{gridColumn:'1/6',textAlign:'right',fontWeight:600,fontSize:11,color:'var(--accent-ink)',paddingRight:8}}>
                    Series {g.num} Total
                  </div>
                  <div className="mono" style={{textAlign:'right',fontWeight:700,fontSize:11}}>{fmtGBP(g.subtotal)}</div>
                </div>
              </div>
            ))}

            {/* Grand total */}
            <div style={{display:'grid',gridTemplateColumns:'82px 1fr 58px 46px 78px 90px',padding:'8px 10px',background:'var(--accent)',color:'white'}}>
              <div style={{gridColumn:'1/6',textAlign:'right',fontWeight:700,fontSize:12,paddingRight:8}}>
                TOTAL (excl. VAT)
              </div>
              <div className="mono" style={{textAlign:'right',fontWeight:700,fontSize:12}}>{fmtGBP(grandTotal)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.BoQTab = BoQTab;
