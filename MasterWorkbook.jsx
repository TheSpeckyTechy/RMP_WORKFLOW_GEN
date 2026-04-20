// Resident / Business Letter — renders the DCC Residential Letter Template exactly,
// replacing <<Tag>> placeholders with master-workbook values and swapping the
// recipient address block per-recipient. Multi-recipient: list + preview pane.

// --- bindings: each placeholder text → { key on scheme } or derived ---
// Convener, Depute Convener and Lord Provost are now hard-coded in the template,
// so we don't inject them here. «AddressLine4», «POSTCODE», «TOWN_NAME» are the
// Word mail-merge fields for the recipient address (replaced at recipient-swap time).
const LETTER_BINDINGS = [
  // Top-right box
  { tag: "<<Our_Ref>>",        derive: s => s.project_number || "" },
  { tag: "<<Letter_Date>>",    derive: s => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
  // Body
  { tag: "<<Letter_Subject>>", derive: s => {
      const road = s.road_name || "";
      const ext = s.scheme_extent ? ` (${s.scheme_extent})` : "";
      return `RESURFACING WORKS — ${road.toUpperCase()}${ext.toUpperCase()}`;
    }
  },
  { tag: "<<Letter_Body_Text>>", derive: s => {
      const start = s.date_start || "[start date]";
      const finish = s.date_finish || "[finish date]";
      const road = s.road_name || "[road]";
      const ext = s.scheme_extent ? ` between ${s.scheme_extent}` : "";
      const tm = s.tm_type ? s.tm_type.toLowerCase() : "temporary traffic management";
      const tmHours = s.tm_hours || "07:30 to 15:30";
      return `Dundee City Council will shortly be carrying out resurfacing works on ${road}${ext}. The works are programmed to commence on ${start} and are expected to be completed by ${finish}.\n\nTo enable the works to be carried out safely, ${tm.charAt(0).toUpperCase() + tm.slice(1)} will be in place during working hours (${tmHours}). Pedestrian access to properties will be maintained at all times. Vehicular access may be restricted during working hours; where possible, please arrange to move vehicles prior to works commencing.\n\nEvery effort will be made to minimise disruption. If you have any questions regarding these works, please contact the Senior Engineer named above.\n\nWe apologise in advance for any inconvenience caused.`;
    }
  },
  // Ward councillors (derived from scheme.ward_num)
  { tag: "<<Ward_Councillor_1>>", derive: s => {
      const ward = window.WARDS.find(w => w.num === s.ward_num);
      if (!ward) return "";
      const c = ward.councillors[0];
      return c ? `${c.title} ${c.name} (Ward ${ward.num} ${ward.name})` : "";
    }
  },
  { tag: "<<Ward_Councillor_2>>", derive: s => {
      const ward = window.WARDS.find(w => w.num === s.ward_num);
      if (!ward) return "";
      const c = ward.councillors[1];
      return c ? `${c.title} ${c.name} (Ward ${ward.num} ${ward.name})` : "";
    }
  },
  { tag: "<<Ward_Councillor_3>>", derive: s => {
      const ward = window.WARDS.find(w => w.num === s.ward_num);
      if (!ward) return "";
      const c = ward.councillors[2];
      return c ? `${c.title} ${c.name} (Ward ${ward.num} ${ward.name})` : "";
    }
  },
];

// Cache buffer. Bump the version in the URL when the template file changes so
// the cached ArrayBuffer is invalidated across hot-reloads.
let _letterBuffer = null;
const LETTER_DOCX_URL = "assets/Residential_Letter_Template.docx?v=2";
const loadLetterBuffer = async () => {
  if (_letterBuffer) return _letterBuffer;
  const res = await fetch(LETTER_DOCX_URL);
  _letterBuffer = await res.arrayBuffer();
  return _letterBuffer;
};

// Replace <<Tag>> and «MergeField» text nodes with highlighted spans bound to values.
// The new template has FIXED "The Current Occupier" text and three Word mail-merge
// fields for the recipient (<<AddressLine4>>, «POSTCODE», «TOWN_NAME»). We bind
// those three to the currently-selected recipient.
const applyLetter = (root, scheme, recipient) => {
  // Per-recipient bindings (replace Word mail-merge fields)
  const recipientBindings = {
    "AddressLine4": recipient?.address1 || "",
    "POSTCODE":     recipient?.postcode || "",
    "TOWN_NAME":    recipient?.town || "DUNDEE",
  };

  // Walk text nodes and replace <<Tag>> / «MergeField» placeholders
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (/<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»/.test(n.nodeValue)) nodes.push(n);
  }

  // Build quick lookup from <<Tag>> text to resolver
  const byTag = {};
  LETTER_BINDINGS.forEach(b => { byTag[b.tag] = b; });

  nodes.forEach(node => {
    const txt = node.nodeValue;
    const parts = txt.split(/(<<[A-Za-z0-9_]+>>|«[A-Za-z0-9_]+»)/);
    const frag = document.createDocumentFragment();
    parts.forEach(p => {
      if (!p) return;
      const mAngle = /^<<([A-Za-z0-9_]+)>>$/.exec(p);
      const mGuil  = /^«([A-Za-z0-9_]+)»$/.exec(p);
      const m = mAngle || mGuil;
      if (m) {
        const name = m[1];
        let val, filled;
        if (mGuil && recipientBindings.hasOwnProperty(name)) {
          // Word mail-merge field for recipient
          val = recipientBindings[name];
          filled = val !== "" && val !== undefined && val !== null;
        } else {
          const tag = mAngle ? p : `<<${name}>>`;
          const binding = byTag[tag];
          val = binding ? binding.derive(scheme) : "";
          filled = val !== undefined && val !== "" && val !== null;
        }
        const span = document.createElement("span");
        span.className = "pci-bound" + (filled ? "" : " pci-missing");
        span.dataset.key = name;
        const text = filled ? String(val) : p;
        const textLines = text.split("\n");
        textLines.forEach((line, i) => {
          if (i > 0) {
            span.appendChild(document.createElement("br"));
            span.appendChild(document.createElement("br"));
          }
          span.appendChild(document.createTextNode(line));
        });
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(p));
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
};

const LetterDoc = ({ scheme, recipient }) => {
  const ref = React.useRef(null);
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await loadLetterBuffer();
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        await window.docx.renderAsync(buf, ref.current, null, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });
        if (cancelled) return;
        applyLetter(ref.current, scheme, recipient);
        setStatus("ready");
      } catch (e) {
        console.error(e);
        setStatus("error:" + e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [recipient?.address1, recipient?.name]); // re-render doc when recipient changes

  return (
    <div className="pci-doc-host">
      {status === "loading" && <div className="pci-loading">Rendering letter…</div>}
      {status.startsWith("error") && <div className="pci-loading err">Could not render: {status.slice(6)}</div>}
      <div ref={ref} className="pci-docx-mount" />
    </div>
  );
};

const LetterModal = ({ scheme, onClose }) => {
  const recipients = scheme.recipients || [];
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const recipient = recipients[selectedIdx];

  const residents = recipients.filter(r => r.type === "resident");
  const businesses = recipients.filter(r => r.type === "business");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rsr-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Resident / Business Letter · Preview</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {scheme.project_number} · {scheme.road_name} · {recipients.length} recipient{recipients.length !== 1 ? "s" : ""} ({residents.length} residents, {businesses.length} businesses)
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn sm"><Icon.Download /> Mail merge · {recipients.length} letters</button>
            <button className="btn ghost sm" onClick={onClose}><Icon.X /></button>
          </div>
        </div>
        <div className="rsr-body">
          <div className="rsr-preview-pane">
            {recipient ? (
              <LetterDoc scheme={scheme} recipient={recipient} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
                No recipients for this scheme. Add residents / businesses on the scheme detail page.
              </div>
            )}
          </div>
          <div className="rsr-side">
            <div className="rsr-side-title">Recipients</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.5 }}>
              Template <code>Residential_Letter_Template.docx</code> rendered unchanged. The recipient address and <code style={{ background: "#fff59d", padding: "0 3px" }}>{"<<Tag>>"}</code> placeholders are swapped per letter.
            </div>

            {residents.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Residents ({residents.length})</div>
                <div className="letter-recip-list">
                  {recipients.map((r, i) => r.type === "resident" && (
                    <button key={i}
                            className={"letter-recip " + (i === selectedIdx ? "active" : "")}
                            onClick={() => setSelectedIdx(i)}>
                      <div className="letter-recip-addr">{r.address1}</div>
                      <div className="letter-recip-meta">{r.postcode}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {businesses.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Businesses ({businesses.length})</div>
                <div className="letter-recip-list">
                  {recipients.map((r, i) => r.type === "business" && (
                    <button key={i}
                            className={"letter-recip " + (i === selectedIdx ? "active" : "")}
                            onClick={() => setSelectedIdx(i)}>
                      <div className="letter-recip-addr"><strong>{r.name}</strong></div>
                      <div className="letter-recip-meta">{r.address1} · {r.postcode}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Template bindings</div>
              <div className="rsr-bind-list">
                {LETTER_BINDINGS.map(b => {
                  const val = recipient ? b.derive(scheme) : "";
                  const filled = val !== "" && val !== undefined && val !== null;
                  const short = String(val).length > 60 ? String(val).slice(0, 60) + "…" : val;
                  return (
                    <div key={b.tag} className={"rsr-bind " + (filled ? "" : "missing")}>
                      <div className="rsr-bind-key mono">{b.tag}</div>
                      <div className="rsr-bind-val" style={{ marginTop: 3 }}>
                        {filled ? short : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.LetterDoc = LetterDoc;
window.LetterModal = LetterModal;
