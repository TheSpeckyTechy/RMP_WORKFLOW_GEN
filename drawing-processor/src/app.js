/* ============================================================
   RMP Drawing Processor v2
   - Polygon area hatching (straight-sided, diagonal-hatch fill)
   - Key box (bottom-left), auto-populating
   - New horizontal title block, fully editable, original masked
   ============================================================ */
(function(){
const D = window.SKETCHES || {};
const TB = window.TITLEBLOCK;
const names = Object.keys(D).sort((a,b)=>D[a].title.localeCompare(D[b].title));
const ASSET_LABEL = {SW:'Scottish Water', BT:'BT', SV:'Stop Valve', Gas:'Gas'};

const S = {
  key: names[0], dwg:'treatment', colour:1, hmode:'polygon',
  spec:{material:'SMA', agg:'10mm', depthMM:'40mm'},   // current spec applied to new areas
  polys:[], draft:[], assets:[], quickSpecs:[], view:{scale:1},
  img:null, baseW:924, baseH:1316, recolourBlue:false, tb:blankTB()
};
// build the combined label for an area, e.g. "SMA 10 @ 40mm"  (Taypave/HRA/Taycoat (FW) similar)
function areaLabel(p){
  const agg=(p.agg||'').replace('mm','');
  return (p.material||'')+(agg?(' '+agg):'')+' @ '+(p.depthMM||'');
}
function blankTB(sketchName){return {
  projectTitle: sketchName ? sketchName+' Resurfacing' : '',
  drawingTitle:'Resurfacing Instruction',
  drwgNo:'001', suitability:'', revision:'R0',
  projectRef:'', drawn:'JMCA', checked:'SL', approved:'SL',
  scale:'NTS', date:todayStr(),
  rev:'',revDesc:'',revInit:'',revDate:''};}
function todayStr(){const d=new Date(),p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+String(d.getFullYear()).slice(2);}

const $=id=>document.getElementById(id);
const cv=$('cv'), ctx=cv.getContext('2d');
const sel=$('sketchSel');
names.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=D[n].title;sel.appendChild(o);});
sel.value=S.key;

const tbImg=new Image(); let tbReady=false; tbImg.onload=()=>{tbReady=true;render();}; tbImg.src=TB;

function loadImage(cb){const im=new Image();
  im.onload=()=>{
    // rotate source 90deg CCW into a landscape base canvas; work in landscape coords throughout
    const lw=im.naturalHeight, lh=im.naturalWidth;
    const base=document.createElement('canvas'); base.width=lw; base.height=lh;
    const bc=base.getContext('2d');
    bc.translate(0,lh); bc.rotate(-Math.PI/2); bc.drawImage(im,0,0);
    S.img=base; S.baseW=lw; S.baseH=lh;
    _noHatch=null;_blueCache=null;fit();cb&&cb();
  };
  im.src=D[S.key].src;}

let _blueCache=null,_blueKey=null;
function getRecoloured(){
  if(!S.recolourBlue||S.colour!==2) return S.img;
  if(_blueCache&&_blueKey===S.key) return _blueCache;
  const off=document.createElement('canvas');off.width=S.baseW;off.height=S.baseH;
  const o=off.getContext('2d');o.drawImage(S.img,0,0);
  const d=o.getImageData(0,0,off.width,off.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];
    if(r>120&&r>g+40&&r>b+40){p[i]=b;p[i+1]=g;p[i+2]=r;}}
  o.putImageData(d,0,0);_blueCache=off;_blueKey=S.key;return off;}

let _noHatch=null,_noHatchKey=null;
function getNoHatch(){
  if(_noHatch&&_noHatchKey===S.key) return _noHatch;
  const off=document.createElement('canvas');off.width=S.baseW;off.height=S.baseH;
  const o=off.getContext('2d');o.drawImage(S.img,0,0);
  const d=o.getImageData(0,0,off.width,off.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2];
    if(r>120&&r>g+40&&r>b+40){p[i]=255;p[i+1]=255;p[i+2]=255;}}
  o.putImageData(d,0,0);_noHatch=off;_noHatchKey=S.key;return off;}

function depthColour(d){return d===2?'#1450c8':'#c81e0a';}
function fillPolyHatch(c,poly){
  if(poly.pts.length<2) return;
  c.save();
  c.beginPath();
  poly.pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.closePath();
  c.fillStyle=poly.colour===2?'rgba(20,80,200,.08)':'rgba(200,30,10,.08)'; c.fill(); c.clip();
  c.strokeStyle=depthColour(poly.colour); c.lineWidth=1.4; c.globalAlpha=0.9;
  const xs=poly.pts.map(p=>p[0]),ys=poly.pts.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const step=9, diag=(maxX-minX)+(maxY-minY);
  c.beginPath();
  for(let o=-diag;o<diag;o+=step){c.moveTo(minX+o,minY);c.lineTo(minX+o+(maxY-minY),maxY);}
  c.stroke();
  c.globalAlpha=1;c.lineWidth=2;c.strokeStyle=depthColour(poly.colour);
  c.beginPath();
  poly.pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.closePath();c.stroke();c.restore();
  // material label at centroid
  const lbl=areaLabel(poly);
  if(lbl.trim()&&lbl!==' @ '){
    const cx=poly.pts.reduce((s,p)=>s+p[0],0)/poly.pts.length;
    const cy=poly.pts.reduce((s,p)=>s+p[1],0)/poly.pts.length;
    c.save();c.font='700 13px "IBM Plex Mono",monospace';c.textAlign='center';c.textBaseline='middle';
    const tw=c.measureText(lbl).width;
    c.fillStyle='rgba(255,255,255,.9)';c.fillRect(cx-tw/2-4,cy-9,tw+8,18);
    c.strokeStyle=depthColour(poly.colour);c.lineWidth=1;c.strokeRect(cx-tw/2-4,cy-9,tw+8,18);
    c.fillStyle=depthColour(poly.colour);c.fillText(lbl,cx,cy);c.restore();
  }
}
function drawDraft(c){
  if(!S.draft.length) return;
  c.save();
  c.strokeStyle=depthColour(S.colour);c.lineWidth=2;c.setLineDash([6,4]);
  c.beginPath();
  S.draft.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.stroke();c.setLineDash([]);
  S.draft.forEach((p,i)=>{c.beginPath();c.arc(p[0],p[1],i===0?6:4,0,7);
    c.fillStyle=i===0?'#fff':depthColour(S.colour);
    c.strokeStyle=depthColour(S.colour);c.lineWidth=2;c.fill();c.stroke();});
  c.restore();
}
function drawAsset(c,a){
  const bs=9;c.save();
  c.lineWidth=1.6;c.strokeStyle='#000';c.fillStyle='#fff';
  c.fillRect(a.x-bs/2,a.y-bs/2,bs,bs);c.strokeRect(a.x-bs/2,a.y-bs/2,bs,bs);
  c.font='700 13px "IBM Plex Mono",monospace';c.textBaseline='alphabetic';
  const tx=a.x+bs/2+4,ty=a.y-bs/2-2,tw=c.measureText(a.type).width;
  c.fillStyle='rgba(255,255,255,.9)';c.fillRect(tx-1,ty-12,tw+2,14);
  c.fillStyle='#000';c.fillText(a.type,tx,ty);c.restore();
}

function drawKeyBox(c){
  const items=[];
  if(S.dwg==='treatment'){
    const groups={};
    // quickSpecs seed the key first (pre-drawn hatch entries — no count)
    (S.quickSpecs||[]).forEach(p=>{
      const lbl=areaLabel(p);
      const key=lbl+'|'+p.colour;
      if(!groups[key]) groups[key]={label:lbl, colour:depthColour(p.colour), count:0, kind:'hatch'};
    });
    // drawn polygons add to (or create) their group
    S.polys.forEach(p=>{
      const lbl=areaLabel(p);
      const key=lbl+'|'+p.colour;
      if(!groups[key]) groups[key]={label:lbl, colour:depthColour(p.colour), count:0, kind:'hatch'};
      groups[key].count++;
    });
    Object.values(groups).forEach(g=>items.push(g));
  } else {
    const counts={}; S.assets.forEach(a=>counts[a.type]=(counts[a.type]||0)+1);
    Object.keys(counts).forEach(t=>items.push({label:ASSET_LABEL[t]+' ('+t+')',count:counts[t],kind:'asset'}));
  }
  if(!items.length) return;
  c.save();
  const pad=10,rowH=22,titleH=24,w=320,h=titleH+items.length*rowH+pad;
  // bottom-left, inside the landscape drawing frame (left border x=20, bottom y=891)
  const frameL=0.0152*S.baseW, frameB=0.9643*S.baseH, m=14;
  const x=frameL+m, y=frameB-h-m;
  c.fillStyle='rgba(255,255,255,.97)';c.strokeStyle='#000';c.lineWidth=1.5;
  c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);
  c.fillStyle='#000';c.font='700 13px "IBM Plex Mono",monospace';c.textBaseline='middle';
  c.fillText(S.dwg==='treatment'?'MATERIAL KEY':'IRONWORK KEY',x+pad,y+titleH/2+3);
  c.beginPath();c.moveTo(x,y+titleH);c.lineTo(x+w,y+titleH);c.lineWidth=1;c.stroke();
  items.forEach((it,i)=>{
    const ry=y+titleH+rowH/2+i*rowH+4;
    if(it.kind==='hatch'){
      const sx=x+pad,sy=ry-7,sw=26,sh=14;
      c.save();c.beginPath();c.rect(sx,sy,sw,sh);c.clip();
      c.strokeStyle=it.colour;c.lineWidth=1.2;c.beginPath();
      for(let o=-sh;o<sw;o+=4){c.moveTo(sx+o,sy+sh);c.lineTo(sx+o+sh,sy);}c.stroke();c.restore();
      c.strokeStyle=it.colour;c.lineWidth=1.2;c.strokeRect(sx,sy,sw,sh);
      c.fillStyle='#000';c.font='600 12px "IBM Plex Mono",monospace';c.textAlign='left';
      c.fillText(it.label,x+pad+36,ry);
      if(it.count>1){c.font='700 12px "IBM Plex Mono",monospace';c.textAlign='right';
        c.fillText('\u00d7 '+it.count,x+w-pad,ry);c.textAlign='left';}
    } else {
      const sx=x+pad+5;
      c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=1.4;
      c.fillRect(sx-4,ry-4,8,8);c.strokeRect(sx-4,ry-4,8,8);
      c.fillStyle='#000';c.font='600 12px "IBM Plex Mono",monospace';c.textAlign='left';
      c.fillText(it.label,x+pad+22,ry);
      c.font='700 13px "IBM Plex Mono",monospace';c.textAlign='right';
      c.fillText('\u00d7 '+it.count,x+w-pad,ry);c.textAlign='left';
    }
  });
  c.restore();
}

const TBW=935,TBH=499;
// Each field: [x, baselineY, fontSize, maxWidth] as fractions of the block (935x499).
// fontSize is in template-space units; actual px = fontSize * (boxH/TBH) ≈ fontSize * 0.37.
// Values are set so rendered text lands at ~10-14px on the composite canvas — legible without overlap.
const FIELDS={
  projectTitle:[0.285,0.500,38,0.700],
  drawingTitle:[0.285,0.630,36,0.700],
  drwgNo:[0.285,0.762,32,0.330],
  suitability:[0.632,0.762,30,0.110],
  revision:[0.758,0.762,30,0.110],
  projectRef:[0.883,0.762,30,0.110],
  drawn:[0.285,0.882,30,0.165],
  checked:[0.456,0.882,30,0.170],
  approved:[0.632,0.882,30,0.110],
  scale:[0.758,0.882,30,0.110],
  date:[0.883,0.882,30,0.110],
  rev:[0.030,0.330,28,0.045],
  revDesc:[0.290,0.330,28,0.470],
  revInit:[0.832,0.330,28,0.065],
  revDate:[0.910,0.330,28,0.080]
};
function renderTitleBlockTo(){/* deprecated: text now drawn directly onto composite for full-res crispness */}
function drawTitleBlock(c){
  if(!tbReady) return;
  // Landscape title-block box (fractions of the 1316x924 landscape sheet): bottom-right, reads normally
  const bx0=0.7188*S.baseW, bx1=0.9818*S.baseW, by0=0.7641*S.baseH, by1=0.9643*S.baseH;
  const boxW=bx1-bx0, boxH=by1-by0;
  // mask + draw the clean block image (raster scaling of the template is fine)
  c.save();c.fillStyle='#fff';c.fillRect(bx0,by0,boxW,boxH);c.restore();
  c.drawImage(tbImg, bx0, by0, boxW, boxH);
  // draw FIELD TEXT directly onto the composite at full resolution (no intermediate downscaled canvas)
  c.save();
  c.fillStyle='#000'; c.textBaseline='alphabetic'; c.textAlign='left';
  for(const k in FIELDS){
    const v=S.tb[k]; if(!v) continue;
    const f=FIELDS[k];
    // map block-fraction -> box pixel coords; scale font by the box height ratio
    const sx=boxW/TBW, sy=boxH/TBH;
    let fs=f[2]*sy;                       // font size in composite pixels
    const maxW=f[3]*TBW*sx;               // max width in composite pixels
    c.font='500 '+fs+'px "IBM Plex Sans","IBM Plex Mono",sans-serif';
    while(c.measureText(v).width>maxW && fs>8){ fs-=0.5; c.font='500 '+fs+'px "IBM Plex Sans","IBM Plex Mono",sans-serif'; }
    c.fillText(v, bx0 + f[0]*TBW*sx, by0 + f[1]*TBH*sy);
  }
  c.restore();
}

function composite(ss){
  ss=ss||1;
  const off=document.createElement('canvas');off.width=S.baseW*ss;off.height=S.baseH*ss;
  const c=off.getContext('2d');
  c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high';
  if(ss!==1) c.scale(ss,ss);
  if(S.dwg==='treatment'){c.drawImage(getRecoloured(),0,0);S.polys.forEach(p=>fillPolyHatch(c,p));drawDraft(c);}
  else{c.drawImage(getNoHatch(),0,0);S.assets.forEach(a=>drawAsset(c,a));}
  drawKeyBox(c); drawTitleBlock(c); return off;
}

function fit(){const host=cv.parentElement.parentElement,pad=60;
  const sc=Math.min((host.clientWidth-pad)/S.baseW,(host.clientHeight-pad)/S.baseH);
  S.view.scale=sc;S.view.ox=0;S.view.oy=0;resizeCanvas();render();applyPan();}
function resizeCanvas(){cv.width=S.baseW*S.view.scale;cv.height=S.baseH*S.view.scale;
  cv.parentElement.style.width=cv.width+'px';cv.parentElement.style.height=cv.height+'px';}
function applyPan(){cv.parentElement.style.transform='translate('+(S.view.ox||0)+'px,'+(S.view.oy||0)+'px)';}
function render(){const comp=composite();ctx.clearRect(0,0,cv.width,cv.height);
  ctx.imageSmoothingQuality='high';ctx.drawImage(comp,0,0,cv.width,cv.height);}
function toImg(e){const r=cv.getBoundingClientRect();
  return [(e.clientX-r.left)/S.view.scale,(e.clientY-r.top)/S.view.scale];}

let panning=false,panStart=null;
cv.addEventListener('mousedown',e=>{
  if(e.button===1||e.shiftKey){panning=true;panStart={x:e.clientX,y:e.clientY,ox:S.view.ox||0,oy:S.view.oy||0};
    cv.classList.add('pan');e.preventDefault();return;}
  if(e.button!==0) return;
  const [x,y]=toImg(e);
  if(S.dwg==='ironwork'){S.assets.push({type:currentAsset,x,y});render();saveLocal();return;}
  if(S.hmode==='polygon'){
    // close when clicking on/near the first vertex
    if(S.draft.length>=3){const [fx,fy]=S.draft[0];
      if(Math.hypot(x-fx,y-fy)*S.view.scale<14){closePolygon();return;}}
    S.draft.push([x,y]);render();
  }
});
// native double-click closes the polygon (and we ignore the extra point the 2nd click added)
cv.addEventListener('dblclick',e=>{
  e.preventDefault();
  if(S.dwg!=='treatment'||S.hmode!=='polygon') return;
  // the two clicks of the dblclick added up to 2 points at ~same spot; trim the duplicate then close
  if(S.draft.length>=4){
    const a=S.draft[S.draft.length-1],b=S.draft[S.draft.length-2];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])*S.view.scale<14) S.draft.pop();
  }
  if(S.draft.length>=3) closePolygon();
});
window.addEventListener('mouseup',()=>{panning=false;panStart=null;cv.classList.remove('pan');});
window.addEventListener('mousemove',e=>{
  if(panning&&panStart){
    S.view.ox=panStart.ox+(e.clientX-panStart.x);
    S.view.oy=panStart.oy+(e.clientY-panStart.y);
    applyPan();return;
  }
});
cv.addEventListener('mousemove',e=>{
  if(panning) return;
  if(S.dwg==='treatment'&&S.hmode==='polygon'&&S.draft.length){
    const [x,y]=toImg(e);render();
    ctx.save();ctx.strokeStyle=depthColour(S.colour);ctx.setLineDash([5,4]);ctx.lineWidth=2;
    const last=S.draft[S.draft.length-1];
    ctx.beginPath();ctx.moveTo(last[0]*S.view.scale,last[1]*S.view.scale);
    ctx.lineTo(x*S.view.scale,y*S.view.scale);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    // highlight the first vertex as a close target
    if(S.draft.length>=3){const [fx,fy]=S.draft[0];
      ctx.beginPath();ctx.arc(fx*S.view.scale,fy*S.view.scale,7,0,7);
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();
      ctx.strokeStyle=depthColour(S.colour);ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  }
});
function closePolygon(){
  if(S.draft.length<3){return;}
  const pts=S.draft.slice();
  S.draft=[];
  const p={colour:S.colour, pts, material:S.spec.material, agg:S.spec.agg, depthMM:S.spec.depthMM};
  S.polys.push(p);saveLocal();
  renderAreaList();
  render();
  toast('Area added: '+areaLabel(p));
}
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){S.draft=[];render();}
  if(e.key==='Enter'&&S.draft.length>=3)closePolygon();});

cv.parentElement.parentElement.addEventListener('wheel',e=>{
  e.preventDefault();const f=e.deltaY<0?1.12:0.89;
  S.view.scale=Math.max(0.1,Math.min(6,S.view.scale*f));resizeCanvas();render();applyPan();},{passive:false});
cv.addEventListener('contextmenu',e=>{if(e.button===1)e.preventDefault();});
$('zin').onclick=()=>{S.view.scale=Math.min(6,S.view.scale*1.2);resizeCanvas();render();applyPan();};
$('zout').onclick=()=>{S.view.scale=Math.max(0.1,S.view.scale*0.83);resizeCanvas();render();applyPan();};
$('zfit').onclick=fit;
$('zpan').onclick=()=>{S.view.ox=0;S.view.oy=0;applyPan();};

let currentAsset='SW';
sel.onchange=()=>{S.key=sel.value;$('stTitle').textContent=D[S.key].title;loadImage();};

const DWG_TITLES={treatment:'Resurfacing Instruction', ironwork:'Ironwork Instruction'};
function setDwg(dwg){
  S.dwg=dwg;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on', x.dataset.dwg===dwg));
  $('treatPanel').style.display=dwg==='treatment'?'':'none';
  $('ironPanel').style.display=dwg==='ironwork'?'':'none';
  const st=$('stDwg');
  if(dwg==='treatment'){st.textContent='001 TREATMENT';st.className='pill t';S.tb.drwgNo='001';}
  else{st.textContent='002 IRONWORK';st.className='pill i';S.tb.drwgNo='002';}
  // auto-swap drawing title only while it still holds a standard value
  const stdTitles=['Resurfacing Instruction','Ironwork Instruction',''];
  if(stdTitles.includes(S.tb.drawingTitle||'')) S.tb.drawingTitle=DWG_TITLES[dwg];
  syncTBInputs();updateLegend();renderAreaList();renderQsList();render();
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ setDwg(t.dataset.dwg); saveLocal(); });
document.querySelectorAll('.sw').forEach(s=>s.onclick=()=>{
  document.querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));
  s.classList.add('on');S.colour=+s.dataset.colour;updateLegend();render();});
// populate depth dropdown 10-100mm
(function(){const d=$('specDepth');for(let mm=10;mm<=100;mm+=10){
  const o=document.createElement('option');o.value=mm+'mm';o.textContent=mm+'mm';
  if(mm===40)o.selected=true;d.appendChild(o);} S.spec.depthMM='40mm';})();
$('specMaterial').onchange=e=>{S.spec.material=e.target.value;};
$('specAgg').onchange=e=>{S.spec.agg=e.target.value;};
$('specDepth').onchange=e=>{S.spec.depthMM=e.target.value;};
// quick key-entry spec (pre-drawn hatch)
const qsSpec={material:'Taycoat (FW)', agg:'10mm', depthMM:'40mm'}; let qsColour=1;
(function(){const d=$('qsDepth');for(let mm=10;mm<=100;mm+=10){
  const o=document.createElement('option');o.value=mm+'mm';o.textContent=mm+'mm';
  if(mm===40)o.selected=true;d.appendChild(o);} qsSpec.depthMM='40mm';})();
$('qsMaterial').onchange=e=>{qsSpec.material=e.target.value;};
$('qsAgg').onchange=e=>{qsSpec.agg=e.target.value;};
$('qsDepth').onchange=e=>{qsSpec.depthMM=e.target.value;};
document.querySelectorAll('[data-qsc]').forEach(s=>s.onclick=()=>{
  document.querySelectorAll('[data-qsc]').forEach(x=>x.classList.remove('on'));
  s.classList.add('on'); qsColour=+s.dataset.qsc;});
$('addQsBtn').onclick=()=>{
  S.quickSpecs.push({material:qsSpec.material, agg:qsSpec.agg, depthMM:qsSpec.depthMM, colour:qsColour});
  renderQsList(); render(); saveLocal();
  toast('Added to key: '+areaLabel(qsSpec));
};
$('clearQsBtn').onclick=()=>{S.quickSpecs=[];renderQsList();render();saveLocal();toast('Key entries cleared');};
document.querySelectorAll('.mode').forEach(m=>m.onclick=()=>{
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('on'));
  m.classList.add('on');S.hmode=m.dataset.hmode;S.recolourBlue=(S.hmode==='recolour');
  $('hatchHint').textContent=S.hmode==='polygon'
    ?'Click points around the area; double-click, press Enter, or click the first point to close. Esc cancels.'
    :'Recolour: with BLUE selected, the printed red hatch is shown in blue.';
  _blueCache=null;render();});
document.querySelectorAll('.asset').forEach(a=>a.onclick=()=>{
  document.querySelectorAll('.asset').forEach(x=>x.classList.remove('on'));
  a.classList.add('on');currentAsset=a.dataset.asset;});
$('undoPoly').onclick=()=>{if(S.draft.length)S.draft.pop();else S.polys.pop();renderAreaList();render();saveLocal();};
$('clearPoly').onclick=()=>{S.polys=[];S.draft=[];renderAreaList();render();saveLocal();toast('Areas cleared');};
$('clearAssets').onclick=()=>{S.assets=[];render();toast('Assets cleared');};
$('undoAsset').onclick=()=>{S.assets.pop();render();saveLocal();};

const TBINPUTS=['projectTitle','drawingTitle','drwgNo','suitability','revision','projectRef',
  'drawn','checked','approved','scale','date','rev','revDesc','revInit','revDate'];
TBINPUTS.forEach(k=>{const el=$('tb_'+k);if(el)el.oninput=()=>{S.tb[k]=el.value;render();saveLocal();};});
function syncTBInputs(){TBINPUTS.forEach(k=>{const el=$('tb_'+k);if(el)el.value=S.tb[k]||'';});}

$('resetBtn').onclick=()=>{S.polys=[];S.draft=[];S.assets=[];S.quickSpecs=[];renderAreaList();renderQsList();render();saveLocal();toast('Reset annotations');};
$('exportBtn').onclick=exportPDF;
$('exportBothBtn').onclick=exportBothPDF;
$('saveProjBtn').onclick=saveProjectFile;
$('loadProjBtn').onclick=()=>$('projFile').click();
$('projFile').onchange=e=>{ if(e.target.files[0]) loadProjectFile(e.target.files[0]); e.target.value=''; };
$('pickerBtn').onclick=()=>openPicker();

// ---- sketch picker / start screen ----
const CD = window.CONSTRUCTION_DATES || {};
const TYPES = window.SKETCH_TYPES || {};
// drawing-type badge shown on picker cards; untyped sketches show nothing
const TYPE_BADGE = {footway:['fw','FOOTWAY'], cw4:['cw','CW CAT4']};
function typeBadge(n){
  const b = TYPE_BADGE[TYPES[n]];
  return b ? ' <span class="ptype '+b[0]+'">'+b[1]+'</span>' : '';
}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso){
  if(!iso) return 'TBC';
  const d=new Date(iso);
  return 'w/c '+d.getDate()+' '+MONTHS[d.getMonth()]+' \''+String(d.getFullYear()).slice(2);
}
// completion / other-designer state — stored independently of project data
const LS_DONE='rmp_done_', LS_OTHER='rmp_other_';
function isDone(key){ try{ return !!localStorage.getItem(LS_DONE+key); }catch(e){ return false; } }
function setDone(key,v){ try{ v?localStorage.setItem(LS_DONE+key,'1'):localStorage.removeItem(LS_DONE+key); }catch(e){} }
function isOther(key){ try{ return !!localStorage.getItem(LS_OTHER+key); }catch(e){ return false; } }
function setOther(key,v){ try{ v?localStorage.setItem(LS_OTHER+key,'1'):localStorage.removeItem(LS_OTHER+key); }catch(e){} }

let pickerTab='active';

function buildPicker(filter){
  const grid=$('pickerGrid'); grid.innerHTML='';
  const f=(filter||'').toLowerCase();
  let filtered=names.filter(n=>D[n].title.toLowerCase().includes(f));
  // sort: soonest date first; undated last alphabetically
  filtered.sort((a,b)=>{
    const da=CD[a]||null, db=CD[b]||null;
    if(da&&db) return da.localeCompare(db);
    if(da) return -1; if(db) return 1;
    return D[a].title.localeCompare(D[b].title);
  });
  // filter by active tab
  if(pickerTab==='complete') filtered=filtered.filter(n=>isDone(n));
  else if(pickerTab==='other') filtered=filtered.filter(n=>isOther(n));
  else filtered=filtered.filter(n=>!isDone(n)&&!isOther(n));

  filtered.forEach(n=>{
    const done=isDone(n), other=isOther(n);
    const card=document.createElement('div');
    card.className='pcard'+(done?' done':other?' other-designer':'');
    const started=hasLocal(n);
    const dateStr=fmtDate(CD[n]||null);
    const isTbc=!CD[n];
    card.innerHTML=
      '<div class="pname">'+D[n].title+typeBadge(n)+'</div>'+
      '<div class="pmeta">'+(started?'In progress':'Not started')+'</div>'+
      '<div class="pcard-foot">'+
        '<div class="pdate'+(isTbc?' tbc':'')+'">⬦ '+dateStr+'</div>'+
      '</div>'+
      (started?'<div class="ptag">SAVED</div>':'');

    // two tick buttons — mutually exclusive
    const pair=document.createElement('div'); pair.className='tick-pair';

    const tickC=document.createElement('button');
    tickC.className='tick-btn complete'+(done?' on':'');
    tickC.textContent='✓'; tickC.title=done?'Unmark complete':'Mark complete';
    tickC.onclick=e=>{
      e.stopPropagation();
      const nd=!isDone(n); setDone(n,nd); if(nd) setOther(n,false);
      buildPicker($('pickerSearch').value);
    };

    const tickO=document.createElement('button');
    tickO.className='tick-btn other'+(other?' on':'');
    tickO.textContent='✓'; tickO.title=other?'Unmark other designer':'Mark as other designer';
    tickO.onclick=e=>{
      e.stopPropagation();
      const no=!isOther(n); setOther(n,no); if(no) setDone(n,false);
      buildPicker($('pickerSearch').value);
    };

    pair.appendChild(tickC); pair.appendChild(tickO);
    card.querySelector('.pcard-foot').appendChild(pair);
    card.onclick=()=>chooseSketch(n);
    grid.appendChild(card);
  });

  // update tab active states and counts
  document.querySelectorAll('.ptab').forEach(t=>{
    t.classList.toggle('on', t.dataset.tab===pickerTab);
  });
}
function openPicker(){ buildPicker($('pickerSearch').value); $('picker').classList.remove('hidden'); }
function closePicker(){ $('picker').classList.add('hidden'); }
$('homeBtn').onclick=openPicker;
$('pickerClose').onclick=closePicker;
document.querySelectorAll('.ptab').forEach(t=>t.onclick=()=>{
  pickerTab=t.dataset.tab; buildPicker($('pickerSearch').value);
});
function chooseSketch(n){
  $('picker').classList.add('hidden');
  $('pickerClose').classList.remove('hidden');
  S.key=n; sel.value=n;
  $('stTitle').textContent=D[n].title;
  loadImage(()=>{
    // restore saved work for this sketch if present, else fresh
    if(!loadLocal(n, ()=>saveLocal())){
      S.polys=[];S.assets=[];S.draft=[];S.quickSpecs=[];S.tb=blankTB(D[n].title);
      setDwg('treatment'); syncTBInputs(); renderAreaList(); renderQsList(); render();
    }
  });
}
$('pickerSearch').oninput=e=>buildPicker(e.target.value);

// ---- state object (used by snippet, project file, and autosave) ----
function stateObject(){
  const fx=v=>+(v/S.baseW).toFixed(4), fy=v=>+(v/S.baseH).toFixed(4);
  return {
    v:1, sketch:S.key, dwg:S.dwg, tb:S.tb,
    polys:S.polys.map(p=>({c:p.colour, m:p.material, a:p.agg, d:p.depthMM,
      pts:p.pts.map(pt=>[fx(pt[0]),fy(pt[1])])})),
    assets:S.assets.map(a=>({t:a.type, x:fx(a.x), y:fy(a.y)})),
    quickSpecs:(S.quickSpecs||[]).map(p=>({m:p.material, a:p.agg, d:p.depthMM, c:p.colour}))
  };
}
function serialiseState(){ return 'RMPDATA:'+JSON.stringify(stateObject()); }
// apply a parsed/string state. If switchSketch is false, keep current sketch image.
function applyStateObj(obj, cb){
  if(obj.tb) S.tb=Object.assign(blankTB(), obj.tb);
  if(obj.dwg) S.dwg=obj.dwg;
  const finish=()=>{
    const ux=f=>f*S.baseW, uy=f=>f*S.baseH;
    S.polys=(obj.polys||[]).map(p=>({colour:p.c||1, material:p.m||'', agg:p.a||'', depthMM:p.d||'',
      pts:(p.pts||[]).map(pt=>[ux(pt[0]),uy(pt[1])])}));
    S.assets=(obj.assets||[]).map(a=>({type:a.t, x:ux(a.x), y:uy(a.y)}));
    S.quickSpecs=(obj.quickSpecs||[]).map(p=>({material:p.m||'', agg:p.a||'', depthMM:p.d||'', colour:p.c||1}));
    // backfill standard fields that are missing or blank in older saved data
    if(!S.tb.drawn)       S.tb.drawn='JMCA';
    if(!S.tb.checked)     S.tb.checked='SL';
    if(!S.tb.approved)    S.tb.approved='SL';
    if(!S.tb.revision)    S.tb.revision='R0';
    if(!S.tb.projectTitle && D[S.key]) S.tb.projectTitle=D[S.key].title+' Resurfacing';
    if(!S.tb.drawingTitle) S.tb.drawingTitle=DWG_TITLES[S.dwg]||'Resurfacing Instruction';
    setDwg(S.dwg); syncTBInputs(); renderAreaList(); renderQsList(); render(); cb&&cb();
  };
  if(obj.sketch && D[obj.sketch] && obj.sketch!==S.key){
    S.key=obj.sketch; sel.value=S.key; loadImage(finish);
  } else { finish(); }
}
function applyState(str){
  let raw=str.trim();
  if(raw.indexOf('RMPDATA:')===0) raw=raw.slice(8);
  applyStateObj(JSON.parse(raw));
}

// ---- autosave to localStorage, keyed per sketch ----
const LS_PREFIX='rmp_dwg_';
let _saveTimer=null;
function saveLocal(){
  try{
    clearTimeout(_saveTimer);
    _saveTimer=setTimeout(()=>{
      localStorage.setItem(LS_PREFIX+S.key, JSON.stringify(stateObject()));
    },300);
  }catch(e){}
}
function loadLocal(key, cb){
  try{
    const raw=localStorage.getItem(LS_PREFIX+key);
    if(raw){ applyStateObj(JSON.parse(raw), cb); return true; }
  }catch(e){}
  return false;
}
function hasLocal(key){ try{ return !!localStorage.getItem(LS_PREFIX+key); }catch(e){ return false; } }

// ---- project file (.json) save / load ----
function saveProjectFile(){
  const data=JSON.stringify(stateObject(),null,1);
  downloadBytes(new TextEncoder().encode(data), (D[S.key].title.replace(/\s+/g,'_'))+'.rmp.json','application/json');
  toast('Project saved');
}
function loadProjectFile(file){
  const fr=new FileReader();
  fr.onload=()=>{ try{ applyStateObj(JSON.parse(fr.result), ()=>{saveLocal();toast('Project loaded');}); }
    catch(e){ toast('Invalid project file'); } };
  fr.readAsText(file);
}

$('copyDataBtn').onclick=()=>{
  const snippet=serialiseState();
  const done=()=>showTextModal('Copy this whole block and paste it to Claude:', snippet, true);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(snippet).then(()=>{toast('Copied'); done();}, done);
  } else { done(); }
};
$('loadDataBtn').onclick=()=>{
  showTextModal('Paste an RMPDATA snippet here, then click Load:', '', false, txt=>{
    try{ applyState(txt); saveLocal(); toast('Data loaded'); }
    catch(e){ toast('Could not read that data'); }
  });
};

// simple modal with a textarea (for copy out / paste in)
function showTextModal(label, value, readOnly, onLoad){
  let ov=document.getElementById('txtModal'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='txtModal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(8,10,13,.82);z-index:99999;'+
    'display:flex;align-items:center;justify-content:center;padding:20px;font:14px "IBM Plex Sans",sans-serif';
  const card=document.createElement('div');
  card.style.cssText='background:#21262d;border:1px solid #000;border-radius:10px;padding:18px;'+
    'width:min(92vw,620px);display:flex;flex-direction:column;gap:10px;color:#e8eaed';
  const h=document.createElement('div'); h.textContent=label;
  h.style.cssText='font:600 13px "IBM Plex Mono",monospace';
  const ta=document.createElement('textarea'); ta.value=value; ta.readOnly=!!readOnly;
  ta.style.cssText='width:100%;height:200px;background:#0e1115;color:#e8eaed;border:1px solid #2b323b;'+
    'border-radius:6px;padding:10px;font:12px "IBM Plex Mono",monospace;resize:vertical';
  if(readOnly){ setTimeout(()=>{ta.focus();ta.select();},50); }
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;justify-content:flex-end';
  if(readOnly){
    const sel2=document.createElement('button'); sel2.textContent='Select all';
    sel2.style.cssText=btnCss('#3a424c'); sel2.onclick=()=>{ta.focus();ta.select();};
    row.appendChild(sel2);
  } else {
    const load=document.createElement('button'); load.textContent='Load';
    load.style.cssText=btnCss('#e8472b'); load.onclick=()=>{onLoad&&onLoad(ta.value); ov.remove();};
    row.appendChild(load);
  }
  const close=document.createElement('button'); close.textContent='Close';
  close.style.cssText=btnCss('#3a424c'); close.onclick=()=>ov.remove();
  row.appendChild(close);
  card.appendChild(h); card.appendChild(ta); card.appendChild(row);
  ov.appendChild(card); document.body.appendChild(ov);
}
function btnCss(bg){return 'background:'+bg+';color:#fff;border:0;padding:9px 16px;border-radius:6px;'+
  'font:600 12px "IBM Plex Mono",monospace;cursor:pointer';}

function updateLegend(){const L=$('legend');
  if(S.dwg==='treatment')
    L.innerHTML='<div><i style="background:#c81e0a"></i>Red hatch</div><div><i style="background:#1450c8"></i>Blue hatch</div>';
  else
    L.innerHTML='<div><i style="border:1.5px solid #000;background:#fff"></i>Box = exact location</div><div>Text (NE) = asset ID</div>';}

function makeSelect(options,val,onChange){
  const s=document.createElement('select');
  options.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;
    if(o===val)op.selected=true;s.appendChild(op);});
  s.onchange=()=>onChange(s.value);
  return s;
}
const MATERIALS=['Taypave','SMA','HRA','Taycoat (FW)'];
const AGGS=['6mm','10mm','14mm'];
const DEPTHS=Array.from({length:10},(_,i)=>((i+1)*10)+'mm');
function renderAreaList(){
  const list=$('areaList'), empty=$('areaEmpty'), count=$('areaCount');
  if(!list) return;
  count.textContent = S.polys.length ? '('+S.polys.length+')' : '';
  empty.style.display = S.polys.length ? 'none' : '';
  list.innerHTML='';
  S.polys.forEach((p,i)=>{
    const row=document.createElement('div'); row.className='arow'; row.style.flexWrap='wrap';
    // colour dot — click toggles red<->blue
    const dot=document.createElement('div'); dot.className='dot';
    dot.style.background=depthColour(p.colour);
    dot.title='Hatch colour — click to switch red/blue';
    dot.onclick=()=>{p.colour=p.colour===2?1:2; renderAreaList(); render(); saveLocal();};
    // delete
    const del=document.createElement('button'); del.className='x'; del.textContent='\u00d7';
    del.title='Delete area';
    del.onclick=()=>{S.polys.splice(i,1); renderAreaList(); render(); saveLocal();};
    // three dropdowns
    const mSel=makeSelect(MATERIALS,p.material,v=>{p.material=v;render();renderAreaList();saveLocal();});
    const aSel=makeSelect(AGGS,p.agg,v=>{p.agg=v;render();renderAreaList();saveLocal();});
    const dSel=makeSelect(DEPTHS,p.depthMM,v=>{p.depthMM=v;render();renderAreaList();saveLocal();});
    mSel.style.flex='1 1 100%';
    aSel.style.flex='1';dSel.style.flex='1';
    row.appendChild(dot); row.appendChild(mSel); row.appendChild(aSel); row.appendChild(dSel); row.appendChild(del);
    list.appendChild(row);
  });
}

function renderQsList(){
  const list=$('qsList'); if(!list) return;
  list.innerHTML='';
  (S.quickSpecs||[]).forEach((p,i)=>{
    const row=document.createElement('div'); row.className='arow';
    const dot=document.createElement('div'); dot.className='dot';
    dot.style.background=depthColour(p.colour);
    dot.title='Click to toggle red/blue';
    dot.onclick=()=>{p.colour=p.colour===2?1:2;renderQsList();render();saveLocal();};
    const lbl=document.createElement('span');
    lbl.style.cssText='flex:1;font:600 11px "IBM Plex Mono",monospace;color:var(--txt)';
    lbl.textContent=areaLabel(p);
    const del=document.createElement('button'); del.className='x'; del.textContent='×';
    del.title='Remove from key';
    del.onclick=()=>{S.quickSpecs.splice(i,1);renderQsList();render();saveLocal();};
    row.appendChild(dot); row.appendChild(lbl); row.appendChild(del);
    list.appendChild(row);
  });
}

function renderJpegBytes(){
  const full=composite(2);
  const b64=full.toDataURL('image/jpeg',0.9).split(',')[1];
  const bin=atob(b64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return {bytes, w:full.width, h:full.height};
}
function fnameFor(dwg){
  const no=dwg==='treatment'?'001':'002';
  const t=dwg==='treatment'?'Treatment_Drawing':'Ironwork';
  return D[S.key].title.replace(/\s+/g,'_')+'_'+no+'_'+t;
}
function downloadBytes(bytes, filename, mime){
  const blob=new Blob([bytes],{type:mime||'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
// export the CURRENT drawing as a 1-page PDF
function exportPDF(){
  try{
    const img=renderJpegBytes();
    const pdf=buildPDF([img]);
    downloadBytes(pdf, fnameFor(S.dwg)+'.pdf');
    toast('Exported '+fnameFor(S.dwg)+'.pdf');
  }catch(err){ console.error(err); toast('Export failed — see console'); }
}
// export BOTH 001 and 002 as a single 2-page PDF
function exportBothPDF(){
  try{
    const startDwg=S.dwg;
    // render treatment page
    setDwg('treatment'); const p1=renderJpegBytes();
    // render ironwork page
    setDwg('ironwork'); const p2=renderJpegBytes();
    setDwg(startDwg); // restore
    const pdf=buildPDF([p1,p2]);
    const base=D[S.key].title.replace(/\s+/g,'_');
    downloadBytes(pdf, base+'_001-002.pdf');
    toast('Exported both drawings');
  }catch(err){ console.error(err); toast('Export failed — see console'); }
}
function bytesToBase64(bytes){
  let bin=''; const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) bin+=String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
  return btoa(bin);
}

// Build a multi-page PDF (A4 landscape) embedding one JPEG per page, no libraries.
// pages: array of { bytes:Uint8Array(jpeg), w, h }
function buildPDF(pages){
  const pageW=842, pageH=595, margin=18;
  const enc=new TextEncoder();
  const chunks=[]; let len=0; const offsets=[];
  function push(data){ const bytes=(typeof data==='string')?enc.encode(data):data; chunks.push(bytes); len+=bytes.length; }

  push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  // object numbering: 1=catalog, 2=pages, then per page: pageObj, imgObj, contentObj
  const n=pages.length;
  const kids=[];
  // we assign: page i uses objects  (3 + i*3), (4 + i*3), (5 + i*3)
  for(let i=0;i<n;i++) kids.push((3+i*3)+' 0 R');

  offsets[1]=len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets[2]=len; push('2 0 obj\n<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+n+' >>\nendobj\n');

  for(let i=0;i<n;i++){
    const pg=pages[i];
    const pageObj=3+i*3, imgObj=4+i*3, contObj=5+i*3;
    const availW=pageW-2*margin, availH=pageH-2*margin;
    const scale=Math.min(availW/pg.w, availH/pg.h);
    const dw=pg.w*scale, dh=pg.h*scale, dx=(pageW-dw)/2, dy=(pageH-dh)/2;
    offsets[pageObj]=len;
    push(pageObj+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] '+
      '/Resources << /XObject << /Im'+i+' '+imgObj+' 0 R >> >> /Contents '+contObj+' 0 R >>\nendobj\n');
    offsets[imgObj]=len;
    push(imgObj+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+pg.w+' /Height '+pg.h+
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+pg.bytes.length+' >>\nstream\n');
    push(pg.bytes);
    push('\nendstream\nendobj\n');
    const content='q\n'+dw.toFixed(2)+' 0 0 '+dh.toFixed(2)+' '+dx.toFixed(2)+' '+dy.toFixed(2)+' cm\n/Im'+i+' Do\nQ\n';
    offsets[contObj]=len;
    push(contObj+' 0 obj\n<< /Length '+enc.encode(content).length+' >>\nstream\n'+content+'endstream\nendobj\n');
  }

  const total=2+n*3; // highest object number used
  const xrefStart=len;
  let xref='xref\n0 '+(total+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<=total;i++){ xref+=String(offsets[i]||0).padStart(10,'0')+' 00000 n \n'; }
  push(xref);
  push('trailer\n<< /Size '+(total+1)+' /Root 1 0 R >>\nstartxref\n'+xrefStart+'\n%%EOF');

  const out=new Uint8Array(len); let p=0;
  for(const c of chunks){ out.set(c,p); p+=c.length; }
  return out;
}

function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800);}
window.addEventListener('resize',()=>{resizeCanvas();render();});

// boot: show the sketch picker; a sketch loads only once chosen
updateLegend();
buildPicker('');

// ── RMP Studio integration: pre-populate from URL params ──────────────────
(function(){
  var p = new URLSearchParams(window.location.search);
  var sketchParam = p.get('sketch');
  if (!sketchParam || !D[sketchParam]) return; // no valid sketch → show picker (default)

  var titleParam  = p.get('title');
  var refParam    = p.get('ref');
  var drawnParam  = p.get('drawn');
  var dateParam   = p.get('date');

  function applyUrlParams(){
    if (titleParam) S.tb.projectTitle = titleParam;
    if (refParam)   S.tb.projectRef   = refParam;
    if (drawnParam) S.tb.drawn        = drawnParam;
    if (dateParam)  S.tb.date         = dateParam;
    syncTBInputs(); render();
  }

  // Bypass picker: auto-select sketch from URL param
  $('picker').classList.add('hidden');
  $('pickerClose').classList.remove('hidden');
  S.key = sketchParam; sel.value = sketchParam;
  $('stTitle').textContent = D[sketchParam].title;
  loadImage(function(){
    if (!loadLocal(sketchParam, function(){ applyUrlParams(); saveLocal(); })) {
      S.polys=[]; S.assets=[]; S.draft=[]; S.quickSpecs=[]; S.tb=blankTB(D[sketchParam].title);
      setDwg('treatment'); renderAreaList(); renderQsList();
      applyUrlParams();
    }
  });
})();
})();
