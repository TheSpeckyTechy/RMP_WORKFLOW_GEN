// PackCompiler.jsx — merges all handover pack documents into a single PDF
//
// Produces: Pack_<ref>_<road>.pdf  containing pages in front-sheet order:
//   1. Front Sheet         (rendered HTML → canvas → jsPDF)
//   2. PCI / CPP           (DOCX template → docx-preview → canvas → jsPDF)
//   3. Road Space Request  (HTML render → canvas → jsPDF)
//   4. Bill of Quantities  (uploaded PDF only — XLSX cannot be auto-converted)
//   5. Resurfacing & Ironwork Plans  (uploaded PDF)
//   6. Traffic Management Plans      (uploaded PDF)
//   7. Utility Searches Pack         (uploaded PDF)
//
// Note: Resident Letters are excluded — they require recipient addresses and
// are generated separately via the mail-merge workflow in the Pack tab.
//
// Depends on: pdf-lib (window.PDFLib), html2canvas, jsPDF, JSZip, docx-preview,
//             window.htmlToPdfBuffer (icons.jsx),
//             window.__getFrontPdfBuffer (SchemeDetail.jsx),
//             window.__getPCIPdfBuffer (PCIPreview.jsx),
//             window.__getRSRPdfBuffer (RoadSpaceRequest.jsx)

async function base64ToPdfBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function compilePackPdf(scheme, onProgress) {
  if (!window.PDFLib) throw new Error('pdf-lib not loaded — check index.html script tags');
  const { PDFDocument } = window.PDFLib;
  const merged = await PDFDocument.create();

  const SECTIONS = [
    {
      key: 'front',
      name: 'Front Sheet',
      fn: () => window.__getFrontPdfBuffer(scheme),
    },
    {
      key: 'pci',
      name: 'PCI / CPP',
      fn: () => window.__getPCIPdfBuffer(scheme),
    },
    {
      key: 'rsr',
      name: 'Road Space Request',
      fn: () => window.__getRSRPdfBuffer(scheme),
    },
    // Letter excluded — requires recipient list (mail-merge workflow)
    {
      key: 'boq',
      name: 'Bill of Quantities',
      fn: null,  // upload only
    },
    {
      key: 'drawings',
      name: 'Resurfacing & Ironwork Plans',
      fn: null,
    },
    {
      key: 'tm',
      name: 'Traffic Management Plans',
      fn: null,
    },
    {
      key: 'utilities',
      name: 'Utility Searches Pack',
      fn: null,
    },
  ];

  const included = [];
  const skipped  = [];

  for (const section of SECTIONS) {
    onProgress && onProgress(section.name);

    try {
      let buf = null;

      if (section.fn) {
        buf = await section.fn();
      }

      // Fall back to (or use exclusively for manual docs) the uploaded PDF
      if (!buf) {
        const pf = scheme[`pack_file_${section.key}`];
        if (pf && pf.data) buf = await base64ToPdfBuffer(pf.data);
      }

      if (!buf) {
        skipped.push(section.name);
        continue;
      }

      const src   = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
      included.push(section.name);
    } catch (e) {
      console.warn(`PackCompiler: failed to compile "${section.name}"`, e);
      skipped.push(section.name);
    }
  }

  if (!included.length) throw new Error('No documents could be compiled — see browser console for details');

  const bytes = await merged.save();
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const a     = document.createElement('a');
  a.href      = URL.createObjectURL(blob);
  a.download  = `Pack_${scheme.project_number}_${(scheme.road_name || '').replace(/\s+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);

  window.dispatchEvent(new CustomEvent('rmp-download', {
    detail: {
      label: `Compiled Pack PDF — ${scheme.road_name} (${included.length} docs)`,
      ref: scheme.project_number,
    },
  }));

  return { included, skipped };
}

window.__compilePackPdf = compilePackPdf;
