/* Versão compartilhada: botão PDF. Monta a página de impressão no próprio navegador (sem biblioteca) e abre o
   "Imprimir" do sistema, onde a pessoa escolhe "Salvar como PDF". Usa o que está filtrado na tela: camadas
   (chips), período e lado. Usa as variáveis do app.js (BANDS, CAD, vis, LM, mFrom, mTo, mLab, sf, KM0, KM1, fm). */
(function(){
  const MESC=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fd=s=>s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4), fdc=s=>s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(2,4);
  const estTxt=m=>{const e=Math.floor(m/20+1e-9),r=Math.round((m-e*20)*10)/10;return fm(e)+(r?' + '+fm(r,r%1?1:0):'');};
  const kmTxt=k=>{const w=Math.floor(k+1e-9),f=Math.round((k-w)*1000);return w+'+'+String(f).padStart(3,'0');};
  const ladoTxt=s=>s==='D/E'?'D/E':s==='C'?'Eixo':s;
  const eq=b=>b.ext*(b.side==='D/E'?1:.5);
  const COR=lay=>lay==='capa'?'#17181B':(LM[lay]&&LM[lay].cor)||'#152D4A';

  function filtros(){
    const t=[`Período ${mLab(mFrom)} a ${mLab(mTo)}`];
    if(sf)t.push('Lado '+sf);
    const off=['capa','rec'].filter(id=>LM[id]&&hid.has(id)).map(id=>LM[id].nm);
    if(off.length)t.push('sem '+off.join(' e '));
    return t.join(' · ');
  }
  function cab(){
    const br=CAD.br&&CAD.uf?CAD.br+'/'+CAD.uf:(CAD.br||'');
    return {br,ctr:[CAD.contrato,CAD.sigla].filter(Boolean).join(' · '),km:`km ${kmTxt(CAD.kmObraInicial??KM0)} ao ${kmTxt(CAD.kmObraFinal??KM1)}`,
      hoje:new Date().toLocaleDateString('pt-BR'),fonte:CAD.fonteDados||''};
  }
  const CSS_BASE=`*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,'Liberation Sans','Helvetica Neue',sans-serif;color:#0F172A;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.5mm solid #0F172A;padding-bottom:2mm;margin-bottom:3mm;gap:6mm}
.hd h1{font-size:14pt;letter-spacing:-.01em;line-height:1.15}.hd h1 span{font-weight:400;color:#475569}
.hd .m{font-size:7.5pt;color:#475569;margin-top:1mm}.hd .r{text-align:right;font-size:7.5pt;color:#475569;line-height:1.5;white-space:nowrap}.hd .r b{color:#0F172A;font-size:9pt}
.ft{display:flex;justify-content:space-between;font-size:6.5pt;color:#64748B;gap:6mm}
.aviso{font-family:Arial,sans-serif;font-size:13px;background:#FEF3C7;color:#78350F;padding:10px 14px;text-align:center}
@media print{.aviso{display:none}}`;

  /* ── 1) Mapa linear em folhas A4 deitadas: 4 segmentos de 11 km por folha ── */
  function htmlMapa(){
    const SEG=11,POR=4,c=cab();
    const B=BANDS.filter(vis).map(b=>({lay:b.lay,a:b.km0,b:b.km1,side:b.side,data:b.data,ext:b.ext})).sort((x,y)=>(x.lay==='capa')-(y.lay==='capa')||x.a-y.a);
    const tem=id=>B.some(b=>b.lay===id);
    const kmCapa=B.filter(b=>b.lay==='capa').reduce((s,b)=>s+eq(b),0)/1000,kmRec=B.filter(b=>b.lay==='rec').reduce((s,b)=>s+eq(b),0)/1000;
    const nCapa=B.filter(b=>b.lay==='capa').length,nRec=B.filter(b=>b.lay==='rec').length;
    const segs=[];for(let k=KM0;k<KM1-1e-9;k+=SEG)segs.push([k,Math.min(k+SEG,KM1)]);
    /* medidas em mm: pista (CBUQ, E acima e D abaixo) e, embaixo dela, a faixa estreita da reciclagem */
    const W=262,GR=3,ED=.45,RH=16,RC=4.2,GAP=1.2,H=GR*2+ED*2+RH;
    const yR=GR+ED,hL=RH/2,yRec=H+GAP;
    function svg([k0,k1]){
      const sc=W/(k1-k0),X=k=>(k-k0)*sc;let s='';
      const vis_=B.filter(b=>b.b>k0&&b.a<k1),cl=b=>[Math.max(b.a,k0),Math.min(b.b,k1)];
      s+=`<rect x="0" y="0" width="${W}" height="${GR}" fill="#9DBDB3"/><rect x="0" y="${H-GR}" width="${W}" height="${GR}" fill="#9DBDB3"/>`;
      s+=`<rect x="0" y="${yR}" width="${W}" height="${RH}" fill="#B4B8BF"/>`;
      s+=`<rect x="0" y="${GR}" width="${W}" height="${ED}" fill="#fff"/><rect x="0" y="${GR+ED+RH}" width="${W}" height="${ED}" fill="#fff"/>`;
      s+=`<line x1="0" x2="${W}" y1="${yR+hL}" y2="${yR+hL}" stroke="#fff" stroke-opacity=".75" stroke-width=".35" stroke-dasharray="2.2 1.6"/>`;
      for(const b of vis_.filter(b=>b.lay==='capa')){const[a,e]=cl(b),x=X(a),w=Math.max(X(e)-x,.25);
        const y=b.side==='D'?yR+hL:yR,h=b.side==='D/E'||b.side==='C'?RH:hL;
        s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COR('capa')}"/>`;}
      for(const b of vis_.filter(b=>b.lay==='capa')){const[a,e]=cl(b);
        s+=`<line x1="${X(a)}" x2="${X(e)}" y1="${yR+hL}" y2="${yR+hL}" stroke="#FBBF24" stroke-width=".4" stroke-dasharray="1.8 1.4"/>`;}
      for(const b of vis_.filter(b=>b.lay==='capa')){const[a,e]=cl(b),w=X(e)-X(a);if(w<11)continue;
        const cy=b.side==='E'?yR+hL/2:b.side==='D'?yR+hL*1.5:yR+hL/2;
        s+=`<text x="${X(a)+w/2}" y="${cy+.9}" text-anchor="middle" font-size="2.6" fill="#fff" font-weight="700">${fdc(b.data)}</text>`;}
      if(tem('rec')){
        s+=`<rect x="0" y="${yRec}" width="${W}" height="${RC}" fill="#E2E8F0"/>`;
        s+=`<line x1="0" x2="${W}" y1="${yRec+RC/2}" y2="${yRec+RC/2}" stroke="#fff" stroke-width=".25"/>`;
        for(const b of vis_.filter(b=>b.lay==='rec')){const[a,e]=cl(b),x=X(a),w=Math.max(X(e)-x,.25);
          const y=b.side==='D'?yRec+RC/2:yRec,h=b.side==='D/E'||b.side==='C'?RC:RC/2;
          s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COR('rec')}"/>`;}
        s+=`<text x="-1.3" y="${yRec+RC/2+.8}" text-anchor="end" font-size="2.2" fill="#64748B" font-weight="700">REC</text>`;
      }
      const yA=(tem('rec')?yRec+RC:H)+.8;
      s+=`<line x1="0" x2="${W}" y1="${yA}" y2="${yA}" stroke="#334155" stroke-width=".3"/>`;
      for(let k=Math.ceil(k0*10-1e-9)/10;k<=k1+1e-9;k=Math.round((k+.1)*10)/10){
        const x=X(k),int=Math.abs(k-Math.round(k))<1e-9,meio=Math.abs(k*2-Math.round(k*2))<1e-9;
        s+=`<line x1="${x}" x2="${x}" y1="${yA}" y2="${yA+(int?2.3:meio?1.5:.8)}" stroke="#334155" stroke-width="${int?.35:.2}"/>`;
        if(int)s+=`<text x="${x}" y="${yA+5.2}" text-anchor="${k<=k0+1e-9?'start':k>=k1-1e-9?'end':'middle'}" font-size="2.8" fill="#0F172A" font-weight="700">${Math.round(k)}</text>`;
      }
      s+=`<text x="${W+1.2}" y="${yA+5.2}" font-size="2.4" fill="#64748B">km</text>`;
      s+=`<text x="-1.3" y="${yR+hL/2+.8}" text-anchor="end" font-size="2.5" fill="#64748B" font-weight="700">E</text><text x="-1.3" y="${yR+hL*1.5+.8}" text-anchor="end" font-size="2.5" fill="#64748B" font-weight="700">D</text>`;
      const HT=yA+7;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 0 ${W+12} ${HT}" width="${W+12}mm" height="${HT}mm">${s}</svg>`;
    }
    const pags=[];for(let i=0;i<segs.length;i+=POR)pags.push(segs.slice(i,i+POR));
    const resumo=[nCapa?`${fm(nCapa)} trechos de CBUQ · ${fm(kmCapa,1)} km`:'',nRec?`${fm(nRec)} de reciclagem · ${fm(kmRec,1)} km`:''].filter(Boolean).join(' · ')||'Nenhum trecho no filtro';
    const conta=(sg,id)=>B.filter(b=>b.lay===id&&b.b>sg[0]&&b.a<sg[1]).length;
    const lg=[tem('capa')||!tem('rec')?`<span><i style="background:${COR('capa')}"></i>Revestimento (CBUQ), com a data de execução</span>`:'',
      tem('rec')?`<span><i style="background:${COR('rec')}"></i>Reciclagem (faixa REC, abaixo da pista)</span>`:'',
      `<span><i style="background:#B4B8BF"></i>Sem o serviço</span>`,`<span>E = lado esquerdo (acima) · D = lado direito (abaixo) · km crescendo para a direita · km de pista inteira equivalente</span>`].join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Mapa Linear ${esc(c.br)} - Revestimento e Reciclagem</title><style>
@page{size:A4 landscape;margin:0}${CSS_BASE}
.p{width:297mm;height:210mm;padding:9mm 10mm 7mm 12mm;page-break-after:always;display:flex;flex-direction:column;overflow:hidden}
.p:last-child{page-break-after:auto}
.sg{margin-bottom:1.4mm}.sg .t{font-size:8.3pt;font-weight:700;margin-bottom:.7mm;display:flex;gap:3mm;align-items:baseline}.sg .t small{font-weight:400;color:#64748B;font-size:7pt}
.lg{display:flex;gap:5mm;align-items:center;flex-wrap:wrap;font-size:6.8pt;color:#334155;margin-top:auto;margin-bottom:2mm;padding-top:2mm;border-top:.2mm solid #CBD5E1}
.lg i{display:inline-block;width:7mm;height:3.2mm;vertical-align:middle;margin-right:1.4mm;border-radius:.4mm}
svg{display:block;overflow:visible}
@media screen{body{background:#E2E8F0}.p{background:#fff;margin:12px auto;box-shadow:0 2px 10px rgba(0,0,0,.15)}}
</style></head><body><div class="aviso">Na janela de impressão, escolha <b>Salvar como PDF</b> e o papel <b>A4 paisagem</b>.</div>
${pags.map((pg,pi)=>`<section class="p">
<div class="hd"><div><h1>Mapa Linear <span>· ${esc(c.br)} · Revestimento e reciclagem</span></h1><div class="m">${esc(c.ctr)} · ${c.km} · ${esc(filtros())}</div></div>
<div class="r"><b>${resumo}</b><br>Folha ${pi+1} de ${pags.length}</div></div>
${pg.map(sg=>{const nc=conta(sg,'capa'),nr=conta(sg,'rec');const t=[nc?nc+' de CBUQ':'',nr?nr+' de reciclagem':''].filter(Boolean).join(' · ');
  return `<div class="sg"><div class="t">km ${sg[0]} → ${sg[1]} <small>${t?t.replace(/^(\d+)/,'$1 trechos'):'sem serviço'}</small></div>${svg(sg)}</div>`}).join('')}
<div class="lg">${lg}</div>
<div class="ft"><span>${esc(c.fonte)}</span><span>Gerado em ${c.hoje} · Mapa Linear</span></div>
</section>`).join('')}</body></html>`;
  }

  /* ── 2) Quadro por medição: cada trecho de CBUQ e de reciclagem, agrupado pela medição ── */
  function htmlQuadro(){
    const c=cab();
    const B=BANDS.filter(vis).slice().sort((x,y)=>x.mp-y.mp||(x.lay==='capa')-(y.lay==='capa')||x.data.localeCompare(y.data)||x.m0-y.m0);
    const mps=[...new Set(B.map(b=>b.mp))].sort((a,b)=>a-b);
    const mesDe=s=>MESC[+s.slice(5,7)-1]+'/'+s.slice(0,4);
    const per=l=>{const ds=l.map(b=>b.data).sort();const a=mesDe(ds[0]),z=mesDe(ds[ds.length-1]);return a===z?a:a+' a '+z;};
    const tot=(l,id)=>l.filter(b=>b.lay===id).reduce((s,b)=>s+eq(b),0)/1000;
    const qtdTxt=b=>b.qtd==null?'—':fm(b.qtd,b.lay==='capa'?1:1)+(b.lay==='capa'?' t':' m³');
    const resumo=`<table class="rs"><thead><tr><th>Medição</th><th>Período</th><th>CBUQ<br>(trechos)</th><th>CBUQ<br>(km pista inteira)</th><th>Reciclagem<br>(trechos)</th><th>Reciclagem<br>(km pista inteira)</th></tr></thead><tbody>
${mps.map(mp=>{const l=B.filter(b=>b.mp===mp),nc=l.filter(b=>b.lay==='capa').length,nr=l.filter(b=>b.lay==='rec').length;
  return `<tr><td class="c"><b>${mp}ª</b></td><td class="c">${per(l)}</td><td class="n">${nc||'—'}</td><td class="n">${nc?fm(tot(l,'capa'),2):'—'}</td><td class="n">${nr||'—'}</td><td class="n">${nr?fm(tot(l,'rec'),2):'—'}</td></tr>`;}).join('')}
<tr class="tt"><td class="c" colspan="2">Total</td><td class="n">${B.filter(b=>b.lay==='capa').length}</td><td class="n">${fm(tot(B,'capa'),2)}</td><td class="n">${B.filter(b=>b.lay==='rec').length}</td><td class="n">${fm(tot(B,'rec'),2)}</td></tr></tbody></table>`;
    const linhas=mps.map(mp=>{const l=B.filter(b=>b.mp===mp);
      return `<tr class="gm"><td colspan="11">${mp}ª medição · ${per(l)}</td></tr>`+l.map(b=>`<tr>
<td><span class="dot" style="background:${COR(b.lay)}"></span>${b.lay==='capa'?'Revestimento (CBUQ)':'Reciclagem'}</td><td class="c">${esc(b.item||'—')}</td><td class="c">${fd(b.data)}</td>
<td class="c">${estTxt(b.m0)}</td><td class="c">${estTxt(b.m1)}</td><td class="c">${kmTxt(b.km0)} a ${kmTxt(b.km1)}</td><td class="c">${ladoTxt(b.side)}</td>
<td class="n">${b.ponto?'trevo':fm(b.ext)}</td><td class="n">${b.larg!=null?fm(b.larg,2):'—'}</td><td class="n">${b.esp!=null?fm(b.esp*100,1):'—'}</td><td class="n">${qtdTxt(b)}</td></tr>`).join('');}).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Quadro por medicao ${esc(c.br)} - Revestimento e Reciclagem</title><style>
@page{size:A4 landscape;margin:9mm 10mm 9mm 10mm}${CSS_BASE}
h2{font-size:9.5pt;margin:4mm 0 1.6mm}
table{width:100%;border-collapse:collapse;font-size:7.4pt}
th{background:#1E293B;color:#fff;font-weight:700;padding:1.3mm 1.4mm;text-align:center;font-size:7pt;line-height:1.25}
td{padding:1mm 1.4mm;border-bottom:.2mm solid #E2E8F0;vertical-align:middle}
td.c{text-align:center}td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
thead{display:table-header-group}tr{page-break-inside:avoid}
.rs{width:auto;min-width:60%}.rs .tt td{font-weight:700;border-top:.4mm solid #0F172A;background:#F1F5F9}
.gm td{background:#F1F5F9;font-weight:700;font-size:7.6pt;padding-top:1.6mm;border-bottom:.3mm solid #94A3B8}
.dot{display:inline-block;width:2.4mm;height:2.4mm;border-radius:.5mm;margin-right:1.4mm;vertical-align:-.3mm}
.nt{font-size:6.6pt;color:#64748B;margin-top:2.5mm;line-height:1.5}
.ft{margin-top:3mm}
@media screen{body{padding:12px 16px}}
</style></head><body><div class="aviso">Na janela de impressão, escolha <b>Salvar como PDF</b> e o papel <b>A4 paisagem</b>.</div>
<div class="hd"><div><h1>Quadro por medição <span>· ${esc(c.br)} · Revestimento e reciclagem</span></h1><div class="m">${esc(c.ctr)} · ${c.km} · ${esc(filtros())}</div></div>
<div class="r"><b>${fm(B.length)} trechos</b><br>Gerado em ${c.hoje}</div></div>
<h2>Resumo por medição</h2>${resumo}
<h2>Trechos executados</h2>
<table><thead><tr><th>Solução</th><th>Item</th><th>Data</th><th>Estaca inicial</th><th>Estaca final</th><th>km</th><th>Lado</th><th>Extensão (m)</th><th>Largura (m)</th><th>Espessura (cm)</th><th>Quantidade</th></tr></thead>
<tbody>${linhas||'<tr><td colspan="11" class="c">Nenhum trecho no filtro escolhido.</td></tr>'}</tbody></table>
<p class="nt">km de pista inteira: trecho em um lado só (E ou D) conta como meia pista. Lado D/E = pista inteira. Quantidade: CBUQ em toneladas, reciclagem em m³, como na medição.</p>
<div class="ft"><span>${esc(c.fonte)}</span><span>Mapa Linear</span></div></body></html>`;
  }

  /* Abre a página e chama o Imprimir. Janela nova quando o navegador deixa; senão, um iframe escondido */
  function imprimir(html){
    fechaMenu();
    const w=window.open('','_blank');
    if(w){w.document.open();w.document.write(html);w.document.close();
      const go=()=>{try{w.focus();w.print();}catch(e){}};
      if(w.document.readyState==='complete')setTimeout(go,300);else w.onload=()=>setTimeout(go,300);
      return;}
    const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
    f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
    setTimeout(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),60000);},400);
  }
  function fechaMenu(){const m=document.getElementById('pdfMenu');if(m)m.hidden=true;const b=document.getElementById('bPdf');if(b)b.classList.remove('on');}
  window.pdfMapa=()=>imprimir(htmlMapa());
  window.pdfQuadro=()=>imprimir(htmlQuadro());
  window.pdfMenu=e=>{e.stopPropagation();const m=document.getElementById('pdfMenu'),b=document.getElementById('bPdf');m.hidden=!m.hidden;b.classList.toggle('on',!m.hidden);};
  document.addEventListener('click',e=>{if(!e.target.closest('.pdfw'))fechaMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')fechaMenu();});
})();
