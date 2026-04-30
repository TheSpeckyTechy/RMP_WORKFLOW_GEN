// ─── ProformaView.jsx ────────────────────────────────────────────────────────
// Print-faithful A4 RN39 design proforma. Reads computed design values via
// props (trafficCat / tempCat / totalAdjustment / activeType / finalRates /
// seasonalRisk) from SDTab. Print uses .printing-sd-proforma body class.
// ─────────────────────────────────────────────────────────────────────────────
window.SD = window.SD || {};

window.SD.ProformaView = function ProformaView({ scheme, finalRates, trafficCat, tempCat, totalAdjustment, activeType, seasonalRisk, onBack, onPrint }) {
  const { MONTHS, CHIPPING_DESIGNATIONS } = window.RN39;
  const { fmtAdj, validateForProforma } = window.RN39_LOGIC;

  const isDouble = ['double', 'inverted', 'sandwich'].includes(activeType);
  const chipCode = finalRates?.size?.split('/')[0] || '';
  const missing = validateForProforma(scheme);
  const isOn = (k) => k === 'R10b' ? false : chipCode === k;
  const { components, capped } = totalAdjustment;

  return (
    <>
      {missing.length > 0 && (
        <div className="sd-warning sd-no-print" style={{ maxWidth: '210mm', margin: '0 auto 12px' }}>
          <strong>{missing.length} field{missing.length === 1 ? '' : 's'} missing:</strong> {missing.join(', ')}.
          {' '}Fields will print blank — finish the design first if you need a clean proforma.
        </div>
      )}
      <div className="pf-shell">
        <div className="pf-page">
          <div className="pf-title">PROFORMA FOR RECORDING DESIGNS</div>
          <div className="pf-subtitle">Design of road surface dressings to Road Note 39 (Seventh Edition)</div>

          <div className="pf-line">
            <div className="pf-lbl">Road number:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr', gap: 6, alignItems: 'center' }}>
              <div className="pf-val">{scheme.roadNumber}</div>
              <div className="pf-lbl" style={{ textAlign: 'right' }}>Region/Area:</div>
              <div className="pf-val">{scheme.regionArea}</div>
            </div>
          </div>
          <div className="pf-line">
            <div className="pf-lbl">Section location:</div>
            <div className="pf-val pf-val-fill">{scheme.siteName}</div>
          </div>
          <div className="pf-line">
            <div className="pf-lbl">Length:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 18px 70px 80px 18px 70px 80px 60px 1fr 18px', gap: 4, alignItems: 'center', fontSize: 9.5 }}>
              <div className="pf-val">{scheme.length}</div><div className="pf-unit">m</div>
              <div className="pf-lbl">Width:</div>
              <div className="pf-val">{scheme.width}</div><div className="pf-unit">m</div>
              <div className="pf-lbl">No. of lanes:</div>
              <div className="pf-val">{scheme.numLanes}</div>
              <div className="pf-lbl">Area:</div>
              <div className="pf-val">{scheme.areaM2 ? parseFloat(scheme.areaM2).toLocaleString() : ''}</div>
              <div className="pf-unit">m²</div>
            </div>
          </div>
          <div className="pf-line">
            <div className="pf-lbl">Lane(s):</div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 130px 90px 130px 1fr', gap: 6, alignItems: 'center' }}>
              <div className="pf-val">{scheme.laneId}</div>
              <div className="pf-lbl">Medium/Heavy Traffic:</div>
              <div className="pf-val-with-suffix"><span>{scheme.cvDay}</span><span className="pf-unit">cv/l/d</span></div>
              <div className="pf-lbl">NRSWA road type:</div>
              <div className="pf-val">{trafficCat?.nrswa ?? ''}</div>
            </div>
          </div>
          <div className="pf-line">
            <div className="pf-lbl pf-lbl-req">Traffic Speed:</div>
            <div className="pf-val-with-suffix" style={{ minWidth: 120 }}><span>{scheme.trafficSpeed}</span><span className="pf-unit">mph</span></div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Traffic category:</div>
            <div className="pf-options">
              {['A','B','C','D','E','F','G','H'].map(c => (
                <div key={c} className={`pf-opt ${trafficCat?.cat === c ? 'pf-opt-on' : ''}`} style={{ flex: 1, minWidth: 0 }}>{c}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Location:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
              <div className="pf-options">
                {['South','Central','North'].map(l => (
                  <div key={l} className={`pf-opt pf-opt-wide ${scheme.location === l ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{l}</div>
                ))}
              </div>
              <div className="pf-srow-label pf-lbl-req">Temperature Category:</div>
              <div className="pf-options">
                {['A','B','C','D'].map(t => {
                  const on = (tempCat === 'C/D' && (t === 'C' || t === 'D')) || tempCat === t;
                  return <div key={t} className={`pf-opt ${on ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{t}</div>;
                })}
              </div>
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label">RH probe depth:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 18px 30px 60px 22px 70px 1fr 70px 1fr', gap: 4, alignItems: 'center' }}>
              <div className="pf-val">{scheme.rhProbeDepth}</div><div className="pf-unit">mm</div>
              <div className="pf-lbl">at</div>
              <div className="pf-val">{scheme.rhProbeTemp}</div><div className="pf-unit">°C</div>
              <div className="pf-lbl">Min. PSV:</div>
              <div className="pf-val">{scheme.minPSV}</div>
              <div className="pf-lbl">Max. AAV:</div>
              <div className="pf-val">{scheme.maxAAV}</div>
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">RH Category:</div>
            <div className="pf-options">
              {['Very Hard','Hard','Normal','Soft','Very Soft','Variable'].map(h => (
                <div key={h} className={`pf-opt pf-opt-wide ${scheme.hardness === h ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{h}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Surface condition:</div>
            <div className="pf-options">
              {[
                { k: 'veryRich', l: 'Very binder rich' },
                { k: 'rich', l: 'Binder Rich' },
                { k: 'normal', l: 'Normal' },
                { k: 'wheelTracks', l: 'Texture in wheel tracks' },
                { k: 'lean', l: 'Binder lean/Porous' },
              ].map(o => (
                <div key={o.k} className={`pf-opt pf-opt-wide ${scheme.condition === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Radius of curvature:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 110px', gap: 10, alignItems: 'center' }}>
              <div className="pf-options">
                {[{ k:'under100',l:'Under 100 m'},{k:'100to250',l:'100 – 250 m'},{k:'over250',l:'over 250 m'}].map(o => (
                  <div key={o.k} className={`pf-opt pf-opt-wide ${scheme.radiusCurvature === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
                ))}
              </div>
              <div className="pf-srow-label">Expected Month:</div>
              <div className="pf-val">{MONTHS[scheme.installMonth - 1]}</div>
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Junction or crossing:</div>
            <div className="pf-options" style={{ maxWidth: 280 }}>
              <div className={`pf-opt pf-opt-wide ${scheme.junctionCrossing === 'approach' ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>Approach</div>
              <div className={`pf-opt pf-opt-wide ${scheme.junctionCrossing === 'nonApproach' ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>Non-approach</div>
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Overall gradient:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <div className="pf-options">
                {[{k:'lt5',l:'up to 5 %'},{k:'mid',l:'5 – 10 %'},{k:'gt10',l:'Over 10 %'}].map(o => (
                  <div key={o.k} className={`pf-opt pf-opt-wide ${scheme.gradientMag === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
                ))}
              </div>
              <div className="pf-options">
                <div className={`pf-opt pf-opt-wide ${scheme.gradientDir === 'uphill' ? 'pf-opt-on' : ''}`}>Uphill</div>
                <div className={`pf-opt pf-opt-wide ${scheme.gradientDir === 'downhill' ? 'pf-opt-on' : ''}`}>Downhill</div>
              </div>
            </div>
          </div>

          <div className="pf-divider" />

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Type of surface dressing:</div>
            <div className="pf-options">
              {[{k:'single',l:'Single'},{k:'racked',l:'Racked-In'},{k:'double',l:'Double'},{k:'inverted',l:'Inverted Double'},{k:'sandwich',l:'Sandwich'}].map(o => (
                <div key={o.k} className={`pf-opt pf-opt-wide ${activeType === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow pf-srow-tall">
            <div className="pf-srow-label pf-lbl-req">Chipping size:</div>
            <div className="pf-chip-block">
              <div className="pf-chip-grid">
                {['S14','S10','S6','R14','R10','R10b','D14','D10'].map(k => (
                  <div key={k} className={`pf-opt ${isOn(k) ? 'pf-opt-on' : ''}`}>{CHIPPING_DESIGNATIONS[k] || k}</div>
                ))}
                <div className="pf-opt" style={{ visibility: 'hidden' }}>&nbsp;</div>
              </div>
              <div className="pf-other-box"><div>Other:</div><div className="pf-other-content" /></div>
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Aggregate type:</div>
            <div className="pf-options">
              {[{k:'rock',l:'Crushed rock'},{k:'blast',l:'Blast-furnace slag'},{k:'steel',l:'Steel slag'},{k:'gravel',l:'Gravel'}].map(o => (
                <div key={o.k} className={`pf-opt pf-opt-wide ${scheme.aggregate === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label pf-lbl-req">Shape: Flakiness Cat.</div>
            <div className="pf-options">
              {['f10','f15','f20','f25'].map(k => (
                <div key={k} className={`pf-opt pf-opt-wide ${scheme.shape === k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{k.toUpperCase()}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label">Bituminous emulsion binder:</div>
            <div className="pf-options">
              {[{k:'unmodified',l:'Unmodified'},{k:'intermediate',l:'Intermediate'},{k:'premium',l:'Premium Grade'},{k:'superpremium',l:'Super-Premium'}].map(o => (
                <div key={o.k} className={`pf-opt pf-opt-wide ${scheme.binderGrade === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
              ))}
            </div>
          </div>

          <div className="pf-srow">
            <div className="pf-srow-label">Seasonal risk category:</div>
            <div className="pf-options">
              {[{k:'high',l:'High'},{k:'sig',l:'Significant'},{k:'low',l:'Low'}].map(o => (
                <div key={o.k} className={`pf-opt pf-opt-wide ${seasonalRisk === o.k ? 'pf-opt-on' : ''}`} style={{ flex: 1 }}>{o.l}</div>
              ))}
            </div>
          </div>

          <div className="pf-binder-row">
            <div className="pf-srow-label">Binder spread rate</div>
            <div className="pf-binder-cell">
              <div className="pf-srow-label">First layer</div>
              <div className="pf-binder-input">
                <span>{finalRates ? (isDouble ? finalRates.l1 : finalRates.binder) : ''}</span>
                <span className="pf-unit">L/m²</span>
              </div>
            </div>
            <div className="pf-binder-cell">
              <div className="pf-srow-label">Second layer *</div>
              <div className="pf-binder-input">
                <span>{finalRates && isDouble ? finalRates.l2 : ''}</span>
                <span className="pf-unit">L/m²</span>
              </div>
            </div>
          </div>

          <table className="pf-adj-table pf-adj-outer">
            <thead>
              <tr>
                <th rowSpan={2} className="pf-loc">Location</th>
                <th rowSpan={2} className="pf-vert">Season</th>
                <th rowSpan={2} className="pf-vert">Aggregate type</th>
                <th rowSpan={2} className="pf-vert">Shape</th>
                <th rowSpan={2} />
                <th rowSpan={2} className="pf-vert">Shade</th>
                <th rowSpan={2} className="pf-vert">Surface condition</th>
                <th rowSpan={2} className="pf-vert">Gradient</th>
                <th rowSpan={2} className="pf-vert">Traffic Speed</th>
                <th rowSpan={2} className="pf-vert">Local traffic</th>
                <th rowSpan={2}>Sum of factors</th>
                <th colSpan={2}>Rate of spread of binder L/m²</th>
              </tr>
              <tr>
                <th className="pf-spread">1st</th>
                <th className="pf-spread">2nd</th>
              </tr>
            </thead>
            <tbody>
              <tr className="pf-row-data">
                <td>{scheme.siteName || ''}</td>
                <td>{fmtAdj(components.season)}</td>
                <td>{fmtAdj(components.aggregate)}</td>
                <td>{fmtAdj(components.shape)}</td>
                <td />
                <td>{fmtAdj(components.shade)}</td>
                <td>{fmtAdj(components.condition)}</td>
                <td>{fmtAdj(components.gradient)}</td>
                <td>{fmtAdj(components.speed)}</td>
                <td>{fmtAdj(components.localTraffic)}</td>
                <td>{capped >= 0 ? '+' : ''}{capped.toFixed(2)}</td>
                <td>{finalRates ? (isDouble ? finalRates.l1 : finalRates.binder) : ''}</td>
                <td>{finalRates && isDouble ? finalRates.l2 : ''}</td>
              </tr>
              {[0,1,2].map(i => <tr key={i} className="pf-row-blank"><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>)}
            </tbody>
          </table>

          <div className="pf-footer">
            <div className="pf-footer-cell">
              <div className="pf-srow-label">Designer:</div>
              <div className="pf-val">{scheme.designerName}</div>
            </div>
            <div className="pf-footer-cell">
              <div className="pf-srow-label">Initials:</div>
              <div className="pf-val">{scheme.designerInitials}</div>
            </div>
            <div className="pf-footer-cell">
              <div className="pf-srow-label">Date:</div>
              <div className="pf-date-box">
                {scheme.designDate
                  ? <span>{new Date(scheme.designDate).toLocaleDateString('en-GB')}</span>
                  : <span style={{ color: '#555' }}>/ &nbsp; /</span>}
              </div>
            </div>
          </div>
          {scheme.notes && <div className="pf-notes"><strong>Notes:</strong> {scheme.notes}</div>}
        </div>
      </div>
      <div className="sd-actions sd-no-print" style={{ justifyContent: 'center', marginTop: 16, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {onPrint && <button className="sd-btn" onClick={onPrint} type="button">⎙ Print / Save as PDF</button>}
          {onBack && <button className="sd-btn sd-btn-secondary" onClick={onBack} type="button">← Back to Design</button>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--sd-text-muted)', maxWidth: 360, textAlign: 'center' }}>
          On iPhone: tap Print, pinch the preview to enlarge, then use the Share menu to Save to Files as PDF.
        </div>
      </div>
    </>
  );
};
