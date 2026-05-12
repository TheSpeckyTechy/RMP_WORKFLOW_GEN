// ─── BoQPrintDoc.jsx ──────────────────────────────────────────────────────────
// Print-only Bill of Quantities layout used when compiling the handover pack.
// The interactive BoQ tab (BoQTab + BoQSummary + BoQLedger) is designed for
// editing — it has cards, hover affordances, and segmented band buttons that
// render badly on paper. This component flattens the same priced data into a
// linear A4-friendly doc:
//
//   1. Header band  — project ref, road, ward, area, date
//   2. Totals card  — subtotal → additions → BERR → PWP → total
//   3. Series cards — one row per Series with subtotal + % share
//   4. Priced lines — full ledger grouped by Series; each row shows id,
//                     description, qty, unit, rate (band shown as suffix),
//                     line total
//
// Exports (via window): BoQPrintDoc, __getBoQPdfBuffer
// Depends on: React, ReactDOM, window.BOQ_ENGINE, window.schemeArea,
//             window.schemeTreatment, window.htmlToPdfBuffer
// ─────────────────────────────────────────────────────────────────────────────

const BoQPrintDoc = ({ scheme, computed }) => {
  const E = window.BOQ_ENGINE;
  if (!E || !computed) return null;

  // E is guaranteed non-null by the early return above, so we can pull
  // the engine helpers straight off it without fallback chains.
  const { fmtGBP, fmtQty, fmtPct } = E;

  const groups   = computed.groups   || [];
  const subtotal = +computed.subtotal || 0;
  const totalArea = window.schemeArea ? window.schemeArea(scheme) : 0;

  const cellTH = { padding: '5px 7px', borderBottom: '1px solid #ccc', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const cellTD = { padding: '5px 7px', borderBottom: '1px solid #eee', fontSize: 10, verticalAlign: 'top' };
  const mono   = { fontFamily: 'monospace' };

  return (
    <div style={{ width: 794, padding: '32px 36px', background: 'white', fontFamily: "'Arial',Helvetica,sans-serif", color: '#111', boxSizing: 'border-box' }}>
      {/* Header band */}
      <div style={{ borderBottom: '2px solid #1a3a5c', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>Dundee City Council · Road Maintenance Partnership</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{scheme.road_name || 'Untitled scheme'} — Bill of Quantities</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
              {scheme.project_number || '—'} · {scheme.scheme_extent || ''} · Ward {scheme.ward_num || '—'} {scheme.ward_selected || ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', letterSpacing: '0.07em' }}>BoQ Total</div>
            <div style={{ ...mono, fontSize: 18, fontWeight: 700 }}>{fmtGBP(computed.totalIncVat || 0)}</div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: '#666', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {totalArea > 0 && <span><strong style={{ color: '#333' }}>{totalArea.toLocaleString()}</strong> m²</span>}
          {window.schemeTreatment && window.schemeTreatment(scheme) && <span>{window.schemeTreatment(scheme)}</span>}
          {scheme.date_start && <span>{scheme.date_start}{scheme.date_finish ? ` → ${scheme.date_finish}` : ''}</span>}
          {scheme.contractor && <span>{scheme.contractor}</span>}
        </div>
      </div>

      {/* Totals breakdown */}
      <div style={{ background: '#f5f7fa', border: '1px solid #d0d7de', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', letterSpacing: '0.07em', marginBottom: 6 }}>Totals</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <tbody>
            <tr><td style={{ padding: '2px 0' }}>Subtotal</td><td style={{ ...mono, textAlign: 'right' }}>{fmtGBP(subtotal)}</td></tr>
            {(computed.adjustments || []).map(a => (
              <tr key={a.key}>
                <td style={{ padding: '2px 0' }}>+ {a.label} <span style={{ color: '#888' }}>({fmtPct(a.pct)})</span></td>
                <td style={{ ...mono, textAlign: 'right' }}>{fmtGBP(a.amount)}</td>
              </tr>
            ))}
            {computed.useBERR && (
              <tr>
                <td style={{ padding: '2px 0' }}>BERR adjustment <span style={{ color: '#888' }}>({computed.berrDate} · ×{(+computed.berrIndex || 1).toFixed(3)})</span></td>
                <td style={{ ...mono, textAlign: 'right' }}>{(computed.berrAdjustmentAmt >= 0 ? '+ ' : '− ') + fmtGBP(Math.abs(computed.berrAdjustmentAmt || 0))}</td>
              </tr>
            )}
            {(computed.adjustments?.length > 0 || computed.useBERR) && (
              <tr style={{ borderTop: '1px solid #ccc' }}>
                <td style={{ padding: '4px 0 2px', color: '#555' }}>PWP (Works value)</td>
                <td style={{ ...mono, textAlign: 'right', color: '#555' }}>{fmtGBP(computed.pwp || 0)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #1a3a5c' }}>
              <td style={{ padding: '6px 0 2px', fontWeight: 700, fontSize: 11 }}>TOTAL</td>
              <td style={{ ...mono, textAlign: 'right', fontWeight: 700, fontSize: 11 }}>{fmtGBP(computed.totalIncVat || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Series breakdown */}
      {groups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', letterSpacing: '0.07em', marginBottom: 6 }}>Cost breakdown by series</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...cellTH, width: 50 }}>Series</th>
                <th style={cellTH}>Title</th>
                <th style={{ ...cellTH, textAlign: 'right', width: 60 }}>Items</th>
                <th style={{ ...cellTH, textAlign: 'right', width: 90 }}>Subtotal</th>
                <th style={{ ...cellTH, textAlign: 'right', width: 50 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.num}>
                  <td style={{ ...cellTD, ...mono, fontWeight: 700 }}>{g.num}</td>
                  <td style={cellTD}>{g.title}</td>
                  <td style={{ ...cellTD, ...mono, textAlign: 'right' }}>{g.itemCount}</td>
                  <td style={{ ...cellTD, ...mono, textAlign: 'right' }}>{fmtGBP(g.subtotal || 0)}</td>
                  <td style={{ ...cellTD, ...mono, textAlign: 'right' }}>{subtotal > 0 ? (((g.subtotal || 0) / subtotal) * 100).toFixed(1) + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Priced lines, grouped by series */}
      {groups.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', letterSpacing: '0.07em', marginBottom: 6 }}>Priced lines</div>
          {groups.map(g => (
            <div key={g.num} style={{ marginBottom: 14, breakInside: 'avoid' }}>
              <div style={{ fontSize: 11, fontWeight: 700, padding: '6px 8px', background: '#1a3a5c', color: 'white', borderRadius: '3px 3px 0 0' }}>
                <span style={mono}>{g.num}</span> · {g.title}
                <span style={{ float: 'right', fontWeight: 400, opacity: 0.85 }}>{fmtGBP(g.subtotal || 0)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d0d7de' }}>
                <thead>
                  <tr style={{ background: '#f5f7fa' }}>
                    <th style={{ ...cellTH, width: 64 }}>Item</th>
                    <th style={cellTH}>Description</th>
                    <th style={{ ...cellTH, textAlign: 'right', width: 70 }}>Qty</th>
                    <th style={{ ...cellTH, textAlign: 'left', width: 36 }}>Unit</th>
                    <th style={{ ...cellTH, textAlign: 'right', width: 70 }}>Rate</th>
                    <th style={{ ...cellTH, textAlign: 'right', width: 80 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.lines || []).map((l, i) => (
                    <tr key={l.uid || `${g.num}-${i}`} style={{ background: i % 2 ? '#fafbfc' : 'white' }}>
                      <td style={{ ...cellTD, ...mono, fontSize: 9, color: '#666' }}>{l.id}</td>
                      <td style={{ ...cellTD, lineHeight: 1.35 }}>{l.desc || '—'}</td>
                      <td style={{ ...cellTD, ...mono, textAlign: 'right' }}>{fmtQty(l.qty, l.unit)}</td>
                      <td style={{ ...cellTD, color: '#555' }}>{l.unit || ''}</td>
                      <td style={{ ...cellTD, ...mono, textAlign: 'right' }}>{fmtGBP(l.rate || 0)}<span style={{ color: '#888', fontSize: 8, marginLeft: 3 }}>{l.bandApplied || ''}</span></td>
                      <td style={{ ...cellTD, ...mono, textAlign: 'right', fontWeight: 500 }}>{fmtGBP(l.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888' }}>
        <div>Rates: Tayside Contracts JMCA schedule{computed.useBERR ? ` · BERR ${computed.berrDate} ×${(+computed.berrIndex || 1).toFixed(3)}` : ''}</div>
        <div>{scheme.project_number || ''} · {scheme.road_name || ''}</div>
      </div>
    </div>
  );
};

window.BoQPrintDoc = BoQPrintDoc;

// Render the print doc offscreen and return a PDF buffer for pack inclusion.
// Mirrors the __getRSRPdfBuffer / __getFrontPdfBuffer pattern. The
// htmlToPdfBuffer paginator handles the multi-page priced-line table —
// each Series block uses break-inside: avoid so a series doesn't get cut
// awkwardly across pages.
window.__getBoQPdfBuffer = async (scheme) => {
  const E = window.BOQ_ENGINE;
  if (!E || !window.htmlToPdfBuffer) throw new Error('BoQ engine or PDF library not loaded');

  const boq = scheme.boq || (window.defaultBoq ? window.defaultBoq() : { custom_lines: [], settings: {} });
  const effective = E.effectiveQuickInputs(scheme, boq);
  const autoLines = E.regenAutoLines(effective);
  const userLines = (boq.custom_lines || []).filter(l => !l.auto);
  const computed  = E.buildBoQLines({ ...boq, quick_inputs: effective, custom_lines: [...autoLines, ...userLines] }, scheme);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;';
  document.body.appendChild(container);
  try {
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(BoQPrintDoc, { scheme, computed }));
    await new Promise(r => setTimeout(r, 400));
    const buf = await window.htmlToPdfBuffer(container.firstChild || container);
    root.unmount();
    return buf;
  } finally {
    document.body.removeChild(container);
  }
};
