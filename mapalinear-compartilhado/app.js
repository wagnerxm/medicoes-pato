const E2K=(e,f=0)=>(e*20+f)/1000;
const KM0=CAD.kmInicial,KM1=CAD.kmFinal,LEN=KM1-KM0,MAP_PAD=24;
function km2px(km){return(km-KM0)*pk+MAP_PAD;}
function px2km(px){return KM0+(px-MAP_PAD)/pk;}
const fm=(n,d=0)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
function fK(km){const w=Math.floor(km),f=Math.round((km-w)*1000);return w+'+'+String(f).padStart(3,'0');}
/* GEO (geometria da rodovia, [km,lat,lng]) vem de contratos/<id>/geo.json; é opcional: sem ela o cartão não mostra o botão do Google Maps */
/* Interpola coordenadas (lat,lng) a partir de um KM usando busca binária */
function kmToCoord(km){
  if(!GEO.length)return null;
  if(km<=GEO[0][0])return{lat:GEO[0][1],lng:GEO[0][2]};
  if(km>=GEO[GEO.length-1][0])return{lat:GEO[GEO.length-1][1],lng:GEO[GEO.length-1][2]};
  let lo=0,hi=GEO.length-1;
  while(lo<hi-1){const m=(lo+hi)>>1;GEO[m][0]<=km?lo=m:hi=m;}
  const a=GEO[lo],b=GEO[hi],t=(km-a[0])/(b[0]-a[0]);
  return{lat:a[1]+(b[1]-a[1])*t,lng:a[2]+(b[2]-a[2])*t};
}
function mapsUrl(km){const c=kmToCoord(km);return c?`https://www.google.com/maps?q=${c.lat},${c.lng}&z=17`:null;}

/* ═══════════ Estado e camadas ═══════════ */
let pk=500,sf=null,asg=null,tab='tre',catFilter=null,lim=200;
let mt='map',mapScroll=0;
document.body.dataset.mt='map';
const hid=new Set();
let mFrom=0,mTo=0,showOv=true,showOc=true,showCv=true,dMax=180;
const scrollEl=document.getElementById('roadScroll');

/* Faixas contínuas (k:'b') e reparos individuais (k:'p'). O revestimento fica separado das demais soluções. */
/* Aterro (troca de solo) tratado como remendo profundo: opção do cadastro do contrato (opcoes.aterroComoRP). Desligada = faixa própria "Troca de solo (aterro)". */
const ATERRO_COMO_RP=!!(CAD.opcoes&&CAD.opcoes.aterroComoRP);
/* Item da planilha e descrição de cada solução (CAPA, REC, FRES, ATERRO): vêm do cadastro (itens e descricoes). "deMc": vale a partir daquela medição. */
const DESC_PAD={CAPA:'Revestimento (CBUQ)',REC:'Reciclagem',FRES:'Fresagem',ATERRO:'Recomposição manual de aterro'};
function itemDe(sv,mc){let it='';((CAD.itens||{})[sv]||[]).slice().sort((a,b)=>(a.deMc||0)-(b.deMc||0)).forEach(x=>{if(!x.deMc||mc>=x.deMc)it=x.item;});return it;}
const descDe=sv=>(CAD.descricoes||{})[sv]||DESC_PAD[sv];
const ITEM_ATE=itemDe('ATERRO',1e9);
const ITENS_CAPA=[...new Set(((CAD.itens||{}).CAPA||[]).map(x=>x.item))];
const LAYS=[
  {id:'capa',nm:'Revestimento (CBUQ)',cor:'#0F0F0F',k:'b'},
  {id:'rec',nm:'Reciclagem',cor:'#152D4A',k:'b'},
  {id:'fres',nm:'Fresagem',cor:'#7C0D2B',k:'b'},
  {id:'ater',nm:'Troca de solo (aterro)',cor:'#8B4106',k:'b'},
  {id:'rl',nm:'Reparo localizado',cor:'#F59E0B',k:'p'},
  {id:'rp',nm:'Remendo profundo',cor:'#EF4444',k:'p'},
  {id:'cd',nm:'Correção de defeitos',cor:'#38BDF8',k:'p'},
].filter(l=>!(ATERRO_COMO_RP&&l.id==='ater'))
 /* versão compartilhada: só revestimento (CBUQ) e reciclagem */
 .filter(l=>l.id==='capa'||l.id==='rec');
const LM={};LAYS.forEach(l=>LM[l.id]=l);
const BORD=['rec','fres','ater','capa']; /* ordem de desenho das faixas: o revestimento fica por cima */

const MESN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const mAbs=s=>(+s.slice(0,4))*12+(+s.slice(5,7))-1;
const day=s=>Date.parse(s+'T12:00:00Z')/864e5;
const fD=s=>s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
let M0=1e9,M1=-1;
REP.forEach(r=>{const m=mAbs(r[2]);if(m<M0)M0=m;if(m>M1)M1=m;});
TRE.forEach(t=>{const m=mAbs(t[3]);if(m<M0)M0=m;if(m>M1)M1=m;});
ATE.forEach(a=>{const m=mAbs(a[1]);if(m<M0)M0=m;if(m>M1)M1=m;});
const NM=M1-M0+1;
const mLab=i=>MESN[(M0+i)%12]+'/'+Math.floor((M0+i)/12);
mTo=NM-1;

/* ═══════════ Montagem dos dados ═══════════ */
const BANDS=[];
TRE.forEach(t=>{
  const[sv,mc,mp,data,s,e,lado,larg,esp,qtd,ponto,inf,obs]=t;
  let m0=s,m1=e;
  if(ponto){m0=s-100;m1=s+100;} /* trevo medido pela topografia: sem extensão na MC, estimada em 200 m */
  const lay=sv==='CAPA'?'capa':sv==='REC'?'rec':'fres';
  BANDS.push({lay,mc,mp,data,m0,m1,side:lado,larg,esp,qtd,
    item:itemDe(sv,mc),desc:descDe(sv),
    ponto,inf,obs});
});
ATE.forEach(a=>{
  if(ATERRO_COMO_RP)return;
  const[mc,data,est,lado,ext,bm,alt,qtd]=a,m0=est*20;
  BANDS.push({lay:'ater',mc,mp:mc,data,m0,m1:m0+ext,side:lado,larg:bm,esp:null,qtd,item:itemDe('ATERRO',mc),desc:descDe('ATERRO'),ponto:0,inf:0,obs:''});
});
BANDS.forEach((b,i)=>{b.k='b'+i;b.km0=b.m0/1000;b.km1=b.m1/1000;b.ext=b.m1-b.m0;b.dt=day(b.data);b.mi=mAbs(b.data)-M0;});

const SIDE=['D','E','D/E','C'];
const FORA=[],PT=[],IT={};
REP.forEach((r,i)=>{
  const[mc,mp,data,est,int,lado,ext,larg,tipo,mist,esp,espRev,espBase,qtd]=r,m0=est*20;
  if(m0/1000<KM0-0.3||m0/1000>KM1+0.1){FORA.push(r);return;}
  PT.push({k:'p'+i,mc,mp,data,est,int,side:SIDE[lado],ext,larg,tipo,mist,esp,espRev,espBase,qtd,
    m0,m1:m0+ext,km0:m0/1000,km1:(m0+ext)/1000,lay:['rl','rp','cd'][tipo],dt:day(data),mi:mAbs(data)-M0,fo:0,fc:0});
});
/* Aterro tratado como remendo profundo: a altura do aterro faz o papel da espessura do remendo.
   Estaca inteira (sem decimal) = posição arredondada, como nas demais MPs. */
if(ATERRO_COMO_RP)ATE.forEach((a,i)=>{
  const[mc,data,est,lado,ext,bm,alt,qtd]=a,m0=est*20;
  PT.push({k:'p'+(REP.length+i),mc,mp:mc,data,est,int:Number.isInteger(est)?1:0,side:lado,ext,larg:bm,tipo:1,mist:null,esp:alt,espRev:null,espBase:null,qtd,ate:1,
    m0,m1:m0+ext,km0:m0/1000,km1:(m0+ext)/1000,lay:'rp',dt:day(data),mi:mAbs(data)-M0,fo:0,fc:0});
});
PT.forEach(p=>IT[p.k]=p);BANDS.forEach(b=>IT[b.k]=b);

/* ═══════════ Análise: sobreposição e reparo sobre revestimento ═══════════
   Estaca arredondada (inteira) só localiza o reparo dentro de ~20 m: nesses casos a sobreposição é "possível", não certa. */
const lanesOf=x=>x.side==='D'?1:x.side==='E'?2:3;
const lo=p=>p.int?p.m0-10:p.m0,hi=p=>p.int?p.m1+10:p.m1;
const OV=[],OC=[];
(function(){
  const o=PT.slice().sort((a,b)=>lo(a)-lo(b));
  for(let i=0;i<o.length;i++){
    const a=o[i],ha=hi(a),la=lanesOf(a);
    for(let j=i+1;j<o.length&&lo(o[j])<ha;j++){
      const b=o[j];
      if(a.data===b.data||!(la&lanesOf(b)))continue;
      const ov=Math.min(ha,hi(b))-Math.max(lo(a),lo(b));
      if(ov<=(a.int||b.int?0:0.2))continue;
      const[x,y]=a.dt<=b.dt?[a,b]:[b,a];
      OV.push({a:x,b:y,dd:y.dt-x.dt,cert:!(a.int||b.int)});
    }
  }
  const caps=BANDS.filter(b=>b.lay==='capa');
  PT.forEach(p=>{
    const lp=lanesOf(p);
    caps.forEach(b=>{
      if(b.dt>=p.dt||!(lp&lanesOf(b)))return;
      const ov=Math.min(hi(p),b.m1)-Math.max(lo(p),b.m0);
      if(ov<=(p.int?0:0.2))return;
      OC.push({a:b,b:p,dd:p.dt-b.dt,cert:!p.int&&p.m0>=b.m0-0.5&&p.m1<=b.m1+0.5});
    });
  });
})();
/* Reparo executado ANTES de um revestimento novo no mesmo trecho e lado: hoje está por baixo do asfalto novo */
const CV=[],CV_BY={};
PT.forEach(p=>{
  const lp=lanesOf(p);
  BANDS.forEach(b=>{
    if(b.lay!=='capa'||b.dt<=p.dt||!(lp&lanesOf(b)))return;
    if(Math.min(hi(p),b.m1)-Math.max(lo(p),b.m0)<=(p.int?0:0.2))return;
    CV.push({p,b});(CV_BY[p.k]??=[]).push(b);
  });
});
const PAIRS_BY={};
OV.forEach(o=>{(PAIRS_BY[o.a.k]??=[]).push(o);(PAIRS_BY[o.b.k]??=[]).push(o);});
OC.forEach(o=>{(PAIRS_BY[o.b.k]??=[]).push(o);});

/* ═══════════ Filtros ═══════════ */
const inRange=x=>x.mi>=mFrom&&x.mi<=mTo&&!(sf&&x.side===({D:'E',E:'D'}[sf]));
const vis=x=>!hid.has(x.lay)&&inRange(x);
function calcFlags(){
  PT.forEach(p=>{p.fo=0;p.fc=0;p.cv=0;});
  if(showCv)CV.forEach(c=>{if(vis(c.b))c.p.cv=1;});
  if(showOv)OV.forEach(o=>{if(o.dd>dMax||!vis(o.a)||!vis(o.b))return;const v=o.cert?2:1;if(o.a.fo<v)o.a.fo=v;if(o.b.fo<v)o.b.fo=v;});
  if(showOc)OC.forEach(o=>{if(o.dd>dMax||!vis(o.a)||!vis(o.b))return;const v=o.cert?2:1;if(o.b.fc<v)o.b.fc=v;});
}

/* ═══════════ Render ═══════════ */
function render(){
  document.getElementById('roadCanvas').style.width=(LEN*pk+MAP_PAD*2)+'px';
  calcFlags();
  const visKm=scrollEl.clientWidth/pk,ak=asg?asg.k:'';
  let h='';
  const gridStep=visKm>80?20:visKm>40?10:visKm>15?5:visKm>5?2:1;
  for(let km=Math.ceil(KM0/gridStep)*gridStep;km<=KM1;km+=gridStep)h+=`<div class="rv-guide" style="left:${km2px(km)}px"></div>`;

  /* faixas: soluções em trecho */
  const vb=BANDS.filter(vis);
  const segsE=vb.filter(b=>b.side==='E');
  BORD.forEach(id=>vb.forEach(b=>{
    if(b.lay!==id)return;
    const x=km2px(b.km0),w=Math.max(b.ext/1000*pk,3);
    const sc=b.side==='D'?' sg-d':b.side==='E'?' sg-e':'';
    const nl=b.side==='D'&&segsE.some(e=>e.km0<b.km1&&e.km1>b.km0)?' no-ln':'';
    h+=`<div class="sg${sc}${nl}${b.k===ak?' act':''}" data-k="${b.k}" style="left:${x}px;width:${w}px;background:${LM[b.lay].cor};--sc:${LM[b.lay].cor}"></div>`;
  }));

  /* reparos: um retângulo por reparo, mais novos por cima. Posição transversal não consta nas MCs: centro da faixa do lado */
  PT.filter(vis).sort((a,b)=>a.dt-b.dt).forEach(p=>{
    const x=km2px(p.km0),w=Math.max(p.ext/1000*pk,2);
    const both=p.side==='D/E'||p.side==='C';
    /* zoom afastado: altura reduzida (marcador); a proporção real (16,7 px/m na largura) só vale ao aproximar */
    const hh=Math.max(Math.min(p.larg*16.67,both?118:58,Math.max(10,w*4)),4);
    const cy=p.side==='D'?110.5:p.side==='E'?49.5:80;
    h+=`<div class="pt t${p.tipo}${p.fo?(p.fo===2?' ov':' ovp'):''}${p.fc?' oc':''}${p.cv?' cv':''}${p.k===ak?' act':''}" data-k="${p.k}" style="left:${x}px;width:${w}px;top:${(cy-hh/2).toFixed(1)}px;height:${hh.toFixed(1)}px"></div>`;
  });
  document.getElementById('rv').innerHTML=h;

  /* Régua */
  const rl=document.getElementById('rl');
  let r='';
  const kmStep=visKm>100?20:visKm>50?10:visKm>20?5:visKm>8?2:1;
  for(let km=Math.ceil(KM0/kmStep)*kmStep;km<=KM1;km+=kmStep)
    r+=`<div class="rk-km" style="left:${km2px(km)}px"><span class="lb">km ${km}</span><span class="est">Est ${(km*1000/20).toLocaleString('pt-BR')}</span></div>`;
  if(visKm<20){
    const estPx=pk*0.02,estIv=estPx>80?1:estPx>40?2:estPx>18?5:estPx>8?10:25;
    const e0=Math.ceil((KM0*1000/20)/estIv)*estIv,e1=Math.floor(KM1*1000/20);
    for(let e=e0;e<=e1;e+=estIv){
      if(e%50===0)continue;
      const cls=e%25===0?'h':e%10===0?'q':'t';
      r+=`<div class="rk-e ${cls}" style="left:${km2px(e*20/1000)}px">${estPx>12?`<span>${e}</span>`:''}</div>`;
    }
  }
  rl.innerHTML=r;

  rMM();updateKmInd();
  document.getElementById('zLab').textContent=fm(visKm,1)+' km';
  kpis();chipCounts();
}

/* ═══════════ KPIs e chips ═══════════ */
function kpis(){
  let rl=0,rlA=0,rp=0,rpV=0,cd=0,cdV=0,capaKm=0,capaN=0,recKm=0,recN=0;
  PT.forEach(p=>{
    if(!inRange(p))return;
    if(p.tipo===0){rl++;rlA+=p.ext*p.larg;}else if(p.tipo===1){rp++;rpV+=p.qtd;}else{cd++;cdV+=p.qtd;}
  });
  BANDS.forEach(b=>{if(b.lay==='capa'&&inRange(b)){capaN++;capaKm+=b.ext*(b.side==='D/E'?1:.5);}});
  BANDS.forEach(b=>{if(b.lay==='rec'&&inRange(b)){recN++;recKm+=b.ext*(b.side==='D/E'?1:.5);}});
  const oc1=new Set(),op1=new Set();let pc=0,pp=0;
  OV.forEach(o=>{
    if(o.dd>dMax||!inRange(o.a)||!inRange(o.b))return;
    if(o.cert){pc++;oc1.add(o.a.k);oc1.add(o.b.k);}else{pp++;op1.add(o.a.k);op1.add(o.b.k);}
  });
  op1.forEach(k=>{if(oc1.has(k))op1.delete(k);});
  const sc=new Set(),sp=new Set();
  OC.forEach(o=>{if(o.dd>dMax||!inRange(o.a)||!inRange(o.b))return;(o.cert?sc:sp).add(o.b.k);});
  sp.forEach(k=>{if(sc.has(k))sp.delete(k);});
  const set=(id,v,s)=>{document.getElementById(id).textContent=v;document.getElementById(id+'s').textContent=s;};
  set('k1',fm(rl),`${fm(rlA)} m² · +${fm(cd)} correções de defeitos (${fm(cdV,1)} m³)`);
  const ateN=PT.filter(p=>p.ate&&inRange(p)).length;
  set('k2',fm(rp),`${fm(rpV,1)} m³`+(ateN?` · inclui ${fm(ateN)} de aterro${ITEM_ATE?` (item ${ITEM_ATE})`:''}`:''));
  set('k3',fm(capaKm/1000,1)+' km',`${fm(capaN)} trechos · equivalente a pista inteira`);
  set('k6',fm(recKm/1000,1)+' km',`${fm(recN)} trechos · equivalente a pista inteira`);
  const lab=dMax>=99999?'sem limite de prazo':'em até '+document.getElementById('dMax').selectedOptions[0].text;
  set('k4',fm(oc1.size),`${fm(pc)} pares certos · + ${fm(op1.size)} reparos com sobreposição possível · ${lab}`);
  set('k5',fm(sc.size),`+ ${fm(sp.size)} possíveis (estaca arredondada) · ${lab}`);
  document.getElementById('nRep').textContent=fm(PT.filter(vis).length);
  document.getElementById('nOv').textContent=fm(ovRows().length);
  document.getElementById('nTre').textContent=fm(BANDS.filter(vis).length);
}
function chipCounts(){
  LAYS.forEach(l=>{
    const n=(l.k==='p'?PT:BANDS).filter(x=>x.lay===l.id&&inRange(x)).length;
    const c=document.querySelector(`.chip[data-cat="${l.id}"] .chip-n`);if(c)c.textContent=fm(n);
  });
}
(function(){
  const el=document.getElementById('chips');
  LAYS.forEach(l=>{
    const d=document.createElement('div');
    d.className='chip';d.dataset.cat=l.id;d.onclick=()=>tC(l.id);
    d.innerHTML=`<span class="chip-d" style="background:${l.cor}"></span>${l.nm}<span class="chip-n"></span>`;
    el.appendChild(d);
  });
  const opts=Array.from({length:NM},(_,i)=>`<option value="${i}">${mLab(i)}</option>`).join('');
  const a=document.getElementById('mFrom'),b=document.getElementById('mTo');
  a.innerHTML=opts;b.innerHTML=opts;a.value=0;b.value=NM-1;
  a.onchange=()=>{mFrom=+a.value;if(mFrom>mTo){mTo=mFrom;b.value=mTo;}refresh();};
  b.onchange=()=>{mTo=+b.value;if(mTo<mFrom){mFrom=mTo;a.value=mFrom;}refresh();};
  document.getElementById('dMax').onchange=e=>{dMax=+e.target.value;refresh();};
})();
function refresh(){hideCardNow();render();buildTable();}
function tC(id){
  hid.has(id)?hid.delete(id):hid.add(id);
  document.querySelector(`.chip[data-cat="${id}"]`).classList.toggle('off');
  render();buildTable();
}
/* Visão de abertura (página e casinha): só as soluções em trecho; os reparos individuais ficam desligados e são ligados pelos chips */
const REP_OFF=['rl','rp','cd'].filter(id=>LM[id]); /* na versão compartilhada esses chips não existem */
function ocultaReparos(){
  REP_OFF.forEach(id=>{hid.add(id);const c=document.querySelector(`.chip[data-cat="${id}"]`);if(c)c.classList.add('off');});
}
function fS(s){
  sf=sf===s?null:s;
  document.getElementById('fD').classList.toggle('on',sf==='D');
  document.getElementById('fE').classList.toggle('on',sf==='E');
  render();buildTable();
}
function tg(w){
  if(w==='ov'){showOv=!showOv;document.getElementById('tOv').classList.toggle('on',showOv);}
  else if(w==='cv'){showCv=!showCv;document.getElementById('tCv').classList.toggle('on',showCv);}
  else{showOc=!showOc;document.getElementById('tOc').classList.toggle('on',showOc);}
  render();
}

/* ═══════════ KM Indicator ═══════════ */
function updateKmInd(){
  const km=px2km(scrollEl.scrollLeft);
  document.getElementById('kmPill').textContent='km '+fK(Math.max(KM0,Math.min(km,KM1)));
}

/* ═══════════ Info Card ═══════════ */
const elOf=k=>document.querySelector(`#rv [data-k="${k}"]`); /* só o item do mapa (a tabela também usa data-k) */
function hideCardNow(){
  asg=null;
  document.getElementById('ic').classList.remove('sh');
  document.querySelectorAll('.sg.act,.pt.act').forEach(el=>el.classList.remove('act'));
  filterTableByCat(null);
}
function posCard(it){
  const el=elOf(it.k);
  if(!el)return;
  const card=document.getElementById('ic'),r=el.getBoundingClientRect();
  const cW=Math.min(440,window.innerWidth-24);
  card.style.width=cW+'px';card.style.maxHeight='none';card.style.overflowY='visible';
  /* canto superior oposto ao item clicado */
  const onRight=r.left+r.width/2>=window.innerWidth/2;
  card.style.left=onRight?'12px':(window.innerWidth-cW-12)+'px';
  card.style.top='12px';
}
const fEstM=m=>{const e=Math.floor(m/20+1e-9),r=m-e*20;return fm(e)+(r>0.05?' + '+fm(r,1)+' m':'');};
const sideNm=s=>s==='D/E'?'Ambos':s==='D'?'Direito':s==='E'?'Esquerdo':'Eixo';
const PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

function showCard(it){
  asg=it;
  const isP=it.k[0]==='p',L=LM[it.lay],co=L.cor;
  /* campos longos ocupam a linha toda no celular (classe fc-w); sem efeito no desktop */
  const r=(l,v,t)=>{const w=l.length>10||String(v).replace(/<[^>]*>/g,'').length>8?' fc-w':'';return `<div class="fc-l${w}">${l}</div><div class="fc-v${t?' tx':''}${w}">${v}</div>`;};
  const sep='<div class="fc-sep"></div>';
  let hd,desc,grid;
  if(!isP){
    hd=`MP ${it.mp} · Item ${it.item}`;desc=it.desc;
    grid=r('Data',fD(it.data),true)+sep+r('KM',`${fK(it.km0)} → ${fK(it.km1)}`)+r('Estacas',`${fEstM(it.m0)} → ${fEstM(it.m1)}`)+r('Extensão',`${fm(it.ext,0)} m`)+sep;
    if(it.larg)grid+=r('Largura',`${fm(it.larg,2)} m`);
    if(it.esp)grid+=r('Espessura',`${fm(it.esp*100,1)} cm`);
    grid+=r('Lado',sideNm(it.side),true)+sep;
    if(it.larg&&it.ext>0)grid+=r('Área',`${fm(it.ext*it.larg,1)} m²`);
    if(it.larg&&it.esp&&it.ext>0)grid+=r('Volume',`${fm(it.ext*it.larg*it.esp,1)} m³`);
    if(it.qtd)grid+=r(it.lay==='capa'?'Toneladas':'Quantidade',`${fm(it.qtd,3)} ${it.lay==='capa'?'T':'m³'}`);
    if(it.ponto)grid+=r('Obs.','Medido pela topografia no trevo; extensão estimada','');
    if(it.inf)grid+=r('Obs.','Lado deduzido (MP não informa)','');
  }else{
    hd=`MP ${it.mp}`;
    desc=it.ate?`${descDe('ATERRO')}${ITEM_ATE?` (item ${ITEM_ATE})`:''}, tratada como remendo profundo`:`Mistura ${it.mist===1?'CBUQ':it.mist===0?'PMF (pré-misturado a frio)':'não informada'}`;
    grid=r('Data',fD(it.data),true)+sep+r('KM',`${fK(it.km0)} → ${fK(it.km1)}`)
      +r('Estaca',it.int?`${fm(it.est)} (arredondada)`:`${fEstM(it.m0)}`)
      +r('Extensão × largura',`${fm(it.ext,2)} × ${fm(it.larg,2)} m`)+r('Lado',sideNm(it.side),true)+sep;
    if(it.tipo===1){
      if(it.esp)grid+=r(it.ate?'Altura do aterro':'Esp. do remendo',`${fm(it.esp*100,0)} cm`);
      if(it.espRev)grid+=r('Esp. do revestimento',`${fm(it.espRev*100,0)} cm`);
      if(it.espBase)grid+=r('Esp. da base (BGS)',`${fm(it.espBase*100,0)} cm`);
    }else if(it.esp)grid+=r('Espessura',`${fm(it.esp*100,1)} cm`);
    grid+=r('Área',`${fm(it.ext*it.larg,2)} m²`)+r('Volume',`${fm(it.qtd,3)} m³`)+sep
      +r('Posição',it.int?'Estaca arredondada (±20 m)':'Estaca exata',true);
    const cb=(CV_BY[it.k]||[]).slice().sort((a,b)=>a.dt-b.dt)[0];
    if(cb)grid+=r('Revestimento depois',`${fD(cb.data)} (${fm(cb.dt-it.dt)} d depois)`,true);
  }
  const pairs=isP?(PAIRS_BY[it.k]||[]).filter(o=>o.dd<=99999).sort((a,b)=>a.dd-b.dd):[];
  let list='';
  if(pairs.length){
    list=`<div class="card-list"><div class="ct">Sobreposições (${pairs.length})</div>`+pairs.slice(0,6).map(o=>{
      const rc=o.a.k[0]==='b',other=o.b===it?o.a:o.b,rel=o.b===it?'antes':'depois'; /* relação do OUTRO reparo com este */
      const nm=rc?'Revestimento novo':LM[other.lay].nm;
      return `<div class="li" data-go="${other.k}"><span>${rc?'sobre ':''}${nm} · ${fD(other.data)}</span><span>${fm(o.dd)} d ${rel}${o.cert?'':' · possível'}</span></div>`;
    }).join('')+(pairs.length>6?`<div class="li"><span>… e mais ${pairs.length-6}</span><span></span></div>`:'')+'</div>';
  }
  const cI=kmToCoord(it.km0),cF=kmToCoord(it.km1);
  let geo='';
  if(cI||cF){
    const gl=c=>`<a class="gps" href="https://www.google.com/maps?q=${c.lat},${c.lng}&z=17" target="_blank" rel="noopener" title="Abrir no Maps">${PIN}</a>`;
    let rows='';
    if(cI)rows+=`<div class="fc-geo-l">Inicial</div><div class="fc-geo-c">${cI.lat.toFixed(6)}, ${cI.lng.toFixed(6)}</div>${gl(cI)}`;
    if(cF)rows+=`<div class="fc-geo-l">Final</div><div class="fc-geo-c">${cF.lat.toFixed(6)}, ${cF.lng.toFixed(6)}</div>${gl(cF)}`;
    geo=`<div class="fc-geo"><div class="fc-geo-t">Visualizar no Google Maps</div><div class="fc-geo-grid">${rows}</div></div>`;
  }
  const card=document.getElementById('ic');
  card.innerHTML=`<button class="fc-x" type="button" aria-label="Fechar" onclick="hideCardNow()">×</button><div class="fc-bar" style="background:${co};color:${co}"></div>
    <div class="fc-hd"><span class="fc-cat">${L.nm}</span><span class="fc-mc">${hd}</span></div>
    <div class="fc-desc">${desc}</div>
    <div class="fc-grid">${grid}</div>${list}${geo}`;
  card.classList.add('sh');
  posCard(it);
  document.querySelectorAll('.sg.act,.pt.act').forEach(el=>el.classList.remove('act'));
  const e2=elOf(it.k);if(e2)e2.classList.add('act');
}
document.getElementById('ic').addEventListener('click',e=>{
  const li=e.target.closest('[data-go]');
  if(li){const it=IT[li.dataset.go];if(it)focusItem(it);}
});

/* ═══════════ Minimapa ═══════════ */
function rMM(){
  const cv=document.getElementById('mc'),wr=document.getElementById('mm'),rc=wr.getBoundingClientRect();
  cv.width=rc.width*2;cv.height=rc.height*2;
  const cx=cv.getContext('2d');cx.scale(2,2);
  const W=rc.width,H=rc.height,css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  cx.fillStyle=css('--mm-bg');cx.fillRect(0,0,W,H);
  cx.fillStyle=css('--road');cx.fillRect(0,H*.2,W,H*.6);
  BORD.forEach(id=>BANDS.forEach(b=>{
    if(b.lay!==id||!vis(b))return;
    cx.fillStyle=LM[id].cor;cx.globalAlpha=.9;
    cx.fillRect(((b.km0-KM0)/LEN)*W,H*.1,Math.max(((b.km1-b.km0)/LEN)*W,.5),H*.8);
  }));
  PT.forEach(p=>{
    if(!vis(p))return;
    cx.fillStyle=LM[p.lay].cor;cx.globalAlpha=.85;
    const y=p.side==='D'?H*.5:p.side==='E'?H*.1:H*.1,hh=p.side==='D'||p.side==='E'?H*.4:H*.8;
    cx.fillRect(((p.km0-KM0)/LEN)*W,y,Math.max(((p.km1-p.km0)/LEN)*W,.7),hh);
  });
  cx.globalAlpha=1;
  updateMMView();
}
function updateMMView(){
  const totalW=LEN*pk+MAP_PAD*2,mv=document.getElementById('mv');
  mv.style.left=(scrollEl.scrollLeft/totalW*100)+'%';
  mv.style.width=(scrollEl.clientWidth/totalW*100)+'%';
}

/* ═══════════ Scroll / Zoom ═══════════ */
const PK_MAX=24000;
scrollEl.addEventListener('scroll',()=>{
  updateKmInd();updateMMView();
  if(asg){
    const el=elOf(asg.k);
    if(el){
      const r=el.getBoundingClientRect(),sr=scrollEl.getBoundingClientRect();
      if(r.right<sr.left-50||r.left>sr.right+50)hideCardNow();else posCard(asg);
    }
  }
});
scrollEl.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey||e.metaKey){
    const rect=scrollEl.getBoundingClientRect(),mx=e.clientX-rect.left,mouseKm=px2km(scrollEl.scrollLeft+mx);
    const minPk=(scrollEl.clientWidth-MAP_PAD*2)/(LEN+4);
    pk=Math.max(minPk,Math.min(pk*(e.deltaY>0?0.8:1.25),PK_MAX));
    render();scrollEl.scrollLeft=km2px(mouseKm)-mx;
  }else scrollEl.scrollLeft+=e.deltaY+e.deltaX;
},{passive:false});

/* Drag horizontal; clique sem arrastar chega ao item. Depois de arrastar, o clique é descartado */
const MOB=window.matchMedia('(max-width:640px)');
let dragMoved=0,pinching=false;
(function(){
  let dragging=false,startX=0,startScroll=0;
  scrollEl.addEventListener('pointerdown',e=>{
    if(e.button!==0||!e.isPrimary||pinching)return;
    dragMoved=0;
    if(e.target.closest('[data-k]'))return;
    dragging=true;startX=e.clientX;startScroll=scrollEl.scrollLeft;
    scrollEl.setPointerCapture(e.pointerId);
    scrollEl.style.cursor='grabbing';scrollEl.style.userSelect='none';
  });
  scrollEl.addEventListener('pointermove',e=>{
    if(!dragging||pinching)return;
    dragMoved=Math.max(dragMoved,Math.abs(e.clientX-startX));
    scrollEl.scrollLeft=startScroll-(e.clientX-startX);
  });
  const stop=()=>{if(!dragging)return;dragging=false;scrollEl.style.cursor='grab';scrollEl.style.userSelect='';};
  scrollEl.addEventListener('pointerup',stop);
  scrollEl.addEventListener('pointercancel',stop);
  scrollEl.style.cursor='grab';
})();
/* Pinça com dois dedos (celular): durante o gesto só estica o mapa (pré-visualização); ao soltar, refaz o desenho na escala nova.
   Refazer a cada passo trocaria os elementos tocados e o navegador deixaria de entregar os eventos. Só em telas de toque. */
if(matchMedia('(pointer:coarse)').matches)(function(){
  const cv=document.getElementById('roadCanvas');
  let d0=0,pk0=0,km0=0,mx=0,f=1;
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  const midX=t=>(t[0].clientX+t[1].clientX)/2-scrollEl.getBoundingClientRect().left;
  const lim=v=>Math.max((scrollEl.clientWidth-MAP_PAD*2)/(LEN+4)/pk0,Math.min(v,PK_MAX/pk0));
  scrollEl.addEventListener('touchstart',e=>{
    if(e.touches.length!==2)return;
    pinching=true;d0=dist(e.touches);pk0=pk;mx=midX(e.touches);km0=px2km(scrollEl.scrollLeft+mx);f=1;
    cv.style.transformOrigin=(scrollEl.scrollLeft+mx)+'px 0';
  },{passive:true});
  scrollEl.addEventListener('touchmove',e=>{
    if(!pinching||e.touches.length!==2)return;
    e.preventDefault();
    f=lim(dist(e.touches)/d0);mx=midX(e.touches);
    cv.style.transform=`scaleX(${f})`;
  },{passive:false});
  const fim=()=>{
    if(!pinching)return;
    pinching=false;cv.style.transform='';cv.style.transformOrigin='';
    if(Math.abs(f-1)<.02)return;
    pk=pk0*f;render();scrollEl.scrollLeft=km2px(km0)-mx;
  };
  scrollEl.addEventListener('touchend',e=>{if(e.touches.length<2)fim();});
  scrollEl.addEventListener('touchcancel',fim);
})();
/* Toque (celular): se o dedo cair perto de um reparo, vale o reparo mais próximo (até 18 px), mesmo que haja uma faixa embaixo */
const COARSE=matchMedia('(pointer:coarse)');
function nearestPt(x,y){
  let best=null,bd=18.5;
  document.querySelectorAll('#rv .pt').forEach(p=>{
    const r=p.getBoundingClientRect(),dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=Math.hypot(dx,dy);
    if(d<=bd){bd=d;best=p;}
  });
  return best;
}
scrollEl.addEventListener('click',e=>{
  if(dragMoved>4){e.stopPropagation();dragMoved=0;return;}
  let el=e.target.closest('[data-k]');
  if(COARSE.matches&&!(el&&el.classList.contains('pt'))){const n=nearestPt(e.clientX,e.clientY);if(n)el=n;}
  if(!el)return;
  e.stopPropagation();
  tapItem(IT[el.dataset.k]);
});

function zI(){
  const vpW=scrollEl.clientWidth,c=px2km(scrollEl.scrollLeft+vpW/2);
  pk=Math.min(pk*1.5,PK_MAX);render();scrollEl.scrollLeft=km2px(c)-vpW/2;
}
function zO(){
  const vpW=scrollEl.clientWidth,c=px2km(scrollEl.scrollLeft+vpW/2);
  pk=Math.max(pk/1.5,(vpW-MAP_PAD*2)/(LEN+4));render();scrollEl.scrollLeft=km2px(c)-vpW/2;
}
function setOn(w){document.getElementById('bf').classList.toggle('on',w==='f');document.getElementById('ba').classList.toggle('on',w==='a');}
function fW(){
  const s=[...PT,...BANDS].filter(vis);
  if(!s.length)return fA();
  const minKm=Math.min(...s.map(x=>x.km0))-2,maxKm=Math.max(...s.map(x=>x.km1))+2,vpW=scrollEl.clientWidth;
  pk=(vpW-MAP_PAD*2)/(maxKm-minKm);render();scrollEl.scrollLeft=km2px(minKm);setOn('f');
}
function fA(){
  pk=(scrollEl.clientWidth-MAP_PAD*2)/(LEN+4);render();scrollEl.scrollLeft=0;setOn('a');
}
/* Abre na janela de 5 km com mais reparos */
function densest(win){
  const ks=PT.map(p=>p.km0).sort((a,b)=>a-b);let best=KM0,bn=0,j=0;
  for(let i=0;i<ks.length;i++){while(ks[i]-ks[j]>win)j++;if(i-j+1>bn){bn=i-j+1;best=ks[j];}}
  return best;
}
/* Janela inicial (abertura da página e casinha): largura visível do mapa em km. Ajuste aqui: 1,5 km no desktop; 2,5 km no celular (o mapa é mais estreito).
   O zoom é vpW/win, então o rótulo ao lado do "+" mostra exatamente esse valor. */
const WIN_DESK=1.5,WIN_MOB=2.5;
function zoomInicial(){const win=MOB.matches?WIN_MOB:WIN_DESK;pk=scrollEl.clientWidth/win;return win;}
function goHome(){
  const win=zoomInicial();render();scrollEl.scrollLeft=km2px(densest(win)-.1);setOn('');
}
/* Casinha: volta o mapa ao início do trecho (km 290) no zoom inicial, desliga os reparos individuais e não mexe nos demais filtros */
function goStart(){
  hideCardNow();ocultaReparos();
  zoomInicial();render();buildTable();scrollEl.scrollLeft=0;setOn('');
}
function resetView(){
  hideCardNow();sf=null;hid.clear();mFrom=0;mTo=NM-1;showOv=showOc=showCv=true;dMax=180;
  document.querySelectorAll('.chip.off').forEach(c=>c.classList.remove('off'));
  ['fD','fE'].forEach(i=>document.getElementById(i).classList.remove('on'));
  ['tOv','tOc','tCv'].forEach(i=>document.getElementById(i).classList.add('on'));
  document.getElementById('mFrom').value=0;document.getElementById('mTo').value=NM-1;document.getElementById('dMax').value=180;
  goHome();buildTable();
}
/* Minimapa: arrastar o dedo rola o mapa, mas só 40% do que o minimapa "andou" (é um resumo; o ajuste fino é no mapa). Toque simples continua saltando para o ponto */
const MM_K=.4;let mmMoved=0;
(function(){
  const mm=document.getElementById('mm');
  let down=false,x0=0,sl0=0;
  if(matchMedia('(pointer:coarse)').matches){
    mm.addEventListener('pointerdown',e=>{down=true;x0=e.clientX;sl0=scrollEl.scrollLeft;mmMoved=0;mm.setPointerCapture(e.pointerId);});
    mm.addEventListener('pointermove',e=>{
      if(!down)return;
      mmMoved=Math.max(mmMoved,Math.abs(e.clientX-x0));
      const W=mm.getBoundingClientRect().width,total=LEN*pk+MAP_PAD*2;
      scrollEl.scrollLeft=sl0+(e.clientX-x0)*(total/W)*MM_K;
    });
    const up=()=>{down=false;};
    mm.addEventListener('pointerup',up);mm.addEventListener('pointercancel',up);
  }
  mm.addEventListener('click',e=>{
    if(mmMoved>4){mmMoved=0;return;}
    const r=mm.getBoundingClientRect(),km=KM0+(e.clientX-r.left)/r.width*LEN;
    scrollEl.scrollTo({left:km2px(km)-scrollEl.clientWidth/2,behavior:'smooth'});
  });
})();
window.addEventListener('resize',()=>{render();fitMap();});

/* ═══════════ Seleção ═══════════ */
function tapItem(it){
  if(!it)return;
  if(asg&&asg.k===it.k){hideCardNow();return;}
  showCard(it);filterTableByCat(it.lay);
}
/* Zoom no item e abre o card (usado pela tabela e pelas listas do card) */
function focusItem(it){
  const mid=(it.km0+it.km1)/2,span=it.k[0]==='p'?.5:Math.max((it.km1-it.km0)*4,10),vpW=scrollEl.clientWidth;
  pk=Math.min((vpW-MAP_PAD*2)/span,PK_MAX);
  if(hid.has(it.lay)){hid.delete(it.lay);document.querySelector(`.chip[data-cat="${it.lay}"]`).classList.remove('off');}
  if(!inRange(it)){mFrom=0;mTo=NM-1;document.getElementById('mFrom').value=0;document.getElementById('mTo').value=NM-1;}
  render();scrollEl.scrollLeft=km2px(mid)-vpW/2;
  requestAnimationFrame(()=>requestAnimationFrame(()=>showCard(it)));
}
document.addEventListener('click',e=>{
  if(!asg)return;
  if(document.getElementById('ic').contains(e.target)||e.target.closest('[data-k]'))return;
  hideCardNow();
});

/* ═══════════ Tabelas ═══════════ */
const ST={rep:{k:'data',d:1},ov:{k:'dd',d:1},tre:{k:'data',d:1}};
const tipoNm=['Reparo localizado','Remendo profundo','Correção de defeitos'];
function filterTableByCat(id){
  catFilter=id;
  if(id)tab=LM[id].k==='p'?'rep':'tre';
  syncTabs();buildTable();
}
function setTab(t){tab=t;catFilter=null;lim=200;syncTabs();buildTable();}
function syncTabs(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));}
const flags=p=>{
  let s='';
  if(p.ate)s+=`<span class="pill w">${ITEM_ATE?'item '+ITEM_ATE+' · ':''}aterro</span> `;
  if(p.int)s+='<span class="pill p">estaca arredondada</span> ';
  if(p.fo)s+=`<span class="pill c">sobrepõe${p.fo===1?' (possível)':''}</span> `;
  if(p.fc)s+='<span class="pill w">sobre revestimento</span>';
  return s||'—';
};
function ovRows(){
  const out=[];
  OV.forEach(o=>{if(o.dd<=dMax&&vis(o.a)&&vis(o.b))out.push({o,t:'Reparo × reparo',km:o.b.km0,side:o.b.side});});
  OC.forEach(o=>{if(o.dd<=dMax&&vis(o.a)&&vis(o.b))out.push({o,t:'Reparo sobre revestimento',km:o.b.km0,side:o.b.side});});
  return out;
}
const desc1=x=>x.k[0]==='b'?`${LM[x.lay].nm} · ${fD(x.data)}`:`${tipoNm[x.tipo]} · ${fD(x.data)} · ${fm(x.ext,1)}×${fm(x.larg,1)} m`;
const TBL={
  rep:{cols:[['data','Data'],['mp','MP'],['tipo','Tipo'],['mist','Mistura'],['est','Estaca'],['km0','KM'],['side','Lado'],['ext','Ext. (m)',1],['larg','Larg. (m)',1],['esp','Esp. (cm)',1],['area','Área (m²)',1],['qtd','Vol. (m³)',1],['fl','Observação']],
    rows:()=>PT.filter(p=>vis(p)&&(!catFilter||p.lay===catFilter)),
    val:(p,k)=>k==='area'?p.ext*p.larg:k==='fl'?(p.fo?2:0)+(p.fc?1:0)+(p.int?.5:0):p[k]??0,
    tr:(p,i)=>`<tr data-k="${p.k}"><td class="t-mono">${fD(p.data)}</td><td class="t-mono">${p.mp}</td><td><span class="t-cat"><span class="t-dot" style="background:${LM[p.lay].cor}"></span>${tipoNm[p.tipo]}</span></td><td class="t-mono">${p.mist===1?'CBUQ':p.mist===0?'PMF':'—'}</td><td class="t-mono">${p.int?fm(p.est):fEstM(p.m0)}</td><td class="t-mono">${fK(p.km0)}</td><td><span class="t-side">${p.side}</span></td><td class="t-mono t-right">${fm(p.ext,2)}</td><td class="t-mono t-right">${fm(p.larg,2)}</td><td class="t-mono t-right">${p.esp?fm(p.esp*100,1):'—'}</td><td class="t-mono t-right">${fm(p.ext*p.larg,2)}</td><td class="t-mono t-right">${fm(p.qtd,3)}</td><td>${flags(p)}</td></tr>`,
    cap:'Um registro por reparo medido. Estaca em destaque “arredondada”: a MP informa só a estaca inteira (posição ±20 m).'},
  ov:{cols:[['t','Tipo'],['cert','Certeza'],['km','KM'],['side','Lado'],['a','Anterior'],['b','Posterior'],['dd','Intervalo (dias)',1]],
    rows:()=>ovRows(),
    val:(r,k)=>k==='t'?r.t:k==='cert'?(r.o.cert?1:0):k==='km'?r.km:k==='side'?r.side:k==='a'?r.o.a.data:k==='b'?r.o.b.data:r.o.dd,
    tr:(r,i)=>`<tr data-o="${i}"><td>${r.t}</td><td>${r.o.cert?'<span class="pill c">certa</span>':'<span class="pill p">possível</span>'}</td><td class="t-mono">${fK(r.km)}</td><td><span class="t-side">${r.side}</span></td><td>${desc1(r.o.a)}</td><td>${desc1(r.o.b)}</td><td class="t-mono t-right">${fm(r.o.dd)}</td></tr>`,
    cap:'Reparos de datas diferentes no mesmo trecho e lado, e reparos feitos depois sobre revestimento novo. “Possível”: pelo menos um dos dois só tem a estaca arredondada. O prazo máximo segue o seletor “em até”.'},
  tre:{cols:[['lay','Solução'],['data','Data'],['mp','MP'],['item','Item'],['km0','KM início'],['km1','KM fim'],['ext','Ext. (m)',1],['larg','Larg. (m)',1],['esp','Esp. (cm)',1],['side','Lado'],['qtd','Quantidade',1],['obs','Obs.']],
    rows:()=>BANDS.filter(b=>vis(b)&&(!catFilter||b.lay===catFilter)),
    val:(b,k)=>k==='lay'?LAYS.findIndex(l=>l.id===b.lay):b[k]??0,
    tr:(b,i)=>`<tr data-k="${b.k}"><td><span class="t-cat"><span class="t-dot" style="background:${LM[b.lay].cor}"></span>${LM[b.lay].nm}</span></td><td class="t-mono">${fD(b.data)}</td><td class="t-mono">${b.mp}</td><td class="t-mono">${b.item}</td><td class="t-mono">${fK(b.km0)}</td><td class="t-mono">${fK(b.km1)}</td><td class="t-mono t-right">${fm(b.ext,0)}</td><td class="t-mono t-right">${b.larg?fm(b.larg,2):'—'}</td><td class="t-mono t-right">${b.esp?fm(b.esp*100,1):'—'}</td><td><span class="t-side">${b.side}</span></td><td class="t-mono t-right">${b.qtd?fm(b.qtd,3)+(b.lay==='capa'?' T':' m³'):'—'}</td><td>${b.ponto?'extensão estimada':b.inf?'lado deduzido':'—'}</td></tr>`,
    cap:`Faixas contínuas: revestimento${ITENS_CAPA.length?` (${ITENS_CAPA.length>1?'itens':'item'} ${ITENS_CAPA.join(' e ')})`:''} e reciclagem${itemDe('REC',1e9)?` (item ${itemDe('REC',1e9)})`:''}.`},
};
/* Celular: cada registro vira uma linha de 2-3 textos, sem rolagem lateral */
const mistNm=m=>m===1?'CBUQ':m===0?'PMF':'—';
TBL.rep.trm=p=>`<tr data-k="${p.k}"><td colspan="13" class="m-row"><div class="m1"><span class="t-cat"><span class="t-dot" style="background:${LM[p.lay].cor}"></span>${tipoNm[p.tipo]}</span><span class="m-d">${fD(p.data)}</span><span class="t-side">${p.side}</span></div><div class="m2">km ${fK(p.km0)} · ${fm(p.ext,2)} × ${fm(p.larg,2)} m · MP ${p.mp} · ${mistNm(p.mist)}</div><div class="m2">${flags(p)}</div></td></tr>`;
TBL.ov.trm=(r,i)=>`<tr data-o="${i}"><td colspan="7" class="m-row"><div class="m1"><span>${r.t}</span>${r.o.cert?'<span class="pill c">certa</span>':'<span class="pill p">possível</span>'}<span class="m-d">${fm(r.o.dd)} ${r.o.dd===1?'dia':'dias'}</span><span class="t-side">${r.side}</span></div><div class="m2">km ${fK(r.km)}</div><div class="m3"><b>Antes:</b> ${desc1(r.o.a)}</div><div class="m3"><b>Depois:</b> ${desc1(r.o.b)}</div></td></tr>`;
TBL.tre.trm=b=>`<tr data-k="${b.k}"><td colspan="12" class="m-row"><div class="m1"><span class="t-cat"><span class="t-dot" style="background:${LM[b.lay].cor}"></span>${LM[b.lay].nm}</span><span class="m-d">${fD(b.data)}</span><span class="t-side">${b.side}</span></div><div class="m2">km ${fK(b.km0)} → ${fK(b.km1)} · ${fm(b.ext,0)} m${b.larg?` · ${fm(b.larg,2)} m de largura`:''}${b.esp?` · ${fm(b.esp*100,1)} cm`:''}</div><div class="m2">MP ${b.mp} · item ${b.item}${b.qtd?` · ${fm(b.qtd,3)} ${b.lay==='capa'?'T':'m³'}`:''}${b.ponto?' · extensão estimada':b.inf?' · lado deduzido':''}</div></td></tr>`;
const MOB_SORT_SKIP=new Set(['fl','obs']);
function fillSort(){
  const T=TBL[tab],s=ST[tab],sel=document.getElementById('mSort');
  sel.innerHTML=T.cols.filter(c=>!MOB_SORT_SKIP.has(c[0])).map(c=>[1,-1].map(d=>`<option value="${c[0]}|${d}">${c[1]} ${d>0?'↑':'↓'}</option>`).join('')).join('');
  sel.value=s.k+'|'+s.d;
}
document.getElementById('mSort').addEventListener('change',e=>{
  const[k,d]=e.target.value.split('|');ST[tab].k=k;ST[tab].d=+d;lim=200;buildTable();
});
let curRows=[];
function buildTable(){
  const T=TBL[tab],s=ST[tab];
  document.getElementById('tCap').textContent=T.cap;
  document.getElementById('th').innerHTML='<tr>'+T.cols.map(c=>`<th data-k="${c[0]}"${c[2]?' class="t-right"':''}>${c[1]}${s.k===c[0]?`<span class="arrow">${s.d>0?'▲':'▼'}</span>`:''}</th>`).join('')+'</tr>';
  curRows=T.rows().sort((a,b)=>{
    const va=T.val(a,s.k),vb=T.val(b,s.k);
    return(typeof va==='string'?va.localeCompare(vb):va-vb)*s.d||(tab==='ov'?(b.o.cert-a.o.cert):0);
  });
  document.getElementById('tCount').textContent=fm(curRows.length)+' registros';
  fillSort();
  const ff=document.getElementById('mFiltro');
  ff.innerHTML=`<span>Período ${mLab(mFrom)} a ${mLab(mTo)}${sf?' · Lado '+sf:''}${hid.size?' · sem '+[...hid].map(i=>LM[i].nm.replace(/ \(.*/,'')).join(', '):''}</span><button type="button" onclick="setMT('map')">Filtrar no mapa</button>`;
  paint();
}
function paint(){
  const T=TBL[tab];
  const m=MOB.matches;
  document.getElementById('tb').innerHTML=curRows.slice(0,lim).map((r,i)=>m?T.trm(r,i):T.tr(r,i)).join('');
  document.getElementById('tMore').hidden=curRows.length<=lim;
}
function moreRows(){lim+=300;paint();}
/* Celular: abas da barra inferior. O mapa fica oculto fora da aba Mapa; guarda e devolve a rolagem dele */
/* Aba Mapa: usa a folga da tela para deixar a pista mais alta, sem que o cartão aberto (folha no rodapé) cubra o mapa */
function fitMap(){
  const root=document.documentElement;
  if(!MOB.matches||mt!=='map'||scrollY>0)return;
  root.style.setProperty('--vs','1.22');
  const dockB=document.querySelector('.dock').getBoundingClientRect().bottom,allB=document.querySelector('.chips').getBoundingClientRect().bottom;
  const sheet=210,bar=96;
  const free=Math.min(innerHeight-bar-allB,innerHeight-bar-sheet-8-dockB);
  root.style.setProperty('--vs',String(Math.max(.9,Math.min(2.3,1.22+free/160)).toFixed(3)));
  /* a folha do cartão ocupa só o espaço entre o mapa e a barra de abas */
  const sb=document.querySelector('.dock').getBoundingClientRect().bottom;
  root.style.setProperty('--sheet-max',Math.round(Math.max(150,Math.min(320,innerHeight-bar-8-sb)))+'px');
}
function setMT(n){
  if(n===mt)return;
  if(mt==='map')mapScroll=scrollEl.scrollLeft;
  hideCardNow();
  mt=n;document.body.dataset.mt=n;
  document.querySelectorAll('.mtab').forEach(b=>b.classList.toggle('on',b.dataset.mt===n));
  if(n==='map'){render();scrollEl.scrollLeft=mapScroll;fitMap();}
  else{const d=document.querySelector('.notes');if(d)d.open=true;if(n==='tab')buildTable();}
  window.scrollTo(0,0);
}
MOB.addEventListener('change',()=>{render();buildTable();}); /* girar/redimensionar muda entre tabela e lista */
document.getElementById('th').addEventListener('click',e=>{
  const th=e.target.closest('th[data-k]');if(!th)return;
  const s=ST[tab],k=th.dataset.k;
  if(s.k===k)s.d*=-1;else{s.k=k;s.d=1;}
  lim=200;buildTable();
});
document.getElementById('tb').addEventListener('click',e=>{
  const tr=e.target.closest('tr');if(!tr)return;
  const it=tr.dataset.o!=null?curRows[+tr.dataset.o].o.b:IT[tr.dataset.k];
  if(!it)return;
  if(MOB.matches&&mt!=='map')setMT('map');
  focusItem(it);
});

/* ═══════════ Notas ═══════════ */
(function(){
  /* Notas deste contrato vêm do cadastro (notas); as de baixo valem para qualquer contrato */
  const maxA=ATE.reduce((m,a)=>a[7]>m[7]?a:m,[0,'',0,'',0,0,0,0]),altA=Math.max(0,...ATE.map(a=>a[6]));
  /* versão compartilhada: só notas de revestimento e reciclagem */
  const n=[
    CAD.fonteDados?`Fonte: ${CAD.fonteDados}.`:'',
    `Revestimento (CBUQ) e reciclagem: cada faixa vai da estaca inicial à final informadas na medição, no lado indicado (E, D ou pista inteira).`,
    `Pista inteira equivalente: trecho executado em um lado só (E ou D) conta como meia pista.`,
    ...(CAD.notas||[]).filter(t=>/revestimento|reciclagem/i.test(t)&&!/reparo|remendo|corre[çc][ãa]o de defeitos/i.test(t)),
  ].filter(Boolean);
  document.getElementById('notesList').innerHTML=n.map(t=>{const i=t.indexOf(':');return i>0&&i<=28?`<li><span class="n-t">${t.slice(0,i+1)}</span><span class="n-b">${t.slice(i+1)}</span></li>`:`<li>${t}</li>`;}).join('');
})();

/* ═══════════ Boot ═══════════ */
ocultaReparos();render();buildTable();syncTabs();fA();fitMap();
