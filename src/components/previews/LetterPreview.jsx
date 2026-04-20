// ─── LetterPreview.jsx ────────────────────────────────────────────────────────
// Resident / business letter preview.
// Renders a Word template via docx-preview then walks the rendered DOM to
// replace <<TAG>> and «TAG» placeholders with values derived from the scheme.
// Each scheme has its own recipients list; selecting one re-renders the letter
// for that address. The download button triggers a mail-merge for all.
//
// Template file: templates/Residential_Letter_Template (1) (2).docx
//   ↑ replace this file with the correct letter .docx if it currently holds
//     the RSR form — see README for template file map.
//
// Components:
//   LetterDoc    — renders one letter for a given recipient
//   LetterModal  — full-screen preview with recipient selector + binding list
//
// Exports (via window): LetterDoc, LetterModal
// Depends on: React, window.Icon, window.WARDS, window.docx (docx-preview CDN)
// ─────────────────────────────────────────────────────────────────────────────

const LETTER_BINDINGS = [
  { tag: "<<Our_Ref>>", derive: s => s.project_number || "" },
  { tag: "<<Letter_Date>>", derive: s => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) },
  { tag: "<<Letter_Subject>>", derive: s => {
    const road = s.road_name||""; const ext = s.scheme_extent?` (${s.scheme_extent})`:""; return `RESURFACING WORKS \u2014 ${road.toUpperCase()}${ext.toUpperCase()}`;
  }},
  { tag: "<<Letter_Body_Text>>", derive: s => {
    const start=s.date_start||"[start date]", finish=s.date_finish||"[finish date]", road=s.road_name||"[road]",
      ext=s.scheme_extent?` between ${s.scheme_extent}`:"", tm=s.tm_type?s.tm_type.toLowerCase():"temporary traffic management", tmH=s.tm_hours||"07:30 to 15:30";
    return `Dundee City Council will shortly be carrying out resurfacing works on ${road}${ext}. The works are programmed to commence on ${start} and are expected to be completed by ${finish}.\n\nTo enable the works to be carried out safely, ${tm.charAt(0).toUpperCase()+tm.slice(1)} will be in place during working hours (${tmH}). Pedestrian access to properties will be maintained at all times.\n\nWe apologise in advance for any inconvenience caused.`;
  }},
  { tag: "<<Ward_Councillor_1>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[0]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_2>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[1]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
  { tag: "<<Ward_Councillor_3>>", derive: s => { const w=window.WARDS.find(x=>x.num===s.ward_num); if(!w)return""; const c=w.councillors[2]; return c?`${c.title} ${c.name} (Ward ${w.num} ${w.name})`:"";}},
];

let _letterBuffer = null;
const loadLetterBuffer = async () => {
  if (_letterBuffer) return _letterBuffer;
  // Template lives at repo root — URL-encode the spaces in the filename
  const res = await fetch("templates/Residential_Letter_Template%20(1)%20(2).docx");
  _letterBuffer = await res.arrayBuffer(); return _letterBuffer;
};

const applyLetter = (root, scheme, recipient) => {
  const recipientBindings = { AddressLine4: recipient?.address1||"", POSTCODE: recipient?.postcode||"", TOWN_NAME: recipient?.town||"DUNDEE" };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = []; let n;
  while ((n=walker.nextNode())) { if (/<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»/.test(n.nodeValue)) nodes.push(n); }
  const byTag = {}; LETTER_BINDINGS.forEach(b => { byTag[b.tag] = b; });
  nodes.forEach(node => {
    const parts = node.nodeValue.split(/(<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»)/);
    const frag = document.createDocumentFragment();
    parts.forEach(p => {
      if (!p) return;
      const mA=/^<<([A-Za-z0-9_]+)>>$/.exec(p), mG=/^«([A-Za-z0-9_]+)»$/.exec(p), m=mA||mG;
      if (m) {
        const name=m[1]; let val,filled;
        if (mG&&recipientBindings.hasOwnProperty(name)) { val=recipientBindings[name]; filled=val!==" "&&val!==undefined; }
        else { const b=byTag[mA?p:`<<${name}>>`]; val=b?b.derive(scheme):""; filled=val!==undefined&&val!=""; }
        const span=document.createElement("span"); span.className="pci-bound"+(filled?"":" pci-missing"); span.dataset.key=name;
        String(filled?val:p).split("\n").forEach((line,i)=>{ if(i>0){span.appendChild(document.createElement("br"));span.appendChild(document.createElement("br"));} span.appendChild(document.createTextNode(line)); });
        frag.appendChild(span);
      } else frag.appendChild(document.createTextNode(p));
    });
    node.parentNode.replaceChild(frag, node);
  });
};

const LetterDoc = ({ scheme, recipient }) => {
  const ref = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  React.useEffect(() => {
    let cancelled=false;
    (async()=>{
      try {
        const buf=await loadLetterBuffer();
        if(cancelled||!ref.current)return;
        ref.current.innerHTML="";
        await window.docx.renderAsync(buf,ref.current,null,{className:"docx",inWrapper:true,ignoreWidth:false,ignoreHeight:false,ignoreFonts:false,breakPages:true,experimental:false,trimXmlDeclaration:true,useBase64URL:true});
        if(cancelled)return;
        applyLetter(ref.current,scheme,recipient); setStatus("ready");
      } catch(e){ console.error(e); setStatus("error:"+e.message); }
    })();
    return ()=>{cancelled=true;};
  }, [recipient?.address1, recipient?.name]);
  return (
    <div className="pci-doc-host">
      {status==="loading"&&<div className="pci-loading">Rendering letter…</div>}
      {status.startsWith("error")&&<div className="pci-loading err">Could not render: {status.slice(6)}</div>}
      <div ref={ref} className="pci-docx-mount" />
    </div>
  );
};

const LetterModal = ({ scheme, onClose }) => {
  const recipients = scheme.recipients||[];
  const [selectedIdx,setSelectedIdx]=React.useState(0);
  const recipient=recipients[selectedIdx];
  const residents=recipients.filter(r=>r.type==="resident");
  const businesses=recipients.filter(r=>r.type==="business");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontWeight:600,fontSize:15}}>Resident / Business Letter · Preview</div>
            <div style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{scheme.project_number} · {scheme.road_name} · {recipients.length} recipient{recipients.length!==1?"s":""}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button className="btn sm"><Icon.Download /> Mail merge · {recipients.length} letters</button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane">
            {recipient?<LetterDoc scheme={scheme} recipient={recipient}/>:<div style={{padding:40,textAlign:"center",color:"var(--ink-3)"}}>No recipients for this scheme.</div>}
          </div>
          <div className="rsr-side">
            <div className="rsr-side-title">Recipients</div>
            {residents.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Residents ({residents.length})</div>
              <div className="letter-recip-list">{recipients.map((r,i)=>r.type==="resident"&&<button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")} onClick={()=>setSelectedIdx(i)}><div className="letter-recip-addr">{r.address1}</div><div className="letter-recip-meta">{r.postcode}</div></button>)}</div>
            </div>}
            {businesses.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Businesses ({businesses.length})</div>
              <div className="letter-recip-list">{recipients.map((r,i)=>r.type==="business"&&<button key={i} className={"letter-recip "+(i===selectedIdx?"active":"")} onClick={()=>setSelectedIdx(i)}><div className="letter-recip-addr"><strong>{r.name}</strong></div><div className="letter-recip-meta">{r.address1} · {r.postcode}</div></button>)}</div>
            </div>}
            <div style={{marginTop:18}}>
              <div style={{fontSize:10,color:"var(--ink-3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Template bindings</div>
              <div className="rsr-bind-list">{LETTER_BINDINGS.map(b=>{ const val=recipient?b.derive(scheme):""; const filled=val!==" "&&val!==undefined; return <div key={b.tag} className={"rsr-bind "+(filled?"":"missing")}><div className="rsr-bind-key mono">{b.tag}</div><div className="rsr-bind-val" style={{marginTop:3}}>{filled?String(val).slice(0,60):"—"}</div></div>; })}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.LetterDoc=LetterDoc; window.LetterModal=LetterModal;
