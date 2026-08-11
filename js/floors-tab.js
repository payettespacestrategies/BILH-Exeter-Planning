// =====================================================================
// FLOOR PLANS TAB — the Burlington Site Scenarios interaction on the
// Exeter floor plates.
//
//  · Program blocks live inside their unit-type colour band. Every block
//    (existing units included) has a ×factor; added blocks are sized by
//    a beds field; custom blocks by SF.
//  · A block can be placed across SEVERAL floors: drop it once, and the
//    swatch fades by the placed fraction — the solid remainder stays
//    draggable onto another level (remaining SF shown beside it and in
//    the tooltip).
//  · On a canvas: drag a placed region to move it — including onto a
//    different level's canvas; double-click removes that placement.
//  · 📐 Draw Section drags a 45°-snap cut line shown on every level of
//    the building, with a stacked section view below.
//
// All of it lives on the active Bed Recap scenario → Export JSON.
// =====================================================================

// Sheets are drawn at different scales (1/8" for most, 1/16" for East Wing and
// CUP), so a mask cell is not always exactly 9 SF — read it per plan.
function flCellSf(lvKey){ return FLOOR_SRC[flSrcKey(lvKey)].cellSf || 9; }
function flFtPerUnit(lvKey){ return FLOOR_SRC[flSrcKey(lvKey)].ftPerUnit || (8/72); }
var FL_BLOCK_HT = 12;             // drawn room height in section (ft)
// Key Buildings uses the six composite campus-level SVGs supplied with the
// drawing set. Program still lives in the single-building floorPlace state;
// these transforms only translate between a composite SVG and that same state.
var FL_SITE_VIEW_ENABLED = true;
// Key Buildings is the default view — the campus levels read first, and the
// single-building tabs are the drill-down.
var FL = { building:"west", viewAll:true, _drag:null, _moveDrag:null, _sectionMode:false,
           _fills:null, _canvasRedraws:[] };

// Composite campus level -> individual building level. `s/tx/ty` map a
// single-building sheet point to the supplied composite SVG:
//     composite = sheet * s + [tx, ty]
// East Wing and West Wing start higher on the campus datum; the composite
// level number therefore intentionally differs from the local level number.
//
// Levels 3 and 4 were re-issued on 11 Aug as separate drawings. Level 3 adds
// Northwest Wing L1; the latest Level 4 supplies complete East/West L3 plates.
var FL_KEY_VB = [0,0,6973.28,5874.38];
var FL_KEY_LEVELS = {
  1:{file:"assets/key-buildings/LEVEL 1.svg",parts:[
    {bldg:"mob",   lvKey:"mob_l1",   s:1,tx:3023.32,ty:317.96},
    {bldg:"occ",   lvKey:"occ_l1",   s:1,tx:1609.36,ty:396.19},
    {bldg:"perry", lvKey:"perry_l1", s:1,tx:2217.37,ty:1310.27}
  ]},
  2:{file:"assets/key-buildings/LEVEL 2.svg?v=4.6",parts:[
    {bldg:"east",  lvKey:"east_g",   s:1,tx:0,ty:0},
    {bldg:"perry", lvKey:"perry_l2", s:1,tx:2217.37,ty:1308.42},
    {bldg:"occ",   lvKey:"occ_l2",   s:1,tx:1608.59,ty:396.19},
    {bldg:"mob",   lvKey:"mob_l2",   s:1,tx:3023.33,ty:317.43}
  ],labels:[
    {text:"NORTHWEST WING B",box:[2365.24,2678.86,1248.51,1124.89],dir:[-1,0]}
  ]},
  3:{file:"assets/key-buildings/LEVEL 3.svg?v=4.6",parts:[
    {bldg:"east",  lvKey:"east_l1",  s:1.698,tx:1986.00,ty:2716.00,siteMaskKey:"LEVEL3_EAST_L1"},
    {bldg:"perry", lvKey:"perry_l3", s:1,tx:2217.37,ty:1305.27},
    {bldg:"nw",    lvKey:"nw_l1",    s:1,tx:1770.18,ty:2402.89},
    {bldg:"occ",   lvKey:"occ_l3",   s:1,tx:1608.59,ty:396.19},
    {bldg:"mob",   lvKey:"mob_l3",   s:1,tx:3023.33,ty:317.43}
  ]},
  4:{file:"assets/key-buildings/LEVEL 4.svg?v=4.6",parts:[
    {bldg:"occ",  lvKey:"occ_l4",  s:1,tx:1608.59,ty:396.19},
    {bldg:"mob",  lvKey:"mob_l4",  s:1,tx:3023.33,ty:317.44},
    {bldg:"west", lvKey:"west_l3", s:1,tx:1282.70,ty:3410.00},
    {bldg:"east", lvKey:"east_l3", s:1.756979449,tx:2056.04123,ty:2703.10175}
  ]},
  5:{file:"assets/key-buildings/LEVEL 5.svg",parts:[
    {bldg:"east", lvKey:"east_l3", s:1.756979449,tx:2056.04123,ty:2703.10175},
    {bldg:"west", lvKey:"west_l3", s:1,tx:1282.70,ty:3410.00}
  ]},
  6:{file:"assets/key-buildings/LEVEL 6.svg",parts:[
    {bldg:"west", lvKey:"west_l4", s:1,tx:1282.70,ty:3410.00},
    {bldg:"east", lvKey:"east_l4", s:1.756979449,tx:2056.77123,ty:2703.06175}
  ]}
};

function flScenario(){
  var sc=rcScenario();
  if(!sc.floorPlace) sc.floorPlace={};
  if(!Array.isArray(sc.customBlocks)) sc.customBlocks=[];
  if(!Array.isArray(sc.unitInstances)) sc.unitInstances=[];
  if(!sc.blockFactor) sc.blockFactor={};
  if(!sc.sections) sc.sections={};
  if(!sc.f2f) sc.f2f=14;
  // migrate v0.2 single-placement format {bid:{lv,seed}} → {bid:[{lv,seed},…]}
  for(var bid in sc.floorPlace){
    if(sc.floorPlace[bid] && !Array.isArray(sc.floorPlace[bid])) sc.floorPlace[bid]=[sc.floorPlace[bid]];
  }
  return sc;
}
function flPlanKey(bldgId, lvIdx){
  for(var k in FLOOR_LEVELS){ var v=FLOOR_LEVELS[k]; if(v[1]===bldgId && v[2]==="Level "+lvIdx) return k; }
  return null;
}
function flSrcKey(lvKey){ return FLOOR_LEVELS[lvKey][0]; }
function flBuildingsWithPlans(){
  var ids={}; for(var k in FLOOR_LEVELS) ids[FLOOR_LEVELS[k][1]]=1;
  return S.buildings.filter(function(b){ return ids[b.id]; });
}
function flLevelsOf(bldgId){
  var out=[];
  for(var k in FLOOR_LEVELS){
    var v=FLOOR_LEVELS[k];
    if(v[1]===bldgId) out.push({key:k, label:v[2], n:v[2]==="Ground"?0:Number(v[2].replace("Level ",""))});
  }
  out.sort(function(a,b){ return a.n-b.n; });   // lowest level first
  return out;
}

// ── Blocks ──────────────────────────────────────────────────────────
function flFactor(id){ var f=Number(flScenario().blockFactor[id]); return (isNaN(f)||f<=0)?1:f; }
function flBlocks(){
  var sc=flScenario();
  var out = rcUnitBlocks().map(function(b){
    return {id:b.id, name:b.name, short:b.short, sf:Math.round(b.gsf*flFactor(b.id)),
            baseSf:b.gsf, color:utypeHex(b.type), type:b.type,
            beds:b.beds, note:b.note, kind:"unit"};
  });
  sc.unitInstances.forEach(function(u){
    var ut=utype(u.type);
    var sf=Math.round((Number(u.beds)||0)*bgsfPerBed()*(Number(S.typeFactors[u.type])||1));
    out.push({id:u.id, name:ut.name+" — new unit", short:ut.name+" (new)", sf:sf, color:utypeHex(u.type),
              type:u.type, beds:Number(u.beds)||0, note:"added block — size it with the beds field", kind:"new"});
  });
  sc.customBlocks.forEach(function(c){
    out.push({id:c.id, name:c.name, short:c.name, sf:Number(c.sf)||0, color:c.color||"#C5E1FF",
              type:null, beds:0, note:"custom block", kind:"custom"});
  });
  return out;
}
function flBlockById(id){ var bs=flBlocks(); for(var i=0;i<bs.length;i++){ if(bs[i].id===id) return bs[i]; } return null; }
function flPlacements(bid){ var p=flScenario().floorPlace[bid]; return Array.isArray(p)?p:[]; }

// ── Fill computation — all levels at once, cached per rebuild ───────
// A block's placements consume its cell budget in order; each placement
// BFS-fills from its seed with whatever budget is left, so the same
// block can span several floors (Burlington's consumed/remaining model).
function flComputeAll(){
  if(FL._fills) return FL._fills;
  var sc=flScenario();
  var per={};              // lvKey -> {taken:{}, cells:{placeKey:[...]}}
  function lv(l){ if(!per[l]) per[l]={taken:{}, cells:{}}; return per[l]; }
  // Budgets are carried in SQUARE FEET, not cells, because a block can span
  // plans drawn at different scales (1/8" vs 1/16" sheets).
  var block={};            // bid -> {need, got, left} all in SF
  flBlocks().forEach(function(blk){
    var left=blk.sf, got=0;
    flPlacements(blk.id).forEach(function(pl,pi){
      var L=lv(pl.lv);
      var mask=FLOOR_MASKS[flSrcKey(pl.lv)];
      var csf=flCellSf(pl.lv);
      var key=blk.id+"#"+pi;
      var wantCells = left>0 ? Math.max(1,Math.round(left/csf)) : 0;
      var cells = wantCells ? flFill(mask, L.taken, pl.seed[0], pl.seed[1], wantCells, key) : [];
      L.cells[key]=cells;
      left-=cells.length*csf; got+=cells.length*csf;
    });
    block[blk.id]={need:blk.sf, got:got, left:Math.max(0,left)};
  });
  FL._fills={per:per, block:block};
  return FL._fills;
}
function flFill(mask, taken, sx, sy, need, key){
  var W=mask.w,H=mask.h,rows=mask.rows;
  function free(x,y){ return x>=0&&y>=0&&x<W&&y<H && rows[y].charAt(x)==="0" && !taken[x+","+y]; }
  if(!free(sx,sy)){
    var best=null,bd=1e18;
    for(var y=0;y<H;y++) for(var x=0;x<W;x++){
      if(free(x,y)){ var d=(x-sx)*(x-sx)+(y-sy)*(y-sy); if(d<bd){bd=d;best=[x,y];} }
    }
    if(!best) return [];
    sx=best[0]; sy=best[1];
  }
  var out=[],seen={},h=[[0,sx,sy]];
  function push(d,x,y){ h.push([d,x,y]); h.sort(function(a,b){return a[0]-b[0];}); }
  seen[sx+","+sy]=1;
  while(h.length&&out.length<need){
    var it=h.shift(), x=it[1],y=it[2];
    if(!free(x,y)) continue;
    out.push([x,y]); taken[x+","+y]=key;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dv){
      var nx=x+dv[0],ny=y+dv[1],k2=nx+","+ny;
      if(!seen[k2]&&free(nx,ny)){ seen[k2]=1; push((nx-sx)*(nx-sx)+(ny-sy)*(ny-sy),nx,ny); }
    });
  }
  return out;
}
function flLevelFills(lvKey){ var a=flComputeAll(); return a.per[lvKey]||{taken:{},cells:{}}; }
function flBlockStatus(bid){ var a=flComputeAll(); return a.block[bid]||{need:0,got:0,left:0}; }
function flLevelStats(lvKey){
  var mask=FLOOR_MASKS[flSrcKey(lvKey)];
  var freeCells=0;
  for(var y=0;y<mask.h;y++) freeCells+=(mask.rows[y].match(/0/g)||[]).length;
  var f=flLevelFills(lvKey), placed=0;
  for(var k in f.cells) placed+=f.cells[k].length;
  var csf=flCellSf(lvKey);
  return {usable:freeCells*csf, placed:placed*csf, freeLeft:(freeCells-placed)*csf};
}

// ====================================================================
// TAB
// ====================================================================
// ?fldemo seeds a demo layout (used for screenshots / walkthroughs)
var _flDemoDone=false;
function flMaybeDemo(){
  if(location.search.indexOf("flsite")>=0){ FL_SITE_VIEW_ENABLED=true; FL.viewAll=true; }
  var mb=/[?&]flbldg=(\w+)/.exec(location.search);
  if(mb && flPlanKey(mb[1],1)){ FL.building=mb[1]; FL.viewAll=false; }
  if(_flDemoDone || location.search.indexOf("fldemo")<0) return;
  _flDemoDone=true;
  var sc=flScenario();
  sc.unitInstances.push({id:"N_obs_1",type:"obs",beds:14});
  sc.floorPlace={
    "W3":[{lv:"west_l3",seed:[20,10]},{lv:"west_l4",seed:[20,10]}],
    "N_obs_1":[{lv:"west_l1",seed:[34,14]}]
  };
  sc.sections["west"]={x1:500,y1:820,x2:2010,y2:820};
}
function tabFloors(){
  flMaybeDemo();
  FL._fills=null;
  var v=el("div");
  var top=el("div",{style:"display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px"});
  top.appendChild(el("span",{class:"eyebrow"},["Scenario"]));
  var sel=el("select",{style:"font-family:inherit;font-weight:900;font-size:13px;border:1px solid var(--ink);background:#fff;padding:5px 9px;color:var(--ink);max-width:340px"});
  RC.scenarios.forEach(function(s,i){
    var o=el("option",{value:String(i)},[s.name]); if(i===RC.active)o.selected=true; sel.appendChild(o);
  });
  sel.addEventListener("change",function(e){ RC.active=Number(e.target.value); render(); });
  top.appendChild(sel);
  top.appendChild(el("span",{class:"hint",style:"margin:0 0 0 8px"},[
    "Drag a block onto a level — it fills the white area from the drop point. What doesn't fit stays solid in the panel: drag the remainder onto another floor. Drag placed program between floors; double-click removes a placement. 📐 draws a section."
  ]));
  v.appendChild(top);

  var row=el("div",{style:"display:grid;grid-template-columns:252px 1fr;gap:16px;align-items:start"});
  var pp=el("div",{id:"fl-panel",style:"max-height:1500px;overflow-y:auto;padding-right:2px"}); flBuildPanel(pp); row.appendChild(pp);
  var main=el("div",{id:"fl-main"}); flBuildMain(main); row.appendChild(main);
  v.appendChild(row);
  return v;
}
function flRebuild(){
  FL._fills=null;
  var pp=document.getElementById("fl-panel"); if(pp) flBuildPanel(pp);
  var mn=document.getElementById("fl-main"); if(mn) flBuildMain(mn);
}

// ====================================================================
// LEFT PANEL — blocks grouped in their unit-type colour bands
// ====================================================================
function flSwatch(sf, color, placedFrac){
  var AR=1.5, SCALE=0.42;
  var dw=Math.max(10,Math.round(Math.sqrt(Math.max(1,sf)*AR)*SCALE));
  var dh=Math.max(7,Math.round(Math.sqrt(Math.max(1,sf)/AR)*SCALE));
  var sw=el("div",{style:[
    "position:relative","width:"+dw+"px","height:"+dh+"px","flex-shrink:0",
    "background:"+color,"border:1.5px solid "+darkenColor(color,0.3),
    "box-sizing:border-box","overflow:hidden"
  ].join(";")});
  if(placedFrac>0){
    sw.appendChild(el("div",{style:[
      "position:absolute","left:0","top:0","bottom:0","width:"+(Math.min(1,placedFrac)*100)+"%",
      "background:rgba(255,255,255,0.72)","border-right:1.5px dashed "+darkenColor(color,0.4)
    ].join(";")}));
  }
  return sw;
}
// One block row: swatch (faded by placed fraction) + name + size control +
// remaining figure at the right of the swatch; solid remainder is draggable.
function flChip(blk, sizeCtl, delBtn){
  var sc=flScenario();
  var st=flBlockStatus(blk.id);
  var placedSF=st.got;
  var remainSF=Math.max(0, blk.sf-placedSF);
  var placedFrac=blk.sf? placedSF/blk.sf : 0;
  var placements=flPlacements(blk.id);
  var canDrag=remainSF>=20;      // ignore rounding dust

  var whereTxt=placements.map(function(p){
    return FLOOR_LEVELS[p.lv][2].replace("Level ","L")+" "+bldgName(FLOOR_LEVELS[p.lv][1]);
  }).join(", ");
  var row=el("div",{
    draggable: canDrag? "true":"false",
    title:blk.name+" — "+fmt(blk.sf)+" SF"+(blk.beds?" · "+blk.beds+" beds":"")+
      (placements.length? "\nplaced "+fmt(placedSF)+" SF on "+whereTxt : "")+
      "\nremaining "+fmt(remainSF)+" SF"+
      (canDrag? (placements.length? " — drag to place the remainder":" — drag onto a floor plan"):" (fully placed)")+
      (blk.note? "\n"+blk.note:""),
    style:[
      "display:flex","align-items:center","gap:7px","padding:4px 0","user-select:none",
      "cursor:"+(canDrag?"grab":"default")
    ].join(";")
  });
  row.appendChild(flSwatch(blk.sf, blk.color, placedFrac));

  var info=el("div",{style:"flex:1;min-width:0"});
  var l1=el("div",{style:"display:flex;align-items:center;gap:4px;flex-wrap:wrap"});
  l1.appendChild(el("span",{style:"font-weight:900;font-size:11.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:104px"},[blk.name]));
  if(sizeCtl) sizeCtl.forEach(function(x){ l1.appendChild(x); });
  info.appendChild(l1);
  var l2=fmt(blk.sf)+" SF"+(blk.beds?" · "+blk.beds+" beds":"");
  if(placements.length){
    l2 = remainSF>=20
      ? fmt(remainSF)+" SF left of "+fmt(blk.sf)
      : "placed · "+whereTxt;
  }
  info.appendChild(el("div",{style:"font-size:10.5px;color:"+(placements.length&&remainSF>=20?"#c07f00":"var(--mut)")+";font-feature-settings:'tnum' 1;font-weight:"+(placements.length&&remainSF>=20?"900":"400")},[l2]));
  row.appendChild(info);

  if(placements.length){
    row.appendChild(el("button",{class:"delb",title:"Return the whole block to the panel",onclick:function(){
      delete sc.floorPlace[blk.id]; flRebuild();
    }},["✕"]));
  }
  if(delBtn) row.appendChild(delBtn);

  row.addEventListener("dragstart",function(e){
    if(!canDrag){ e.preventDefault(); return; }
    FL._drag=blk.id; e.dataTransfer.effectAllowed="move";
  });
  row.addEventListener("dragend",function(){ FL._drag=null; });
  return row;
}
function flBuildPanel(c){
  var _sc=c.scrollTop;
  c.innerHTML="";
  var sc=flScenario();
  var blocks=flBlocks();

  c.appendChild(el("h3",{style:"margin:0 0 10px"},["Program Blocks"]));

  // one colour band per unit type, holding its existing units AND added blocks
  UNIT_TYPES.forEach(function(ut){
    var mine=blocks.filter(function(b){ return b.type===ut.id; });
    var band=el("div",{style:"margin-bottom:10px;border:1px solid var(--line)"});
    var hd=el("div",{style:"display:flex;align-items:center;gap:6px;padding:6px 10px;background:"+utypeHex(ut.id)});
    hd.appendChild(el("span",{style:"font-weight:900;font-size:12.5px;color:#233044;flex:1"},[ut.name]));
    hd.appendChild(el("span",{style:"font-size:10px;font-weight:700;color:#233044;background:rgba(255,255,255,.72);padding:1px 7px;border-radius:9px;white-space:nowrap"},[
      fmt(bgsfPerBed()*(Number(S.typeFactors[ut.id])||1))+" SF/bed"
    ]));
    hd.appendChild(el("button",{
      title:"Add a "+ut.name+" block — size it with the beds field",
      style:"width:20px;height:20px;border:1px solid rgba(35,48,68,.4);background:rgba(255,255,255,.85);border-radius:3px;cursor:pointer;font-weight:900;line-height:1;padding:0;flex-shrink:0",
      onclick:function(){
        var n=1; while(sc.unitInstances.some(function(u){return u.id==="N_"+ut.id+"_"+n;})) n++;
        sc.unitInstances.push({id:"N_"+ut.id+"_"+n, type:ut.id, beds: ut.id==="obs"?12:16});
        flRebuild();
      }
    },["+"]));
    band.appendChild(hd);
    var body=el("div",{style:"padding:5px 10px;display:flex;flex-direction:column;gap:1px"});
    if(!mine.length){
      body.appendChild(el("div",{style:"font-size:10.5px;color:var(--faint);font-style:italic;padding:2px 0"},["No blocks — click + to add one."]));
    }
    mine.forEach(function(b){
      if(b.kind==="unit"){
        // existing unit — resizable with a ×factor, like every Burlington block
        var fInp=el("input",{type:"text",value:String(flFactor(b.id)),title:"Scale factor for this block",
          style:"width:30px;font-size:11px;font-weight:900;border:1px solid rgba(35,48,68,.35);background:#fff;padding:0 2px;text-align:center;font-family:inherit;color:var(--ink)"});
        fInp.addEventListener("click",function(e){ e.stopPropagation(); });
        fInp.addEventListener("mousedown",function(e){ e.stopPropagation(); });
        fInp.addEventListener("change",function(){
          var v=parseFloat(fInp.value.replace(/[^0-9.]/g,""));
          sc.blockFactor[b.id]=(isNaN(v)||v<=0)?1:Math.round(v*100)/100;
          flRebuild();
        });
        body.appendChild(flChip(b,[el("span",{style:"font-size:10.5px;font-weight:900;color:var(--mut)"},["×"]),fInp]));
      } else {
        // added block — sized by beds
        var u=null; sc.unitInstances.forEach(function(x){ if(x.id===b.id) u=x; });
        var bedsInp=el("input",{type:"text",value:String(u.beds),title:"Beds in this block — drives its area",
          style:"width:28px;font-size:11px;font-weight:900;border:1px solid rgba(35,48,68,.35);background:#fff;padding:0 2px;text-align:center;font-family:inherit;color:var(--ink)"});
        bedsInp.addEventListener("click",function(e){ e.stopPropagation(); });
        bedsInp.addEventListener("mousedown",function(e){ e.stopPropagation(); });
        bedsInp.addEventListener("change",function(){
          var v=parseInt(bedsInp.value.replace(/[^0-9]/g,""),10);
          u.beds=(isNaN(v)||v<1)?1:v; flRebuild();
        });
        var del=el("button",{class:"delb",title:"Delete this block",onclick:function(){
          delete sc.floorPlace[b.id];
          sc.unitInstances=sc.unitInstances.filter(function(x){return x.id!==b.id;});
          flRebuild();
        }},["🗑"]);
        body.appendChild(flChip(b,[el("span",{style:"font-size:10px;color:var(--mut)"},["beds"]),bedsInp],del));
      }
    });
    band.appendChild(body);
    c.appendChild(band);
  });

  // custom blocks
  var cu=el("div",{style:"margin-bottom:12px;border:1px solid var(--line)"});
  var chd=el("div",{style:"display:flex;align-items:center;gap:8px;padding:6px 10px;background:#C2C3C8"});
  chd.appendChild(el("span",{style:"font-weight:900;font-size:12.5px;color:#233044;flex:1"},["Custom / support"]));
  chd.appendChild(el("button",{
    title:"Add a custom block with its own SF",
    style:"width:20px;height:20px;border:1px solid rgba(35,48,68,.4);background:rgba(255,255,255,.85);border-radius:3px;cursor:pointer;font-weight:900;line-height:1;padding:0",
    onclick:function(){
      var name=prompt("Block name (e.g. Relocated Pharmacy)","New program"); if(!name) return;
      sc.customBlocks.push({id:"C"+Date.now()%1000000, name:name, sf:5000, color:"#C5E1FF"});
      flRebuild();
    }
  },["+"]));
  cu.appendChild(chd);
  var cinst=blocks.filter(function(b){return b.kind==="custom";});
  if(cinst.length){
    var cbody=el("div",{style:"padding:5px 10px;display:flex;flex-direction:column;gap:1px"});
    cinst.forEach(function(b){
      var cb=null; sc.customBlocks.forEach(function(x){ if(x.id===b.id) cb=x; });
      var sfInp=el("input",{type:"text",value:String(cb.sf),title:"Area (SF)",
        style:"width:44px;font-size:11px;font-weight:900;border:1px solid rgba(35,48,68,.35);background:#fff;padding:0 2px;text-align:right;font-family:inherit;color:var(--ink)"});
      sfInp.addEventListener("click",function(e){ e.stopPropagation(); });
      sfInp.addEventListener("mousedown",function(e){ e.stopPropagation(); });
      sfInp.addEventListener("change",function(){
        var v=parseInt(sfInp.value.replace(/[^0-9]/g,""),10);
        cb.sf=(isNaN(v)||v<50)?50:v; flRebuild();
      });
      var del=el("button",{class:"delb",title:"Delete this block",onclick:function(){
        delete sc.floorPlace[b.id];
        sc.customBlocks=sc.customBlocks.filter(function(x){return x.id!==b.id;});
        flRebuild();
      }},["🗑"]);
      cbody.appendChild(flChip(b,[el("span",{style:"font-size:10px;color:var(--mut)"},["SF"]),sfInp],del));
    });
    cu.appendChild(cbody);
  }
  c.appendChild(cu);

  // totals + level meters
  var tot=0, placedTot=0;
  blocks.forEach(function(b){ tot+=b.sf; placedTot+=flBlockStatus(b.id).got; });
  var tb=el("div",{class:"box",style:"padding:10px 12px;margin-bottom:12px;font-size:11.5px"});
  [["All blocks",fmt(tot)+" SF",""],["Placed",fmt(placedTot)+" SF",""],
   ["Unplaced remainder",fmt(Math.max(0,tot-placedTot))+" SF", tot-placedTot>0?"color:#c0392b;font-weight:900":""]
  ].forEach(function(p){
    tb.appendChild(el("div",{style:"display:flex;gap:8px;"+p[2]},[
      el("span",{style:"flex:1"},[p[0]]), el("b",{style:"font-feature-settings:'tnum' 1"},[p[1]])
    ]));
  });
  c.appendChild(tb);

  var b2=el("div",{class:"box",style:"padding:10px 12px"});
  b2.appendChild(el("h3",{style:"margin-bottom:6px;font-size:13px"},[
    FL.viewAll? "Levels — all buildings" : "Levels — "+bldgName(FL.building)
  ]));
  var meterLevels = FL.viewAll
    ? flSiteLevels().map(function(n){
        var parts=flSiteParts(n);
        return {label:"Level "+n, _parts:parts};
      })
    : flLevelsOf(FL.building);
  meterLevels.forEach(function(lv){
    var st = lv._parts
      ? lv._parts.reduce(function(a,p){ var s=flLevelStats(p.lvKey); return {usable:a.usable+s.usable, placed:a.placed+s.placed}; },{usable:0,placed:0})
      : flLevelStats(lv.key);
    var pct=st.usable? st.placed/st.usable:0;
    var r=el("div",{style:"margin:6px 0"});
    r.appendChild(el("div",{style:"display:flex;font-size:11px;gap:6px"},[
      el("b",null,[lv.label]),
      el("span",{style:"margin-left:auto;color:var(--mut);font-feature-settings:'tnum' 1"},[fmt(st.placed)+" / "+fmt(st.usable)+" SF"])
    ]));
    var bar=el("div",{style:"height:6px;background:#eef1f5;border:1px solid var(--line);position:relative"});
    bar.appendChild(el("div",{style:"position:absolute;left:0;top:0;bottom:0;width:"+Math.min(100,pct*100)+"%;background:"+(pct>0.999?"#e0a500":"var(--hlt)")}));
    r.appendChild(bar);
    b2.appendChild(r);
  });
  c.appendChild(b2);
  c.scrollTop=_sc;
}

// ====================================================================
// MAIN — building picker, level canvas grid, section
// ====================================================================
function flBuildMain(c){
  c.innerHTML="";
  FL._canvasRedraws=[];          // canvases re-register their redraws below
  var sc=flScenario();

  var hdr=el("div",{style:"display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px"});
  // Key Buildings is the supplied composite campus-level drawing. Its program
  // placements share floorPlace with every single-building level canvas.
  if(FL_SITE_VIEW_ENABLED){
    hdr.appendChild(el("button",{
      class:"seg sm"+(FL.viewAll?" on":""),
      style:"font-size:13px;padding:5px 12px",
      title:"Show every building together, one drawing per level — place program across buildings at once",
      onclick:function(){ FL.viewAll=!FL.viewAll; FL._sectionMode=false; flRebuild(); }
    },["Key Buildings"]));
  } else {
    hdr.appendChild(el("h3",{style:"margin:0 6px 0 0"},["Key Buildings"]));
  }
  flBuildingsWithPlans().forEach(function(b){
    hdr.appendChild(el("button",{class:"seg sm"+((!FL.viewAll&&FL.building===b.id)?" on":""),onclick:function(){
      FL.building=b.id; FL.viewAll=false; FL._sectionMode=false; flRebuild();
    }},[b.name]));
  });
  hdr.appendChild(el("div",{style:"flex:1"}));
  if(!FL.viewAll){
    hdr.appendChild(el("button",{
      class:"seg sm",
      title:"Draw a section cut line on any level — it appears on every level of this building. Tick marks show the viewing direction. 45° snap.",
      style:FL._sectionMode?"background:#C0392B;border-color:#C0392B;color:#fff":"",
      onclick:function(){ FL._sectionMode=!FL._sectionMode; flRebuild(); }
    },[FL._sectionMode?"✕ Cancel Section":"📐 Draw Section"]));
    if(sc.sections[FL.building]){
      hdr.appendChild(el("button",{class:"seg sm",style:"color:#C0392B",title:"Remove the section line",
        onclick:function(){ delete sc.sections[FL.building]; flRebuild(); }},["✕ Clear"]));
    }
  }
  c.appendChild(hdr);

  if(FL.viewAll){
    c.appendChild(el("p",{class:"hint",style:"margin:0 0 10px"},[
      "One supplied drawing per campus level. Drop or move program into any white building area; the matching single-building level updates automatically, and edits made there return here."
    ]));
    var grid2=el("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:12px"});
    flSiteLevels().forEach(function(n){ grid2.appendChild(flSiteLevelCanvas(n)); });
    c.appendChild(grid2);
    return;
  }

  var grid=el("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px"});
  flLevelsOf(FL.building).forEach(function(lv){ grid.appendChild(flLevelCanvas(lv)); });
  c.appendChild(grid);

  flBuildSection(c);
}

// ── all-buildings site view ─────────────────────────────────────────
function flSiteLevels(){
  return Object.keys(FL_KEY_LEVELS).map(Number).sort(function(a,b){return a-b;});
}
function flSiteParts(levelN){
  var d=FL_KEY_LEVELS[levelN]; if(!d) return [];
  return d.parts.map(function(q){
    var p={bldg:q.bldg,lvKey:q.lvKey,sx:q.sx||q.s,sy:q.sy||q.s,tx:q.tx,ty:q.ty,mismatch:q.mismatch};
    p.meta=FLOOR_SRC[flSrcKey(p.lvKey)];
    p.mask=FLOOR_MASKS[flSrcKey(p.lvKey)];
    p.siteMask=q.siteMaskKey&&typeof FL_SITE_MASKS!=="undefined"?FL_SITE_MASKS[q.siteMaskKey]:null;
    p.gx=function(sheetX){ return p.tx+sheetX*p.sx; };
    p.gy=function(sheetY){ return p.ty+sheetY*p.sy; };
    p.sheetX=function(globalX){ return (globalX-p.tx)/p.sx; };
    p.sheetY=function(globalY){ return (globalY-p.ty)/p.sy; };
    return p;
  });
}

// A composite sheet can carry a different outline from its corresponding
// single-building plan. Repack the same placed SF into a composite-native mask
// for display and hit-testing, while keeping the saved placement seed in the
// single-plan grid so both views continue to update one another.
function flSiteDisplayFills(p){
  var base=flLevelFills(p.lvKey);
  if(!p.siteMask) return base;
  if(p._siteFills) return p._siteFills;
  var out={taken:{},cells:{}}, sm=p.siteMask, canonical=p.mask;
  var canonicalCellSf=flCellSf(p.lvKey), siteCellSf=Number(sm.cellSf)||canonicalCellSf;
  for(var key in base.cells){
    var bits=key.split("#"), bid=bits[0], pi=Number(bits[1]);
    var pl=flPlacements(bid)[pi];
    if(!pl){ out.cells[key]=[]; continue; }
    var sheetX=canonical.ox+(pl.seed[0]+0.5)*canonical.cell;
    var sheetY=canonical.oy+(pl.seed[1]+0.5)*canonical.cell;
    var gx=p.gx(sheetX), gy=p.gy(sheetY);
    var sx=Math.floor((gx-sm.ox)/sm.cell), sy=Math.floor((gy-sm.oy)/sm.cell);
    var need=Math.max(0,Math.round(base.cells[key].length*canonicalCellSf/siteCellSf));
    out.cells[key]=flFill(sm,out.taken,sx,sy,need,key);
  }
  p._siteFills=out;
  return out;
}

function flSiteHitKey(hit){
  if(!hit) return null;
  var fills=flSiteDisplayFills(hit.p);
  var cell=hit.siteCell||hit.cell;
  return fills.taken[cell[0]+","+cell[1]]||null;
}
// Buildings whose label should sit on a fixed side of their plate rather than
// radially outward — used where a building sits too near the campus centre for
// the radial rule to give a sensible direction.
var FL_LABEL_DIR = { perry:[1,0], nw:[-1,0] };

function flSiteLevelCanvas(levelN){
  var levelDef=FL_KEY_LEVELS[levelN];
  var parts=flSiteParts(levelN);
  var card=el("div",{style:"border:1px solid var(--line);overflow:hidden;background:#fff"});
  var hd=el("div",{style:"display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);flex-wrap:wrap"});
  hd.appendChild(el("b",{style:"font-size:12.5px"},["Key Buildings — Campus Level "+levelN]));
  var usable=0, placed=0;
  parts.forEach(function(p){ var s=flLevelStats(p.lvKey); usable+=s.usable; placed+=s.placed; });
  hd.appendChild(el("span",{style:"font-size:10.5px;color:var(--mut)"},[
    parts.map(function(p){ return bldgName(p.bldg)+" "+FLOOR_LEVELS[p.lvKey][2].replace("Level ","L"); }).join(" · ")
  ]));
  // the supplied drawing set repeats one sheet across two campus levels, so one
  // plate per affected level cannot line up — say so rather than look broken
  var bad=parts.filter(function(p){ return p.mismatch; });
  if(bad.length){
    hd.appendChild(el("span",{
      style:"font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#9a6b00;background:#fff5db;border:1px solid #f0dca8;padding:1px 6px",
      title:bad.map(function(p){
        var head = bldgName(p.bldg)+" "+FLOOR_LEVELS[p.lvKey][2]+" \u2014 "+p.mismatch+".";
        var why  = "That building's outline layer is not in the campus drawing, so its plate "+
                   "is an open partial shape and the program outline cannot follow it. Needs a "+
                   "re-export of the drawing, not a change here.";
        return head+"\n"+why;
      }).join("\n\n")
    },["drawing mismatch"]));
  }
  hd.appendChild(el("span",{style:"margin-left:auto;font-size:10.5px;font-weight:900;font-feature-settings:'tnum' 1;color:"+(placed>=usable&&placed?"#c07f00":"var(--mut)")},[
    fmt(placed)+" / "+fmt(usable)+" SF · "+(usable?Math.round(placed/usable*100):0)+"%"
  ]));
  card.appendChild(hd);

  var contH=360;
  var holder=el("div",{style:"position:relative;width:100%;height:"+contH+"px;overflow:hidden;background:#fff"});
  card.appendChild(holder);

  var viewW=FL_KEY_VB[2], viewH=FL_KEY_VB[3];
  var innerW=0, scale=0, offX=0, offY=0;
  function layout(){
    innerW=holder.clientWidth||430;
    scale=Math.min(innerW/viewW, contH/viewH);
    offX=(innerW-viewW*scale)/2-FL_KEY_VB[0]*scale;
    offY=(contH-viewH*scale)/2-FL_KEY_VB[1]*scale;
  }
  function globalPx(gx,gy){ return [offX+gx*scale, offY+gy*scale]; }
  function pxGlobal(px,py){ return [(px-offX)/scale,(py-offY)/scale]; }
  var img=el("img",{src:levelDef.file,draggable:"false"});
  var cv=el("canvas");
  holder.appendChild(img); holder.appendChild(cv);
  var ctx=cv.getContext("2d");
  function place(){
    layout();
    img.style.cssText=[
      "position:absolute","left:"+(offX+FL_KEY_VB[0]*scale)+"px","top:"+(offY+FL_KEY_VB[1]*scale)+"px",
      "width:"+(viewW*scale)+"px","height:"+(viewH*scale)+"px",
      "user-select:none","pointer-events:none"
    ].join(";");
    cv.width=innerW; cv.height=contH;
    cv.style.cssText="position:absolute;left:0;top:0";
    draw();
  }
  function partAt(gx,gy){
    var fallback=null;
    for(var i=0;i<parts.length;i++){
      var p=parts[i];
      if(p.siteMask){
        var sm=p.siteMask;
        var scx=Math.floor((gx-sm.ox)/sm.cell), scy=Math.floor((gy-sm.oy)/sm.cell);
        if(scx>=0&&scy>=0&&scx<sm.w&&scy<sm.h){
          var sheetX=p.sheetX(gx), sheetY=p.sheetY(gy), cm=p.mask;
          var ccx=Math.floor((sheetX-cm.ox)/cm.cell), ccy=Math.floor((sheetY-cm.oy)/cm.cell);
          var siteHit={p:p,lvKey:p.lvKey,cell:[ccx,ccy],siteCell:[scx,scy]};
          if(sm.rows[scy].charAt(scx)==="0") return siteHit;
          if(!fallback) fallback=siteHit;
        }
        continue;
      }
      var sx=p.sheetX(gx), sy=p.sheetY(gy), m=p.mask;
      var cx=Math.floor((sx-m.ox)/m.cell), cy=Math.floor((sy-m.oy)/m.cell);
      if(cx>=0&&cy>=0&&cx<m.w&&cy<m.h){
        var hit={p:p,lvKey:p.lvKey,cell:[cx,cy]};
        if(m.rows[cy].charAt(cx)==="0") return hit;
        if(!fallback) fallback=hit;
      }
    }
    return fallback;
  }
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    function drawLabel(txt,c0,halfW,halfH,dir){
      ctx.font="900 9.5px Roboto, Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
      var vx=dir?dir[0]:c0[0]-cv.width/2;
      var vy=dir?dir[1]:c0[1]-cv.height/2;
      var vl=Math.sqrt(vx*vx+vy*vy)||1;
      var tw=ctx.measureText(txt).width;
      var nx=vx/vl, ny=vy/vl;
      var edgeX=Math.abs(nx)>1e-6?halfW/Math.abs(nx):Infinity;
      var edgeY=Math.abs(ny)>1e-6?halfH/Math.abs(ny):Infinity;
      var edgeDist=Math.min(edgeX,edgeY);
      var textRadius=Math.abs(nx)*tw/2+Math.abs(ny)*6.5;
      var lp=[c0[0]+nx*(edgeDist+textRadius+8), c0[1]+ny*(edgeDist+textRadius+8)];
      lp[0]=Math.max(tw/2+4, Math.min(cv.width-tw/2-4, lp[0]));
      lp[1]=Math.max(9, Math.min(cv.height-6, lp[1]));
      ctx.fillStyle="rgba(255,255,255,.9)";
      ctx.fillRect(lp[0]-tw/2-3, lp[1]-6.5, tw+6, 13);
      ctx.fillStyle="#54637d";
      ctx.fillText(txt,lp[0],lp[1]);
      ctx.textBaseline="alphabetic";
    }
    parts.forEach(function(p){
      var fills=flSiteDisplayFills(p), drawMask=p.siteMask||p.mask;
      var cellGlobalX=p.siteMask?drawMask.cell:drawMask.cell*p.sx;
      var cellGlobalY=p.siteMask?drawMask.cell:drawMask.cell*p.sy;
      for(var key in fills.cells){
        var bid=key.split("#")[0], blk=flBlockById(bid);
        if(!blk||!fills.cells[key].length) continue;
        ctx.fillStyle=blk.color; ctx.globalAlpha=0.62;
        fills.cells[key].forEach(function(cxy){
          var q=p.siteMask
            ? globalPx(drawMask.ox+cxy[0]*drawMask.cell,drawMask.oy+cxy[1]*drawMask.cell)
            : globalPx(p.gx(drawMask.ox+cxy[0]*drawMask.cell),p.gy(drawMask.oy+cxy[1]*drawMask.cell));
          ctx.fillRect(q[0],q[1],cellGlobalX*scale+0.5,cellGlobalY*scale+0.5);
        });
        ctx.globalAlpha=1;
      }
      // Name sits clear of the plate, not on top of its linework: push it out
      // from the campus centre and knock the plan back out behind the text.
      var cx0=p.mask.ox+p.mask.w*p.mask.cell/2;
      var cy0=p.mask.oy+p.mask.h*p.mask.cell/2;
      var c0=globalPx(p.gx(cx0),p.gy(cy0));
      var e0=globalPx(p.gx(p.mask.ox),p.gy(p.mask.oy));
      var e1=globalPx(p.gx(p.mask.ox+p.mask.w*p.mask.cell),p.gy(p.mask.oy+p.mask.h*p.mask.cell));
      var halfW=Math.abs(e1[0]-e0[0])/2, halfH=Math.abs(e1[1]-e0[1])/2;
      // Default: push the name away from the campus centre. Buildings that sit
      // near that centre get no useful direction that way, so they name their
      // own side — Perry reads to the right of its plate.
      var txt=bldgName(p.bldg).toUpperCase()+" "+FLOOR_LEVELS[p.lvKey][2].replace("Level ","L");
      drawLabel(txt,c0,halfW,halfH,FL_LABEL_DIR[p.bldg]);
    });
    (levelDef.labels||[]).forEach(function(lb){
      var b=lb.box, c0=globalPx(b[0]+b[2]/2,b[1]+b[3]/2);
      drawLabel(lb.text,c0,b[2]*scale/2,b[3]*scale/2,lb.dir);
    });
    if(FL._moveDrag && FL._moveDrag.overSite===levelN){
      ctx.save(); ctx.strokeStyle="#1266cc"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
      ctx.strokeRect(2,2,cv.width-4,cv.height-4); ctx.restore();
    }
  }
  setTimeout(place,0);
  var im=new Image(); im.onload=function(){ draw(); }; im.src=levelDef.file;

  function evHit(e){
    var r=cv.getBoundingClientRect();
    var g=pxGlobal(e.clientX-r.left,e.clientY-r.top);
    return partAt(g[0],g[1]);
  }
  cv.addEventListener("dragover",function(e){ if(FL._drag){ e.preventDefault(); } });
  cv.addEventListener("drop",function(e){
    if(!FL._drag) return;
    e.preventDefault();
    var h=evHit(e); if(!h){ FL._drag=null; return; }
    var sc2=flScenario();
    if(!Array.isArray(sc2.floorPlace[FL._drag])) sc2.floorPlace[FL._drag]=[];
    sc2.floorPlace[FL._drag].push({lv:h.lvKey, seed:h.cell});
    FL._drag=null; flRebuild();
  });
  cv.addEventListener("mousedown",function(e){
    var h=evHit(e); if(!h) return;
    var key=flSiteHitKey(h);
    if(key){ FL._moveDrag={key:key, startX:e.clientX, startY:e.clientY, moved:false, overSite:levelN};
             cv.style.cursor="grabbing"; e.preventDefault(); }
  });
  cv.addEventListener("mousemove",function(e){
    if(FL._moveDrag){
      if(Math.abs(e.clientX-FL._moveDrag.startX)+Math.abs(e.clientY-FL._moveDrag.startY)>4) FL._moveDrag.moved=true;
      if(FL._moveDrag.overSite!==levelN){ FL._moveDrag.overSite=levelN; FL._redrawAll(); }
      return;
    }
    var h=evHit(e);
    var key=flSiteHitKey(h);
    cv.style.cursor=key?"grab":"default";
    if(key){
      var blk=flBlockById(key.split("#")[0]);
      cv.title=blk? blk.name+" — drag to move (any building / level) · double-click to remove":"";
    } else cv.title="";
  });
  cv.addEventListener("mouseup",function(e){
    if(!FL._moveDrag) return;
    var md=FL._moveDrag; FL._moveDrag=null; cv.style.cursor="default";
    if(!md.moved){ FL._redrawAll(); return; }
    var h=evHit(e); if(!h){ FL._redrawAll(); return; }
    var bid=md.key.split("#")[0], pi=Number(md.key.split("#")[1]);
    var pls=flPlacements(bid);
    if(pls[pi]) pls[pi]={lv:h.lvKey, seed:h.cell};
    flRebuild();
  });
  cv.addEventListener("dblclick",function(e){
    var h=evHit(e); if(!h) return;
    var key=flSiteHitKey(h);
    if(!key) return;
    var bid=key.split("#")[0], pi=Number(key.split("#")[1]);
    var pls=flPlacements(bid);
    pls.splice(pi,1);
    if(!pls.length) delete flScenario().floorPlace[bid];
    flRebuild();
  });
  FL._canvasRedraws.push(draw);
  return card;
}

function flLevelCanvas(lv){
  var sc=flScenario();
  var mask=FLOOR_MASKS[flSrcKey(lv.key)];
  var meta=FLOOR_SRC[flSrcKey(lv.key)];
  var vb=meta.vb;
  var stats=flLevelStats(lv.key);
  var fills=flLevelFills(lv.key);

  var card=el("div",{style:"border:1px solid var(--line);overflow:hidden;background:#fff"});
  var hd=el("div",{style:"display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);flex-wrap:wrap"});
  hd.appendChild(el("b",{style:"font-size:12.5px"},[lv.label]));
  hd.appendChild(el("span",{style:"font-size:10.5px;color:var(--mut);font-feature-settings:'tnum' 1"},[fmt(meta.gsf)+" GSF"]));
  var pct=stats.usable? Math.round(stats.placed/stats.usable*100):0;
  hd.appendChild(el("span",{style:"margin-left:auto;font-size:10.5px;font-weight:900;font-feature-settings:'tnum' 1;color:"+(stats.placed>=stats.usable&&stats.placed?"#c07f00":"var(--mut)")},[
    fmt(stats.placed)+" / "+fmt(stats.usable)+" SF · "+pct+"%"
  ]));
  card.appendChild(hd);

  var contH=252;
  var holder=el("div",{style:"position:relative;width:100%;height:"+contH+"px;overflow:hidden;background:#fff"});
  card.appendChild(holder);

  var innerW=0, scale=0, ox=0, oy=0;
  function layout(){
    innerW=holder.clientWidth||330;
    scale=Math.min(innerW/vb[2], contH/vb[3]);
    ox=(innerW-vb[2]*scale)/2;
    oy=(contH-vb[3]*scale)/2;
  }
  var img=el("img",{src:meta.file, draggable:"false"});
  var cv=el("canvas");
  holder.appendChild(img); holder.appendChild(cv);
  var ctx=cv.getContext("2d");
  function toPx(sx,sy){ return [ox+(sx-vb[0])*scale, oy+(sy-vb[1])*scale]; }
  function toSheet(px,py){ return [(px-ox)/scale+vb[0], (py-oy)/scale+vb[1]]; }
  function cellRect(gx,gy){
    var p=toPx(mask.ox+gx*mask.cell, mask.oy+gy*mask.cell);
    return [p[0],p[1],mask.cell*scale,mask.cell*scale];
  }
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    for(var key in fills.cells){
      var bid=key.split("#")[0];
      var blk=flBlockById(bid); if(!blk) continue;
      var cells=fills.cells[key];
      if(!cells.length) continue;
      ctx.fillStyle=blk.color; ctx.globalAlpha=0.62;
      cells.forEach(function(cxy){
        var r=cellRect(cxy[0],cxy[1]);
        ctx.fillRect(r[0],r[1],r[2]+0.5,r[3]+0.5);
      });
      ctx.globalAlpha=1;
      var mx=0,my=0;
      cells.forEach(function(cxy){ mx+=cxy[0]; my+=cxy[1]; });
      var r0=cellRect(mx/cells.length,my/cells.length);
      var st=flBlockStatus(bid);
      var short=blk.short+(st.left>=20?" ⚠":"");
      ctx.font="900 10px Roboto, Arial"; ctx.textAlign="center";
      var tw=ctx.measureText(short).width+8;
      ctx.fillStyle="rgba(255,255,255,.87)"; ctx.fillRect(r0[0]-tw/2,r0[1]-8,tw,13);
      ctx.strokeStyle="#233044"; ctx.lineWidth=0.7; ctx.strokeRect(r0[0]-tw/2,r0[1]-8,tw,13);
      ctx.fillStyle="#233044"; ctx.fillText(short,r0[0],r0[1]+2);
    }
    var sl=flScenario().sections[FL.building];
    if(sl) flDrawSectionLine(ctx, sl, toPx, false);
    if(FL._sectionPreview && FL._sectionPreview.lv===lv.key) flDrawSectionLine(ctx, FL._sectionPreview, toPx, true);
    if(FL._moveDrag && FL._moveDrag.overLv===lv.key){
      // drop hint while moving program between floors
      ctx.save();
      ctx.strokeStyle="#1266cc"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
      ctx.strokeRect(2,2,cv.width-4,cv.height-4);
      ctx.restore();
    }
  }
  function place(){
    layout();
    var sheetSize=meta.sheetSize||[2592,1728];
    img.style.cssText=[
      "position:absolute","left:"+(ox-vb[0]*scale)+"px","top:"+(oy-vb[1]*scale)+"px",
      "width:"+(sheetSize[0]*scale)+"px","height:"+(sheetSize[1]*scale)+"px","user-select:none","pointer-events:none"
    ].join(";");
    cv.width=innerW; cv.height=contH;
    cv.style.cssText="position:absolute;left:0;top:0";
    draw();
  }
  setTimeout(place,0);
  var im2=new Image(); im2.onload=function(){ draw(); }; im2.src=meta.file;

  function evSheet(e){
    var rect=cv.getBoundingClientRect();
    return toSheet(e.clientX-rect.left, e.clientY-rect.top);
  }
  function evCell(e){
    var s=evSheet(e);
    return [Math.floor((s[0]-mask.ox)/mask.cell), Math.floor((s[1]-mask.oy)/mask.cell)];
  }

  // drop from the panel
  cv.addEventListener("dragover",function(e){ if(FL._drag){ e.preventDefault(); } });
  cv.addEventListener("drop",function(e){
    if(!FL._drag) return;
    e.preventDefault();
    var sc2=flScenario();
    if(!Array.isArray(sc2.floorPlace[FL._drag])) sc2.floorPlace[FL._drag]=[];
    sc2.floorPlace[FL._drag].push({lv:lv.key, seed:evCell(e)});
    FL._drag=null; flRebuild();
  });

  // move placed program: mousedown on a region starts a cross-canvas move;
  // the canvas under the cursor gets the mouseup. A <4px travel counts as a
  // plain click so double-click deletion still works.
  cv.addEventListener("mousedown",function(e){
    if(FL._sectionMode){
      FL._secStart={lv:lv.key, p:evSheet(e)}; e.preventDefault(); return;
    }
    var g=evCell(e), key=fills.taken[g[0]+","+g[1]];
    if(key){
      FL._moveDrag={key:key, fromLv:lv.key, startX:e.clientX, startY:e.clientY, moved:false, overLv:null};
      cv.style.cursor="grabbing"; e.preventDefault();
    }
  });
  cv.addEventListener("mousemove",function(e){
    if(FL._sectionMode){
      cv.style.cursor="crosshair";
      if(FL._secStart && FL._secStart.lv===lv.key){
        var p=flSnap45(FL._secStart.p, evSheet(e));
        FL._sectionPreview={lv:lv.key, x1:FL._secStart.p[0],y1:FL._secStart.p[1],x2:p[0],y2:p[1]};
        draw();
      }
      return;
    }
    if(FL._moveDrag){
      if(Math.abs(e.clientX-FL._moveDrag.startX)+Math.abs(e.clientY-FL._moveDrag.startY)>4) FL._moveDrag.moved=true;
      if(FL._moveDrag.overLv!==lv.key){ FL._moveDrag.overLv=lv.key; FL._redrawAll(); }
      return;
    }
    var g=evCell(e), key=fills.taken[g[0]+","+g[1]];
    cv.style.cursor = key? "grab":"default";
    if(key){
      var bid=key.split("#")[0], blk=flBlockById(bid), st=flBlockStatus(bid);
      cv.title = blk? blk.name+" — "+fmt(st.got)+" SF placed"+(st.left>=20?" · "+fmt(st.left)+" SF unfit":"")+
                 "\ndrag to move (any floor) · double-click to remove" : "";
    } else cv.title="";
  });
  cv.addEventListener("mouseup",function(e){
    if(FL._sectionMode && FL._secStart){
      if(FL._secStart.lv===lv.key){
        var p=flSnap45(FL._secStart.p, evSheet(e));
        var dx=p[0]-FL._secStart.p[0], dy=p[1]-FL._secStart.p[1];
        if(Math.sqrt(dx*dx+dy*dy)>25){
          flScenario().sections[FL.building]={x1:FL._secStart.p[0],y1:FL._secStart.p[1],x2:p[0],y2:p[1]};
          FL._sectionMode=false;
        }
      }
      FL._secStart=null; FL._sectionPreview=null; flRebuild(); return;
    }
    if(FL._moveDrag){
      var md=FL._moveDrag; FL._moveDrag=null;
      if(md.moved){
        // relocate that placement (possibly to a different level's canvas)
        var bid=md.key.split("#")[0], pi=Number(md.key.split("#")[1]);
        var pls=flPlacements(bid);
        if(pls[pi]){ pls[pi]={lv:lv.key, seed:evCell(e)}; }
        flRebuild();
      } else {
        FL._redrawAll();   // plain click — clear drop hints, keep dblclick alive
      }
      cv.style.cursor="default";
    }
  });
  cv.addEventListener("dblclick",function(e){
    if(FL._sectionMode) return;
    var g=evCell(e), key=fills.taken[g[0]+","+g[1]];
    if(key){
      var bid=key.split("#")[0], pi=Number(key.split("#")[1]);
      var pls=flPlacements(bid);
      pls.splice(pi,1);
      if(!pls.length) delete flScenario().floorPlace[bid];
      flRebuild();
    }
  });
  FL._canvasRedraws.push(draw);
  return card;
}
// one document-level safety net: releasing the mouse off any canvas ends drags
if(!window._flGlobalUp){
  window._flGlobalUp=true;
  document.addEventListener("mouseup",function(){
    if(FL._moveDrag){ FL._moveDrag=null; FL._redrawAll(); }
    if(FL._secStart){ FL._secStart=null; FL._sectionPreview=null; FL._redrawAll(); }
  });
}
FL._redrawAll=function(){ FL._canvasRedraws.forEach(function(f){ try{f();}catch(e){} }); };

function flSnap45(a, b){
  var dx=b[0]-a[0], dy=b[1]-a[1];
  var len=Math.sqrt(dx*dx+dy*dy);
  if(len<1) return b;
  var ang=Math.atan2(dy,dx);
  var snap=Math.round(ang/(Math.PI/4))*(Math.PI/4);
  return [a[0]+len*Math.cos(snap), a[1]+len*Math.sin(snap)];
}
function flDrawSectionLine(ctx, sl, toPx, preview){
  var p1=toPx(sl.x1,sl.y1), p2=toPx(sl.x2,sl.y2);
  ctx.save();
  ctx.strokeStyle="#C0392B"; ctx.lineWidth=preview?1.2:1.8;
  if(preview) ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
  var dx=p2[0]-p1[0], dy=p2[1]-p1[1], L=Math.sqrt(dx*dx+dy*dy);
  if(L>10){
    var nx=dy/L, ny=-dx/L;
    ctx.setLineDash([]);
    for(var t=0.2;t<0.9;t+=0.3){
      var x=p1[0]+dx*t, y=p1[1]+dy*t;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+nx*7,y+ny*7); ctx.stroke();
    }
    [[p1[0],p1[1]],[p2[0],p2[1]]].forEach(function(p){
      ctx.fillStyle="#C0392B";
      ctx.beginPath();
      ctx.moveTo(p[0],p[1]-4); ctx.lineTo(p[0]+4,p[1]); ctx.lineTo(p[0],p[1]+4); ctx.lineTo(p[0]-4,p[1]);
      ctx.closePath(); ctx.fill();
    });
  }
  ctx.restore();
}

// ====================================================================
// SECTION VIEW
// ====================================================================
function flLineIntervals(sl, rects){
  var dx=sl.x2-sl.x1, dy=sl.y2-sl.y1;
  var ints=[];
  rects.forEach(function(r){
    var t0=0,t1=1, rejected=false;
    var p=[-dx,dx,-dy,dy], q=[sl.x1-r[0], r[0]+r[2]-sl.x1, sl.y1-r[1], r[1]+r[3]-sl.y1];
    for(var i=0;i<4;i++){
      if(p[i]===0){ if(q[i]<0){rejected=true;break;} }
      else{
        var rr=q[i]/p[i];
        if(p[i]<0){ if(rr>t1){rejected=true;break;} if(rr>t0)t0=rr; }
        else{ if(rr<t0){rejected=true;break;} if(rr<t1)t1=rr; }
      }
    }
    if(!rejected&&t0<t1) ints.push([t0,t1]);
  });
  if(!ints.length) return [];
  ints.sort(function(a,b){return a[0]-b[0];});
  var merged=[ints[0].slice()], eps=0.004;
  for(var i=1;i<ints.length;i++){
    var last=merged[merged.length-1];
    if(ints[i][0]<=last[1]+eps) last[1]=Math.max(last[1],ints[i][1]);
    else merged.push(ints[i].slice());
  }
  return merged;
}
function flBuildSection(c){
  var sc=flScenario();
  var sl=sc.sections[FL.building];
  if(!sl) return;
  var dx=sl.x2-sl.x1, dy=sl.y2-sl.y1;
  var lenU=Math.sqrt(dx*dx+dy*dy); if(lenU<2) return;
  var levels=flLevelsOf(FL.building);
  if(!levels.length) return;
  var lenFt=lenU*flFtPerUnit(levels[0].key);   // all levels of a building share a sheet scale
  var f2f=Number(sc.f2f)||14;

  var panel=el("div",{class:"box",style:"margin-top:14px;padding:12px 14px"});
  var hd=el("div",{style:"display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"});
  hd.appendChild(el("h3",{style:"margin:0"},["Section — "+bldgName(FL.building)]));
  hd.appendChild(el("span",{class:"hint",style:"margin:0;flex:1"},[
    "Cut length "+Math.round(lenFt)+"′ · looking toward the tick marks · grey band = floor plate, colour = placed program"
  ]));
  hd.appendChild(el("span",{style:"font-size:11px;font-weight:700"},["Floor-to-floor"]));
  var fInp=el("input",{type:"text",value:String(f2f),style:"width:36px;font-size:12px;font-weight:900;border:1px solid var(--line2);padding:1px 4px;text-align:center;font-family:inherit"});
  fInp.addEventListener("change",function(){
    var v=parseFloat(fInp.value.replace(/[^0-9.]/g,""));
    sc.f2f=(isNaN(v)||v<8)?14:v; flRebuild();
  });
  hd.appendChild(fInp);
  hd.appendChild(el("span",{style:"font-size:11px;color:var(--mut)"},["ft"]));
  panel.appendChild(hd);

  var pxFtX=Math.min(4.5, Math.max(2.2, (rcWidth()-360)/lenFt));
  var pxFtY=3.2;
  var maxHt=levels.length*f2f;
  var W=lenFt*pxFtX+152, H=maxHt*pxFtY+46;
  var ns="http://www.w3.org/2000/svg";
  var svg=document.createElementNS(ns,"svg");
  svg.setAttribute("width",W); svg.setAttribute("height",H);
  svg.style.cssText="background:#fafbfc;border:1px solid var(--line);display:block";
  function fx(ft){ return 58+ft*pxFtX; }
  function fy(ft){ return H-24-ft*pxFtY; }
  function add(tag,attrs,text){
    var e=document.createElementNS(ns,tag);
    for(var k in attrs) e.setAttribute(k,attrs[k]);
    if(text!==undefined) e.textContent=text;
    svg.appendChild(e); return e;
  }
  add("line",{x1:fx(0),y1:fy(0),x2:fx(lenFt),y2:fy(0),stroke:"#233044","stroke-width":2});
  for(var hft=0;hft<=maxHt;hft+=10){
    add("line",{x1:fx(0)-5,y1:fy(hft),x2:fx(0),y2:fy(hft),stroke:"#999","stroke-width":1});
    add("text",{x:fx(0)-8,y:fy(hft)+3,"font-size":9,fill:"#999","text-anchor":"end","font-family":"Roboto, Arial"},String(hft));
  }
  var ordered=levels.slice().sort(function(a,b){return a.n-b.n;});
  ordered.forEach(function(lv,i){
    var datum=i*f2f;
    var mask=FLOOR_MASKS[flSrcKey(lv.key)];
    var cell=mask.cell;
    var envRects=[];
    for(var gy=0;gy<mask.h;gy++){
      var row=mask.rows[gy], x0=null;
      for(var gx=0;gx<=mask.w;gx++){
        var ch=gx<mask.w? row.charAt(gx):"2";
        if(ch!=="2" && x0===null) x0=gx;
        else if(ch==="2" && x0!==null){
          envRects.push([mask.ox+x0*cell, mask.oy+gy*cell, (gx-x0)*cell, cell]);
          x0=null;
        }
      }
    }
    add("line",{x1:fx(0),y1:fy(datum),x2:fx(lenFt),y2:fy(datum),stroke:"#bbb","stroke-width":1,"stroke-dasharray":"3,3"});
    add("text",{x:fx(lenFt)+5,y:fy(datum)+3,"font-size":9,fill:"#8494ab","font-weight":700,"font-family":"Roboto, Arial"},
        lv.label.replace("Level ","L")+" @ "+Math.round(datum)+"′");
    flLineIntervals(sl, envRects).forEach(function(iv){
      var a=iv[0]*lenFt, b=iv[1]*lenFt;
      add("rect",{x:fx(a),y:fy(datum+FL_BLOCK_HT),width:Math.max(1,(b-a)*pxFtX),height:FL_BLOCK_HT*pxFtY,
        fill:"#eceff3",stroke:"#c6ccd6","stroke-width":0.8});
    });
    var fills=flLevelFills(lv.key);
    for(var key in fills.cells){
      var bid=key.split("#")[0];
      var blk=flBlockById(bid); if(!blk||!fills.cells[key].length) continue;
      var rects=fills.cells[key].map(function(cxy){
        return [mask.ox+cxy[0]*cell, mask.oy+cxy[1]*cell, cell, cell];
      });
      flLineIntervals(sl, rects).forEach(function(iv){
        var a=iv[0]*lenFt, b=iv[1]*lenFt;
        var r=add("rect",{x:fx(a),y:fy(datum+FL_BLOCK_HT),width:Math.max(1,(b-a)*pxFtX),height:FL_BLOCK_HT*pxFtY,
          fill:blk.color,stroke:"rgba(0,0,0,.35)","stroke-width":1});
        var t=document.createElementNS(ns,"title");
        t.textContent=blk.name+" — "+fmt(blk.sf)+" SF";
        r.appendChild(t);
        if((b-a)*pxFtX>44){
          add("text",{x:fx((a+b)/2),y:fy(datum+FL_BLOCK_HT/2)+3,"font-size":8.5,fill:"#233044","text-anchor":"middle","font-family":"Roboto, Arial"},blk.short);
        }
      });
    }
  });
  add("text",{x:fx(lenFt/2),y:H-6,"font-size":10,fill:"#8494ab","text-anchor":"middle","font-weight":700,"font-family":"Roboto, Arial"},
      Math.round(lenFt)+"′ section length");
  var wrap=el("div",{style:"overflow-x:auto"});
  wrap.appendChild(svg);
  panel.appendChild(wrap);
  c.appendChild(panel);
}
