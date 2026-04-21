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
    const rows = [], meta = [], namedRanges = [];

    rows.push([`${scheme.project_number} · ${scheme.road_name} — Master Workbook`, "", ""]);
    meta.push({ type: "title" });
    rows.push(["Named Range", "Label", "Value"]);
    meta.push({ type: "header" });

    for (const section of window.WORKBOOK_SCHEMA) {
      rows.push([section.section, "", ""]);
      meta.push({ type: "section" });
      for (const f of section.fields) {
        if (f.type === "subheader") {
          rows.push([f.label, "", ""]); meta.push({ type: "subheader" }); continue;
        }
        if (f.type === "zone-label") {
          rows.push([f.label, f.sublabel || "", ""]); meta.push({ type: "zone-label" }); continue;
        }
        const value = f.type === "calc" ? f.formula(scheme) : (scheme[f.key] ?? "");
        const rowNum = rows.length + 1;
        rows.push([f.key, f.label, value == null ? "" : value]);
        meta.push({ type: f.type === "calc" ? "calc" : "data", fieldType: f.type });
        namedRanges.push({ Name: f.key, Ref: `'${sheetName}'!$C$${rowNum}` });
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

    const cellBorder = {
      top:    { style: "thin", color: { rgb: "E8EAED" } },
      bottom: { style: "thin", color: { rgb: "E8EAED" } },
      left:   { style: "thin", color: { rgb: "E8EAED" } },
      right:  { style: "thin", color: { rgb: "E8EAED" } },
    };

    const wsRows = [];

    rows.forEach((_, r) => {
      const { type, fieldType } = meta[r];
      const isTextarea = fieldType === "textarea";

      let hpt, cellStyles;

      if (type === "title") {
        hpt = 34;
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"1A1D23"}}, font:{bold:true,sz:14,color:{rgb:"E4E6EA"}}, alignment:{vertical:"center"} },
          { fill:{patternType:"solid",fgColor:{rgb:"1A1D23"}}, font:{sz:14,color:{rgb:"1A1D23"}} },
          { fill:{patternType:"solid",fgColor:{rgb:"1A1D23"}}, font:{sz:14,color:{rgb:"1A1D23"}} },
        ];
      } else if (type === "header") {
        hpt = 22;
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"252930"}}, font:{bold:true,sz:9,color:{rgb:"6B7280"}}, alignment:{horizontal:"left",vertical:"center"} },
          { fill:{patternType:"solid",fgColor:{rgb:"252930"}}, font:{bold:true,sz:9,color:{rgb:"6B7280"}}, alignment:{horizontal:"left",vertical:"center"} },
          { fill:{patternType:"solid",fgColor:{rgb:"252930"}}, font:{bold:true,sz:9,color:{rgb:"6B7280"}}, alignment:{horizontal:"left",vertical:"center"} },
        ];
      } else if (type === "section") {
        hpt = 20;
        const secBorder = { ...cellBorder, left:{ style:"medium", color:{ rgb:"D97706" } } };
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"FAFAFA"}}, font:{bold:true,sz:11,color:{rgb:"1A1D23"}}, border: secBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"FAFAFA"}}, font:{sz:11,color:{rgb:"FAFAFA"}},           border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"FAFAFA"}}, font:{sz:11,color:{rgb:"FAFAFA"}},           border: cellBorder },
        ];
      } else if (type === "subheader") {
        hpt = 18;
        const subBorder = { ...cellBorder, left:{ style:"medium", color:{ rgb:"3B82F6" } } };
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"EFF6FF"}}, font:{bold:true,sz:10,color:{rgb:"1E40AF"}}, border: subBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"EFF6FF"}}, font:{sz:10,color:{rgb:"EFF6FF"}},            border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"EFF6FF"}}, font:{sz:10,color:{rgb:"EFF6FF"}},            border: cellBorder },
        ];
      } else if (type === "zone-label") {
        hpt = 16;
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"FFF7ED"}}, font:{bold:true,sz:10,color:{rgb:"C2410C"}}, border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"FFF7ED"}}, font:{sz:10,color:{rgb:"92400E"},italic:true}, border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"FFF7ED"}}, font:{sz:10,color:{rgb:"FFF7ED"}},             border: cellBorder },
        ];
      } else if (type === "calc") {
        hpt = 17;
        cellStyles = [
          { fill:{patternType:"solid",fgColor:{rgb:"F0FDF4"}}, font:{sz:11,color:{rgb:"9CA3AF"},italic:true}, border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"F0FDF4"}}, font:{sz:11,color:{rgb:"374151"}},             border: cellBorder },
          { fill:{patternType:"solid",fgColor:{rgb:"F0FDF4"}}, font:{bold:true,sz:11,color:{rgb:"15803D"}},   border: cellBorder, alignment:{horizontal:"right"} },
        ];
      } else {
        hpt = isTextarea ? 65 : 17;
        const valAlign = isTextarea
          ? { wrapText:true, vertical:"top" }
          : { vertical:"center" };
        cellStyles = [
          { font:{sz:11,color:{rgb:"9CA3AF"}},             border: cellBorder, alignment:{vertical:"center"} },
          { font:{sz:11,color:{rgb:"374151"}},             border: cellBorder, alignment:{vertical:"center"} },
          { font:{sz:11,color:{rgb:"111111"}},             border: cellBorder, alignment: valAlign },
        ];
      }

      wsRows.push({ hpt });
      for (let c = 0; c < 3; c++) {
        const addr = enc(r, c);
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = cellStyles[c];
      }
    });

    ws["!cols"]      = [{ wch: 26 }, { wch: 38 }, { wch: 62 }];
    ws["!merges"]    = [{ s:{r:0,c:0}, e:{r:0,c:2} }];
    ws["!rows"]      = wsRows;
    ws["!tabColor"]  = { rgb: "D97706" };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    wb.Workbook = { Names: namedRanges };

    const filename = `${scheme.project_number}_${(scheme.road_name||"").replace(/\s+/g,"_")}_Master.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  React.useEffect(() => {
    window.__workbookExport = exportXlsx;
    return () => { if (window.__workbookExport === exportXlsx) delete window.__workbookExport; };
  });

  const renderField = (f) => {
    const computed = f.type === "calc" ? f.formula(scheme) : scheme[f.key];
    const value = computed ?? "";
    if (f.type === "subheader") return (
      <div className="mwb-row mwb-subheader" key={f.key}>
        <div className="mwb-subheader-label">{f.label}</div>
      </div>
    );
    if (f.type === "zone-label") return (
      <div className="mwb-row mwb-zone-label" key={f.key}>
        <div className="mwb-zone-badge">{f.label}</div>
        <div className="mwb-zone-label-text">{f.sublabel}</div>
      </div>
    );
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
    if (f.type === "link") {
      const postcode = encodeURIComponent(scheme.postcode||'');
      const href = `https://gridreferencefinder.com/?postcode=${postcode}`;
      return (
        <div className="mwb-row" key={f.key}>
          <div className="mwb-key mono">{f.key}</div><div className="mwb-label">{f.label}</div>
          <div className="mwb-val">
            <a href={href} target="_blank" rel="noreferrer" style={{color:"var(--accent)",fontSize:12,textDecoration:"none"}}>
              ↗ {scheme.postcode ? `Look up ${scheme.postcode}` : "Enter a postcode above first"}
            </a>
          </div>
        </div>
      );
    }
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
