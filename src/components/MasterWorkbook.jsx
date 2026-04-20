// ─── MasterWorkbook.jsx ──────────────────────────────────────────────────────
// Editable spreadsheet-style view of a scheme's Master Workbook.
// Renders all 9 sections of WORKBOOK_SCHEMA (49 named ranges) as a live form.
// Every edit calls updateScheme() so changes propagate to all downstream docs
// (RSR, PCI/CPP, Resident Letter) without any copy-paste.
//
// Props:
//   schemeId (string) — the scheme to display and edit
//
// Exports (via window): MasterWorkbook
// Depends on: React, window.SchemeContext, window.WORKBOOK_SCHEMA,
//             window.WARDS, window.Icon
// ─────────────────────────────────────────────────────────────────────────────

const MasterWorkbook = ({ schemeId }) => {
  const { getScheme, updateScheme } = React.useContext(window.SchemeContext);
  const scheme = getScheme(schemeId);
  const update = (key, val) => updateScheme(schemeId, { [key]: val });

  const exportXlsx = () => {
    const XLSX = window.XLSX;
    const sheetName = "Project Info";
    const rows  = [];
    const meta  = []; // row type: 'title' | 'header' | 'section' | 'calc' | 'data'
    const namedRanges = [];

    rows.push([`${scheme.project_number} · ${scheme.road_name} — Master Workbook`, "", ""]); meta.push("title");
    rows.push(["Named Range", "Label", "Value"]); meta.push("header");

    for (const section of window.WORKBOOK_SCHEMA) {
      rows.push([section.section, "", ""]); meta.push("section");
      for (const f of section.fields) {
        const value = f.type === "calc" ? f.formula(scheme) : (scheme[f.key] ?? "");
        const rowNum = rows.length + 1;
        rows.push([f.key, f.label, value == null ? "" : value]);
        meta.push(f.type === "calc" ? "calc" : "data");
        namedRanges.push({ Name: f.key, Ref: `'${sheetName}'!$C$${rowNum}` });
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

    const S = {
      title:   [
        { fill: { patternType:"solid", fgColor:{rgb:"1A1D23"} }, font:{bold:true,  sz:13, color:{rgb:"E4E6EA"}}, alignment:{vertical:"center"} },
        { fill: { patternType:"solid", fgColor:{rgb:"1A1D23"} }, font:{sz:13, color:{rgb:"1A1D23"}} },
        { fill: { patternType:"solid", fgColor:{rgb:"1A1D23"} }, font:{sz:13, color:{rgb:"1A1D23"}} },
      ],
      header:  [
        { fill: { patternType:"solid", fgColor:{rgb:"F2F2F2"} }, font:{bold:true, sz:10, color:{rgb:"555555"}}, border:{bottom:{style:"medium",color:{rgb:"BBBBBB"}}}, alignment:{horizontal:"left"} },
        { fill: { patternType:"solid", fgColor:{rgb:"F2F2F2"} }, font:{bold:true, sz:10, color:{rgb:"555555"}}, border:{bottom:{style:"medium",color:{rgb:"BBBBBB"}}}, alignment:{horizontal:"left"} },
        { fill: { patternType:"solid", fgColor:{rgb:"F2F2F2"} }, font:{bold:true, sz:10, color:{rgb:"555555"}}, border:{bottom:{style:"medium",color:{rgb:"BBBBBB"}}}, alignment:{horizontal:"left"} },
      ],
      section: [
        { fill: { patternType:"solid", fgColor:{rgb:"E4E8ED"} }, font:{bold:true, sz:11, color:{rgb:"1A1D23"}}, border:{top:{style:"thin",color:{rgb:"C0C5CC"}}} },
        { fill: { patternType:"solid", fgColor:{rgb:"E4E8ED"} }, font:{sz:11, color:{rgb:"E4E8ED"}},            border:{top:{style:"thin",color:{rgb:"C0C5CC"}}} },
        { fill: { patternType:"solid", fgColor:{rgb:"E4E8ED"} }, font:{sz:11, color:{rgb:"E4E8ED"}},            border:{top:{style:"thin",color:{rgb:"C0C5CC"}}} },
      ],
      calc:    [
        { fill: { patternType:"solid", fgColor:{rgb:"F0FDF4"} }, font:{sz:11, color:{rgb:"9CA3AF"}, italic:true} },
        { fill: { patternType:"solid", fgColor:{rgb:"F0FDF4"} }, font:{sz:11, color:{rgb:"444444"}} },
        { fill: { patternType:"solid", fgColor:{rgb:"F0FDF4"} }, font:{bold:true, sz:11, color:{rgb:"15803D"}} },
      ],
      data:    [
        { font:{sz:11, color:{rgb:"999999"}} },
        { font:{sz:11, color:{rgb:"333333"}} },
        { font:{sz:11, color:{rgb:"111111"}} },
      ],
    };

    const heights = { title:28, header:18, section:18, calc:15, data:15 };
    const wsRows = [];

    rows.forEach((_, r) => {
      const type = meta[r];
      wsRows.push({ hpt: heights[type] || 15 });
      for (let c = 0; c < 3; c++) {
        const addr = enc(r, c);
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = S[type]?.[c] || {};
      }
    });

    ws["!cols"]   = [{ wch: 28 }, { wch: 40 }, { wch: 55 }];
    ws["!merges"] = [{ s:{r:0,c:0}, e:{r:0,c:2} }];
    ws["!rows"]   = wsRows;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    wb.Workbook = { Names: namedRanges };

    const filename = `${scheme.project_number}_${(scheme.road_name||"").replace(/\s+/g,"_")}_Master.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const renderField = (f) => {
    const computed = f.type === "calc" ? f.formula(scheme) : scheme[f.key];
    const value = computed ?? "";
    if (f.type === "calc") return (
      <div className="mwb-row calc" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val calc-val"><span className={f.mono?"mono":""}>{value}</span><span className="calc-badge">calc</span></div>
      </div>
    );
    if (f.type === "ward") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><select value={scheme.ward_num} onChange={e => { const num=+e.target.value; const w=window.WARDS.find(x=>x.num===num); updateScheme(schemeId,{ward_num:num,ward_selected:w.name}); }}>
          {window.WARDS.map(w => <option key={w.num} value={w.num}>W{w.num} {w.name}</option>)}
        </select></div>
      </div>
    );
    if (f.type === "select") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><select value={value} onChange={e=>update(f.key,e.target.value)}>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
      </div>
    );
    if (f.type === "link") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><span style={{color:"var(--accent)",fontSize:12}}>🔗 {value||"Click to open DCC lookup"}</span></div>
      </div>
    );
    if (f.type === "textarea") return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><textarea value={value} rows={Math.min(8,Math.max(2,String(value).split("\n").length+1))} onChange={e=>update(f.key,e.target.value)} style={{width:"100%",fontFamily:"inherit",fontSize:12,padding:"6px 8px",border:"1px solid var(--line)",borderRadius:3,background:"var(--bg)",color:"var(--ink)",resize:"vertical",lineHeight:1.45}} /></div>
      </div>
    );
    return (
      <div className="mwb-row" key={f.key}>
        <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
        <div className="mwb-val"><input type={f.type==="email"?"email":f.type==="number"?"number":"text"} className={f.mono?"mono":""} value={value} onChange={e=>update(f.key,f.type==="number"?(e.target.value===""?"":+e.target.value):e.target.value)} /></div>
      </div>
    );
  };

  return (
    <div className="master-workbook">
      <div className="mwb-head">
        <div>
          <div style={{fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:22,height:22,background:"#1D6F42",color:"white",display:"grid",placeItems:"center",borderRadius:3,fontFamily:"var(--font-mono)",fontWeight:700,fontSize:11}}>X</span>
            Master Workbook · Project Info tab
          </div>
          <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)",marginTop:4}}>
            {scheme.project_number}_{(scheme.road_name||"").replace(/\s+/g,"_")}_Master.xlsx · 49 named ranges
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--green)",fontFamily:"var(--font-mono)"}}>● synced · all docs will refresh</span>
          <button className="btn sm" onClick={exportXlsx}><Icon.Download /> Export .xlsx</button>
        </div>
      </div>
      <div className="mwb-legend">
        <span><span className="swatch input" /> Input cell</span>
        <span><span className="swatch calc" /> Calculated</span>
        <span><span className="swatch link" /> Linked to downstream docs</span>
      </div>
      {window.WORKBOOK_SCHEMA.map(section => (
        <div className="mwb-section" key={section.section}>
          <div className="mwb-section-head">
            <span className="mwb-section-num">{section.section.split(".")[0]}</span>
            <span>{section.section.split(". ")[1]}</span>
            <span style={{marginLeft:"auto",fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{section.fields.length} fields</span>
          </div>
          <div className="mwb-grid">
            <div className="mwb-row header"><div className="mwb-key mono">named range</div><div className="mwb-label">label</div><div className="mwb-val">value</div></div>
            {section.fields.map(renderField)}
          </div>
        </div>
      ))}
      <div className="mwb-foot">
        <div style={{fontSize:12,color:"var(--ink-2)"}}><strong>How it works:</strong> Every value here is a named range in the master workbook. Downstream Word templates use Content Controls linked to these ranges — when you change a value here, regenerating the pack updates every document. No copy-paste.</div>
      </div>
    </div>
  );
};

window.MasterWorkbook = MasterWorkbook;
