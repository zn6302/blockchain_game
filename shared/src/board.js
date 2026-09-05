import { PLAYER_COLORS } from "./constants.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const HEXR=58, KY=0.56, DEPTH=30, OX=470, OY=240;
export const SH_DX=0.86, SH_DY=0.33;
export const MAP_PAL={
  gTop:"#3A7864", gTop2:"#356F5C", gTopHi:"#478C74", gTopLo:"#2E6353",
  gBevel:"#43876F", gWaste:"#31614F", seam:"#2B5B4B",
  gSide:["#2C5F4E","#265449","#1F463C","#193930"],
  shadow:"#215043", shadowD:"#1A4239",
  wTop:"#79C6F0", wIn:"#4BA9E6", wDeep:"#2F86C8", wLight:"#A6DDF7", wDark:"#2A6FA6",
  wSide:["#31718F","#2A6380","#22536C","#1B435A"],
  sand:"#D8C994",
  soil:["#A67C4E","#88643E","#6B4C2F","#523A23"],
  soilTop:"#B98D5B",
  rockL:"#F4F2E6", rockM:"#D2D8CE", rockD:"#9CAAAC", rockS:"#69797E", rockX:"#4A585E",
  treeL:"#A6DE93", treeM:"#7CC183", treeD:"#478E68", treeX:"#2F6B54",
  pineL:"#8FD08B", pineD:"#3F8461",
  wood:"#D2A063", woodD:"#9A6E3E", woodL:"#EFCB92",
  wall:"#F4F1E4", wallD:"#CFC9B4", wallS:"#A8A392",
  roof:"#E08C5A", roofD:"#B0643C", win:"#A3E635", smoke:"#DCE8DE"
};
export const P=MAP_PAL;

/* ---------------- 61-hex board (radius 4) ---------------- */
export const BASES={"0,-4":0, "4,-4":1, "0,4":2, "-4,4":3};
export const RING_MIX=[
  ["exchange"],
  ["mine_NOX","mine_KIBB","vault","mine_NOX","mine_KIBB","forest"],
  ["mine_KIBB","forest","mine_NOX","waste","vault","forest","mine_KIBB","waste"],
  ["forest","waste","mine_NOX","mountain","forest","waste","mine_KIBB","vault","forest","waste"],
  ["mountain","forest","waste","mountain","waste","forest","mountain","waste","forest","waste","mountain","waste"]
];
export const ZONES=(()=>{
  const out=[];
  for(let r=-4;r<=4;r++)for(let q=-4;q<=4;q++){
    if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>4) continue;
    const key=q+","+r;
    if(key in BASES){ out.push([q,r,"base",BASES[key]]); continue; }
    const d=(Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;
    const pool=RING_MIX[d];
    const h=Math.abs(q*7919+r*104729+d*31)%pool.length;
    out.push([q,r,pool[h]]);
  }
  return out;
})();
export const ZINFO={
  base    :{t:"基地",     s:"HOME",     yield:0,coin:null,elev:9},
  exchange:{t:"交易所",   s:"FEE -50%", yield:0,coin:null,elev:13},
  mine_NOX:{t:"迷因幣礦坑",s:"HIGH RISK",yield:13,coin:"MEOW",elev:0},
  mine_KIBB:{t:"貓薄荷田",s:"STEADY",   yield:9,coin:"CATN",elev:0},
  vault   :{t:"NOXCAT 金庫",s:"STABLE",  yield:6,coin:"NOX",elev:-11},
  mountain:{t:"能源峰",   s:"COOLDOWN", yield:0,coin:null,elev:20},
  forest  :{t:"森林",     s:"WOODS",    yield:0,coin:null,elev:5},
  waste   :{t:"廢棄鏈",   s:"EMPTY",    yield:0,coin:null,elev:2}
};
/* 簡化版只有一種幣，所以三種礦區的差別純粹是產量高低，名字也直接寫產量——
   完整版那種「這格產哪種幣」的判斷在簡化版不存在。地形本身（elev/外觀）不變。 */
export const SIMPLE_ZINFO={
  ...ZINFO,
  mine_NOX :{...ZINFO.mine_NOX, t:"大礦坑", s:"+$13/s", coin:"NOX"},
  mine_KIBB:{...ZINFO.mine_KIBB,t:"礦場",   s:"+$9/s",  coin:"NOX"},
  vault    :{...ZINFO.vault,    t:"小礦區", s:"+$6/s",  coin:"NOX"}
};
export function zinfoFor(mode){ return mode==="simple"?SIMPLE_ZINFO:ZINFO; }
export const ZMAP={};                                   // "q,r" → 索引（避免每幀 find）
ZONES.forEach((z,i)=>{ZMAP[z[0]+","+z[1]]=i;});
export const ZELEV=ZONES.map((z,i)=>{                   // 每格再加一點高低起伏
  const rg=rngFor(i*613+29), t=z[2];
  const j=(t==="mountain")?rg.f(-6,14):(t==="base"||t==="exchange")?0:
          (t==="vault")?rg.f(-4,2):rg.f(-6,7);
  return ZINFO[t].elev+Math.round(j);
});
export const ZSCALE=ZONES.map((z,i)=>{                   // 每格的大小略有變化（只放大，才不會露出縫）
  const rg=rngFor(i*911+53), t=z[2];
  if(t==="exchange") return 1.16;                 // 交易所這塊特別大
  if(t==="base") return 1.10;
  return 1+rg.f(0,0.09);
});
export function elevOf(q,r){const i=ZMAP[q+","+r];return i==null?0:ZELEV[i];}
export function hexXY(q,r){
  return {x:OX+HEXR*Math.sqrt(3)*(q+r/2), y:OY+HEXR*1.5*KY*r-elevOf(q,r)};
}
export function isoPts(cx,cy,f){
  f=f||1;const p=[];
  for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-90);
    p.push([cx+HEXR*f*Math.cos(a), cy+HEXR*f*Math.sin(a)*KY]);}
  return p;
}
export const PS=(p)=>p.map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" ");
export const PG=(p,fill,extra)=>`<polygon points="${PS(p)}" fill="${fill}" ${extra||""}/>`;
export const EL=(x,y,rx,ry,f,o)=>`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${f}"${o?` opacity="${o}"`:""}/>`;
export const RC=(x,y,w,h,f,r)=>`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r||0}" fill="${f}"/>`;
export function rngFor(seed){let s=(seed*2654435761)%4294967291+7;
  return {f:(a,b)=>{s=(s*1103515245+12345)%2147483648;return a+(b-a)*(s%1000)/1000;},
          i:(a,b)=>{s=(s*1103515245+12345)%2147483648;return a+s%(b-a+1);}};}

/* ---------------- props ---------------- */
export function pShadowTri(x,y,h,w){       // long cast shadow for a conical object
  return PG([[x-w*0.42,y],[x+w*0.42,y],[x+h*SH_DX+w*0.2,y+h*SH_DY]],P.shadow)
       + EL(x,y,w*0.44,w*0.17,P.shadow);
}
export function pPine(x,y,h,w){
  const sh=pShadowTri(x,y,h,w);
  let b=RC(x-w*0.055,y-h*0.16,w*0.11,h*0.2,"#6A4C2E");
  for(let t=0;t<3;t++){
    const bw=w*(1-0.2*t), by=y-h*0.12-t*h*0.24, ap=by-h*0.34;
    b+=PG([[x,ap],[x-bw/2,by],[x,by+bw*0.14]],P.pineL);
    b+=PG([[x,ap],[x+bw/2,by],[x,by+bw*0.14]],P.pineD);
    b+=PG([[x,ap],[x-bw*0.17,ap+h*0.13],[x+bw*0.10,ap+h*0.12]],P.treeM);
  }
  return [sh,b,y];
}
export function pBroad(x,y,r){
  const sh=EL(x+r*0.62,y+r*0.2,r*1.15,r*0.44,P.shadow);
  let b=RC(x-r*0.1,y-r*0.9,r*0.2,r*0.95,"#6A4C2E");
  b+=EL(x,y-r*0.95,r*1.0,r*0.72,P.treeD);
  b+=EL(x-r*0.28,y-r*1.22,r*0.72,r*0.54,P.treeM);
  b+=EL(x-r*0.42,y-r*1.36,r*0.42,r*0.3,P.treeL);
  b+=EL(x+r*0.55,y-r*0.78,r*0.42,r*0.3,P.treeX);
  return [sh,b,y];
}
export function pBush(x,y,r){
  return [EL(x+r*0.55,y+r*0.2,r*1.1,r*0.42,P.shadow),
    EL(x,y-r*0.3,r,r*0.6,P.treeD)+EL(x-r*0.28,y-r*0.5,r*0.6,r*0.38,P.treeM)
   +EL(x-r*0.4,y-r*0.62,r*0.3,r*0.2,P.treeL), y];
}
export function pRock(x,y,h,w,rg,snow){
  const top=[x+rg.f(-w*0.08,w*0.14),y-h], bl=[x-w*0.6,y+h*0.02], br=[x+w*0.62,y+h*0.02],
        mid=[x+w*0.05,y+h*0.08], rL=[x-w*0.5,y-h*rg.f(0.2,0.36)], rR=[x+w*0.55,y-h*rg.f(0.18,0.34)],
        nk=[x+w*0.02,y-h*rg.f(0.5,0.62)];
  const sh=PG([bl,br,[br[0]+h*SH_DX*0.95,br[1]+h*SH_DY*0.95],[top[0]+h*SH_DX,top[1]+h*SH_DY+h]],P.shadow)
          +EL(x+w*0.12,y+h*0.04,w*0.62,w*0.22,P.shadow);
  let b=PG([top,rL,bl,mid],P.rockL)+PG([top,mid,br,rR],P.rockD)
       +PG([top,nk,mid,rL],P.rockM)
       +PG([bl,mid,[mid[0],mid[1]+h*0.07],[bl[0]+w*0.12,bl[1]+h*0.05]],P.rockS)
       +PG([mid,br,[br[0]-w*0.1,br[1]+h*0.06]],P.rockX);
  if(snow){                                   // 雪蓋沿著山的稜線往下，不會跑出輪廓
    const f=0.36, lerp=(a,b2,t)=>[a[0]+(b2[0]-a[0])*t, a[1]+(b2[1]-a[1])*t];
    const sL=lerp(top,rL,f), sM=lerp(top,mid,f*1.25), sR=lerp(top,rR,f*0.92);
    const zL=lerp(top,rL,f*0.72), zR=lerp(top,rR,f*0.66);
    b+=PG([top,zL,sL,sM],"#FFFFFF")
     +PG([top,sM,sR,zR],"#E4EAE6");
  }
  return [sh,b,y];
}
export function pBoulder(x,y,r){
  return [EL(x+r*0.6,y+r*0.2,r*1.05,r*0.4,P.shadow),
    PG([[x-r,y],[x-r*0.45,y-r*0.92],[x+r*0.5,y-r*0.82],[x+r,y+r*0.1],[x,y+r*0.34]],P.rockD)
   +PG([[x-r*0.45,y-r*0.92],[x+r*0.5,y-r*0.82],[x+r*0.05,y-r*0.34]],P.rockM)
   +PG([[x+r*0.5,y-r*0.82],[x+r,y+r*0.1],[x+r*0.05,y-r*0.34]],P.rockS), y];
}
export function pHouse(x,y,w,h,roof,roofD,smoke){
  const d=w*0.6;
  const sh=PG([[x-w,y],[x+w,y],[x+w+(h+d)*SH_DX,y+(h+d)*SH_DY],[x-w+(h+d)*SH_DX*0.6,y+(h+d)*SH_DY]],P.shadow);
  let b=PG([[x-w,y],[x,y+d*KY],[x,y+d*KY-h],[x-w,y-h]],P.wall)
       +PG([[x+w,y],[x,y+d*KY],[x,y+d*KY-h],[x+w,y-h]],P.wallD);
  // windows + door
  b+=PG([[x-w*0.62,y-h*0.42],[x-w*0.34,y-h*0.28],[x-w*0.34,y-h*0.66],[x-w*0.62,y-h*0.8]],P.win);
  b+=PG([[x+w*0.34,y-h*0.3],[x+w*0.62,y-h*0.44],[x+w*0.62,y-h*0.82],[x+w*0.34,y-h*0.68]],"#8FB93F");
  b+=PG([[x-w*0.2,y-h*0.02],[x-w*0.02,y+d*KY*0.9],[x-w*0.02,y+d*KY*0.9-h*0.5],[x-w*0.2,y-h*0.52]],"#6E5A44");
  // roof
  b+=PG([[x-w*1.14,y-h],[x,y+d*KY-h],[x,y-h-w*0.8]],roof)
   +PG([[x+w*1.14,y-h],[x,y+d*KY-h],[x,y-h-w*0.8]],roofD)
   +PG([[x-w*1.14,y-h],[x,y-h-w*0.8],[x+w*1.14,y-h]],roof)
   +PG([[x,y-h-w*0.8],[x-w*1.14,y-h],[x-w*1.05,y-h+w*0.07],[x,y-h-w*0.72]],"#FFFFFF",'opacity=".35"');
  if(smoke){
    b+=RC(x-w*0.62,y-h-w*0.46,w*0.2,w*0.42,roofD);
    b+=EL(x-w*0.52,y-h-w*0.72,w*0.16,w*0.12,P.smoke,.85)
      +EL(x-w*0.38,y-h-w*0.98,w*0.2,w*0.15,P.smoke,.6)
      +EL(x-w*0.2,y-h-w*1.28,w*0.24,w*0.18,P.smoke,.35);
  }
  return [sh,b,y];
}
export function pFrame(x,y,h){                       // 礦井井架
  const sh=PG([[x-h*0.26,y],[x+h*0.26,y],[x+h*SH_DX+h*0.2,y+h*SH_DY],[x+h*SH_DX-h*0.12,y+h*SH_DY]],P.shadow);
  let b=PG([[x-h*0.32,y],[x-h*0.21,y],[x-h*0.05,y-h],[x-h*0.13,y-h]],P.wood)
   +PG([[x+h*0.32,y],[x+h*0.21,y],[x+h*0.05,y-h],[x+h*0.13,y-h]],P.woodD)
   +RC(x-h*0.22,y-h*0.56,h*0.44,h*0.075,P.woodL)
   +RC(x-h*0.26,y-h*0.3,h*0.52,h*0.06,P.wood);
  b+=`<circle cx="${x.toFixed(1)}" cy="${(y-h*1.02).toFixed(1)}" r="${(h*0.16).toFixed(1)}" fill="${P.woodL}"/>`
   +`<circle cx="${x.toFixed(1)}" cy="${(y-h*1.02).toFixed(1)}" r="${(h*0.07).toFixed(1)}" fill="${P.woodD}"/>`;
  b+=PG([[x-h*0.13,y-h],[x+h*0.13,y-h],[x,y-h*1.2]],"#A3E635");
  return [sh,b,y];
}
export function pCart(x,y,s,col){
  const sh=EL(x+s*0.5,y+s*0.2,s*0.95,s*0.34,P.shadow);
  const b=PG([[x-s*0.8,y-s*0.5],[x+s*0.8,y-s*0.5],[x+s*0.6,y+s*0.15],[x-s*0.6,y+s*0.15]],P.woodD)
   +PG([[x-s*0.8,y-s*0.5],[x+s*0.8,y-s*0.5],[x+s*0.55,y-s*0.62],[x-s*0.55,y-s*0.62]],P.wood)
   +EL(x,y-s*0.55,s*0.5,s*0.16,col)
   +`<circle cx="${(x-s*0.4).toFixed(1)}" cy="${(y+s*0.18).toFixed(1)}" r="${(s*0.2).toFixed(1)}" fill="#4A3A26"/>`
   +`<circle cx="${(x+s*0.4).toFixed(1)}" cy="${(y+s*0.18).toFixed(1)}" r="${(s*0.2).toFixed(1)}" fill="#4A3A26"/>`;
  return [sh,b,y];
}
export function pOre(x,y,col,rg){
  let s="";
  for(const [dx,dy,r] of [[-11,8,6],[9,5,5],[0,16,4.5]]){
    s+=PG([[x+dx,y+dy-r],[x+dx+r*0.8,y+dy],[x+dx,y+dy+r*0.9],[x+dx-r*0.8,y+dy]],col)
     +PG([[x+dx,y+dy-r],[x+dx-r*0.8,y+dy],[x+dx-r*0.2,y+dy-r*0.15]],"#FFFFFF",'opacity=".45"');
  }
  return s;
}
export function pVault(x,y,s){
  const sh=PG([[x-s,y],[x+s,y],[x+s+s*2.2*SH_DX,y+s*2.2*SH_DY],[x-s+s*1.6*SH_DX,y+s*2.2*SH_DY]],"#1B4459");
  const b=PG([[x-s,y],[x,y+s*0.5],[x,y+s*0.5-s*1.5],[x-s,y-s*1.5]],P.wall)
   +PG([[x+s,y],[x,y+s*0.5],[x,y+s*0.5-s*1.5],[x+s,y-s*1.5]],P.wallD)
   +PG([[x-s,y-s*1.5],[x,y+s*0.5-s*1.5],[x+s,y-s*1.5],[x,y-s*1.5-s*0.5]],"#E7EEE6")
   +`<circle cx="${(x-s*0.5).toFixed(1)}" cy="${(y-s*0.72).toFixed(1)}" r="${(s*0.28).toFixed(1)}" fill="#4FD1C5"/>`
   +`<circle cx="${(x-s*0.5).toFixed(1)}" cy="${(y-s*0.72).toFixed(1)}" r="${(s*0.13).toFixed(1)}" fill="#0F3A38"/>`
   +PG([[x+s*0.24,y-s*0.5],[x+s*0.72,y-s*0.74],[x+s*0.72,y-s*1.05],[x+s*0.24,y-s*0.82]],"#BFD7DA");
  return [sh,b,y];
}
export function pPier(x,y,w){
  let b="";
  for(let i=0;i<5;i++) b+=PG([[x-w+i*w*0.4,y+i*w*0.13],[x-w+i*w*0.4+w*0.36,y+i*w*0.13+w*0.12],
                             [x-w+i*w*0.4+w*0.36,y+i*w*0.13+w*0.2],[x-w+i*w*0.4,y+i*w*0.13+w*0.08]],
                             i%2?P.wood:P.woodL);
  return ["",b,y];
}
export function pCatSleep(x,y,s,fur,fur2){          // 蜷起來睡覺的貓（正面平畫，不會有透視歪斜）
  fur=fur||"#1E2617"; fur2=fur2||"#33402A";
  const LIME="#A3E635";
  const sh=EL(x+s*0.22,y+s*0.2,s*1.25,s*0.42,P.shadow,.5);
  let b="";
  // 尾巴：從身體右側繞到前面
  b+=`<path d="M${(x+s*0.72).toFixed(1)},${(y-s*0.26).toFixed(1)}
       C${(x+s*1.62).toFixed(1)},${(y-s*0.16).toFixed(1)}
        ${(x+s*1.5).toFixed(1)},${(y+s*0.42).toFixed(1)}
        ${(x+s*0.5).toFixed(1)},${(y+s*0.3).toFixed(1)}"
       fill="none" stroke="${fur}" stroke-width="${(s*0.34).toFixed(1)}" stroke-linecap="round"/>`;
  b+=EL(x+s*0.5,y+s*0.3,s*0.2,s*0.14,fur2,.9);
  // 身體
  b+=EL(x+s*0.06,y-s*0.16,s*0.98,s*0.6,fur);
  b+=EL(x+s*0.12,y-s*0.38,s*0.78,s*0.26,fur2,.85);        // 背上的亮面
  b+=EL(x+s*0.02,y-s*0.44,s*0.6,s*0.16,"#48602C",.55);
  // 頭
  const hx=x-s*0.66, hy=y-s*0.3, R=s*0.52;
  b+=PG([[hx-R*0.86,hy-R*0.34],[hx-R*0.16,hy-R*0.5],[hx-R*0.72,hy-R*1.24]],fur)
   +PG([[hx+R*0.86,hy-R*0.34],[hx+R*0.16,hy-R*0.5],[hx+R*0.72,hy-R*1.24]],fur)
   +PG([[hx-R*0.68,hy-R*0.42],[hx-R*0.3,hy-R*0.5],[hx-R*0.6,hy-R*0.98]],"#3E5228")
   +PG([[hx+R*0.68,hy-R*0.42],[hx+R*0.3,hy-R*0.5],[hx+R*0.6,hy-R*0.98]],"#3E5228");
  b+=EL(hx,hy,R,R*0.9,fur);
  // 閉著的眼睛（兩道彎）＋鼻子
  for(const k of [-1,1]){
    b+=`<path d="M${(hx+k*R*0.46-R*0.2).toFixed(1)},${(hy-R*0.02).toFixed(1)}
         Q${(hx+k*R*0.46).toFixed(1)},${(hy+R*0.2).toFixed(1)} ${(hx+k*R*0.46+R*0.2).toFixed(1)},${(hy-R*0.02).toFixed(1)}"
         fill="none" stroke="${LIME}" stroke-width="${(R*0.13).toFixed(1)}" stroke-linecap="round"/>`;
  }
  b+=PG([[hx-R*0.13,hy+R*0.3],[hx+R*0.13,hy+R*0.3],[hx,hy+R*0.5]],"#D9F2A6");
  // 前腳
  b+=EL(hx+R*0.9,hy+R*0.78,R*0.42,R*0.22,fur2)+EL(hx+R*1.6,hy+R*0.86,R*0.42,R*0.22,fur2);
  // 綠色項圈與吊牌（IP 標記）
  b+=`<path d="M${(hx-R*0.6).toFixed(1)},${(hy+R*0.72).toFixed(1)}
       Q${(hx+R*0.05).toFixed(1)},${(hy+R*1.0).toFixed(1)} ${(hx+R*0.62).toFixed(1)},${(hy+R*0.62).toFixed(1)}"
       fill="none" stroke="${LIME}" stroke-width="${(R*0.14).toFixed(1)}" stroke-linecap="round" opacity=".95"/>`;
  return [sh,b,y];
}
export function pExchange(x,y,s){                  // NOXCAT 交易所：黑色小屋＋門口睡著的黑貓
  const w=s*1.05, h=s*1.5, d=s*0.5;
  const L="#1B2218", R="#0D120C", TOP="#28321F", LIME="#A3E635";
  const bx=x+s*0.34, by=y-s*0.18;                    // 房子往右後方擺，貓睡在左前方
  const sd=(h+d)*0.55;
  const sh=PG([[bx-w,by],[bx+w,by],[bx+w+sd*SH_DX,by+sd*SH_DY],
               [bx-w+sd*SH_DX*0.6,by+sd*SH_DY]],P.shadow,'opacity=".55"');
  let b=PG([[bx-w,by],[bx,by+d],[bx,by+d-h],[bx-w,by-h]],L)
       +PG([[bx+w,by],[bx,by+d],[bx,by+d-h],[bx+w,by-h]],R)
       +PG([[bx-w,by-h],[bx,by+d-h],[bx+w,by-h],[bx,by-h-d]],TOP);
  // 屋頂貓耳
  b+=PG([[bx-w*0.9,by-h+w*0.06],[bx-w*0.3,by-h+w*0.36],[bx-w*0.66,by-h-s*0.7]],TOP)
   +PG([[bx+w*0.9,by-h+w*0.06],[bx+w*0.3,by-h+w*0.36],[bx+w*0.66,by-h-s*0.7]],"#161C12")
   +PG([[bx-w*0.76,by-h+w*0.13],[bx-w*0.44,by-h+w*0.28],[bx-w*0.62,by-h-s*0.4]],"#3E5228");
  // 招牌：綠色燭線
  b+=PG([[bx+w*0.2,by-h*0.72],[bx+w*0.95,by-h*0.42],[bx+w*0.95,by-h*0.1],[bx+w*0.2,by-h*0.4]],"#101609");
  for(let i=0;i<4;i++){
    const t0=0.3+i*0.16, px=bx+w*t0, py=by-h*0.6+w*t0*0.42, hh=s*(0.2+((i*29)%4)/13);
    b+=PG([[px,py],[px+s*0.1,py+s*0.04],[px+s*0.1,py+s*0.04-hh],[px,py-hh]],i%2?LIME:"#5F8F1C");
  }
  // 門口的門
  b+=PG([[bx-w*0.34,by+d*0.5],[bx-w*0.06,by+d*0.64],[bx-w*0.06,by+d*0.64-h*0.44],[bx-w*0.34,by+d*0.5-h*0.44]],"#2A3524");
  const cat=pCatSleep(x-s*0.66,y+s*0.36,s*0.78);
  return [sh+cat[0], b+cat[1], y];
}
export function pSign(x,y,h,col,kind){                  // 礦區立牌：一眼看出是哪種幣
  const bw=h*0.86, bh=h*0.66;
  const sh=PG([[x-2.4,y],[x+2.4,y],[x+h*SH_DX+3,y+h*SH_DY],[x+h*SH_DX-2,y+h*SH_DY]],P.shadow)
          +EL(x,y,h*0.3,h*0.12,P.shadow);
  let b=RC(x-1.8,y-h,3.6,h,P.woodD);
  const bx=x-bw/2, by=y-h-bh*0.78;
  b+=RC(bx,by,bw,bh,"#0C120C",3)
   +`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"
      rx="3" fill="none" stroke="${col}" stroke-width="1.8"/>`;
  const cx=x, cy=by+bh*0.5, r=bh*0.3;
  if(kind==="MEME"){                             // 迷因幣：菱形＋貓耳
    b+=PG([[cx,cy-r],[cx+r*0.8,cy],[cx,cy+r],[cx-r*0.8,cy]],col)
     +PG([[cx-r*0.86,cy-r*0.42],[cx-r*0.34,cy-r*0.5],[cx-r*0.66,cy-r*1.12]],col)
     +PG([[cx+r*0.86,cy-r*0.42],[cx+r*0.34,cy-r*0.5],[cx+r*0.66,cy-r*1.12]],col);
  }else if(kind==="CATN"){                       // 貓薄荷：圓粒＋葉子
    b+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r*0.8).toFixed(1)}" fill="${col}"/>`
     +PG([[cx+r*0.62,cy],[cx+r*1.35,cy-r*0.55],[cx+r*1.35,cy+r*0.55]],col)
     +`<circle cx="${(cx-r*0.28).toFixed(1)}" cy="${(cy-r*0.24).toFixed(1)}" r="${(r*0.16).toFixed(1)}" fill="#0C120C"/>`;
  }else{                                         // 穩定幣：盾
    b+=PG([[cx,cy-r*1.05],[cx+r*0.82,cy-r*0.5],[cx+r*0.7,cy+r*0.5],[cx,cy+r*1.1],
           [cx-r*0.7,cy+r*0.5],[cx-r*0.82,cy-r*0.5]],col)
     +PG([[cx,cy-r*0.55],[cx+r*0.34,cy-r*0.2],[cx,cy+r*0.5],[cx-r*0.34,cy-r*0.2]],"#0C120C");
  }
  return [sh,b,y];
}
export function pFlag(x,y,h,col){
  return ["",RC(x-1.2,y-h,2.4,h,P.woodD)+PG([[x+1,y-h],[x+h*0.62,y-h*0.82],[x+1,y-h*0.64]],col), y];
}

/* ---------------- 單一地塊的 SVG（供 renderMap 組合整張地圖） ---------------- */
export function tileSVG(idx,myIndex){
  myIndex=myIndex??0;
  const [q,r,type,owner]=ZONES[idx], z=ZINFO[type], {x,y}=hexXY(q,r);
  const rg=rngFor(idx*97+13);
  const water=(type==="vault");
  const elev=ZELEV[idx];
  const F=ZSCALE[idx];
  const p=isoPts(x,y,F), dep=DEPTH+elev+(water?12:0)+(type==="exchange"?34:0);  // 交易所是一塊高台
  const sides=water?P.wSide:(type.startsWith("mine")?P.soil:
              (type==="mountain"?["#7C8A8C","#68767A","#556269","#434E56"]:P.gSide));
  let s=`<g class="hex" data-z="${idx}">`;
  [[1,2,3],[2,3,0],[3,4,1],[4,5,2]].forEach(([i1,i2,sh])=>{
    s+=PG([p[i1],p[i2],[p[i2][0],p[i2][1]+dep],[p[i1][0],p[i1][1]+dep]],sides[sh]);
  });
  if(type==="mountain"){                                  // 岩層橫帶（順著側面走，不會像四條黑柱）
    [[1,2],[2,3],[3,4],[4,5]].forEach(([i1,i2])=>{
      [[0.34,0.42],[0.66,0.72]].forEach(([t0,t1])=>{
        s+=PG([[p[i1][0],p[i1][1]+dep*t0],[p[i2][0],p[i2][1]+dep*t0],
               [p[i2][0],p[i2][1]+dep*t1],[p[i1][0],p[i1][1]+dep*t1]],"#000000",'opacity=".13"');
      });
    });
  }
  // ---- top face
  const inner=isoPts(x,y,0.9*F);
  if(water){
    s+=PG(p,P.sand,`class="top" stroke="${P.wDark}" stroke-width="1.6" stroke-linejoin="round"`);
    s+=PG(isoPts(x,y+1,0.93*F),P.wTop);
    s+=PG(isoPts(x,y+3,0.72*F),P.wIn);
    s+=PG(isoPts(x,y+5,0.44*F),P.wDeep);
    for(let i=0;i<3;i++)
      s+=RC(x+rg.f(-26,4),y+rg.f(-16,18),rg.f(16,34),3.2,P.wLight,1.6);
  }else{
    const GTOPS=["#2A5C4E","#2F6555","#356F5C","#3A7864","#40836D","#478C74"];
    const gi=type==="exchange"?5:clamp(Math.round((elev+9)/7)+rg.i(-1,1),0,5);
    const base=type==="waste"?P.gWaste:GTOPS[gi];
    s+=PG(p,base,`class="top" stroke="${P.seam}" stroke-width="1.4" stroke-linejoin="round"`);
    s+=PG([p[5],p[0],p[1],inner[1],inner[0],inner[5]],P.gBevel,'opacity=".5"');
  }
  if(type.startsWith("mine")){                            // 階梯礦坑
    [[0.78,3,P.soilTop],[0.6,9,P.soil[0]],[0.44,15,P.soil[1]],[0.28,20,P.soil[2]],[0.14,24,P.soil[3]]]
      .forEach(([f,dy,c])=>{s+=PG(isoPts(x+2,y+dy,f),c);});
  }
  let sh="", bd="";
  const props=[];                                  // 前景物件（會擋住角色）
  const add=(pr)=>{sh+=pr[0];props.push({y:pr[2]!=null?pr[2]:y,s:pr[1]});};
  // 草地細節
  if(!water&&!type.startsWith("mine")){
    for(let i=0;i<rg.i(3,6);i++){
      const a2=rg.f(0,6.283), rad=rg.f(10,HEXR*0.68);
      const gx=x+Math.cos(a2)*rad, gy=y+Math.sin(a2)*rad*KY;
      s+=EL(gx,gy,rg.f(5,10),rg.f(2,3.4),type==="waste"?"#2B5747":"#40806A",.9);
    }
  }
  if(type==="base"){
    s+=PG(isoPts(x,y,0.93*F),"none",`stroke="${PLAYER_COLORS[owner]}" stroke-width="${owner===myIndex?3.4:2.2}"
        stroke-linejoin="round" opacity="${owner===myIndex?.95:.7}"`);
    if(owner===myIndex) s+=PG(isoPts(x,y,0.8*F),PLAYER_COLORS[myIndex],'opacity=".08"');
    add(pHouse(x+4,y+12,15,14,PLAYER_COLORS[owner],"#1E2A1C",true));
    add(pHouse(x-24,y+20,10,9,PLAYER_COLORS[owner],"#1E2A1C",false));
    add(pFlag(x+26,y+4,30,PLAYER_COLORS[owner]));
    add(pBush(x+30,y+20,7));
    add(pPine(x-32,y+2,30,15));
  }else if(type==="exchange"){
    add(pExchange(x,y+12,21));
    add(pBush(x-46,y-2,7));add(pBush(x+48,y-4,6));      // 草叢挪到左右後方，別擋到貓
    add(pFlag(x-34,y-12,24,"#A3E635"));
  }else if(type==="mine_NOX"||type==="mine_KIBB"){
    const nox=type==="mine_NOX", col=nox?"#F5A524":"#4FD1C5";   // 迷因幣＝橘、貓薄荷＝青
    s+=EL(x+2,y+8,HEXR*0.55,HEXR*0.55*KY,col,.12);          // 地面色圈
    s+=`<ellipse cx="${(x+2).toFixed(1)}" cy="${(y+8).toFixed(1)}" rx="${(HEXR*0.55).toFixed(1)}"
        ry="${(HEXR*0.55*KY).toFixed(1)}" fill="none" stroke="${col}" stroke-width="2"
        stroke-dasharray="${nox?"7 6":"3 5"}" opacity=".55"/>`;
    bd+=pOre(x+2,y+4,col,rg);
    add(pFrame(x-26,y+2,34));
    add(pSign(x+22,y+15,17,col,nox?"MEME":"CATN"));
    add(pCart(x+8,y+20,8,col));
    for(let i=0;i<3;i++) add(pBoulder(x+rg.f(-40,40),y+rg.f(-14,-2),rg.f(5,8)));
  }else if(type==="vault"){
    add(pPier(x-30,y+14,16));
    add(pVault(x+4,y-2,17));
    add(pSign(x+26,y+12,15,"#A3E635","NOX"));
  }else if(type==="mountain"){
    add(pRock(x+6,y+10,rg.f(52,64),rg.f(48,60),rg,true));
    add(pRock(x-24,y+16,rg.f(26,36),rg.f(28,36),rg,rg.i(0,2)===0));
    for(let i=0;i<rg.i(2,3);i++) add(pBoulder(x+rg.f(-38,38),y+rg.f(4,18),rg.f(5,9)));
    add(pPine(x+30,y+18,24,12));
  }else if(type==="forest"){
    const n=rg.i(5,7), spots=[];
    for(let k=0;k<30&&spots.length<n;k++){
      const a2=rg.f(0,6.283), rad=rg.f(0,HEXR*0.6);
      const fx=x+Math.cos(a2)*rad, fy=y+Math.sin(a2)*rad*KY;
      if(spots.some(t=>Math.abs(t[0]-fx)<17&&Math.abs(t[1]-fy)<9)) continue;
      spots.push([fx,fy]);
    }
    spots.sort((m,n2)=>m[1]-n2[1]).forEach(([fx,fy],k)=>{
      if(k%3===2) add(pBroad(fx,fy,rg.f(9,13)));
      else add(pPine(fx,fy,rg.f(28,42),rg.f(14,19)));
    });
  }else{                                                   // waste
    for(let i=0;i<rg.i(2,4);i++) add(pBoulder(x+rg.f(-40,40),y+rg.f(-10,16),rg.f(5,10)));
    if(rg.i(0,2)===0) add(pPine(x+rg.f(-22,22),y+rg.f(2,14),rg.f(22,30),12));
    if(rg.i(0,2)===0) add(pBush(x+rg.f(-30,30),y+rg.f(0,16),rg.f(6,9)));
  }
  return {g:s+sh+bd+"</g>", props};
}

