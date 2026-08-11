// =====================================================================
// BED RECAP & PHASING TAB
//
// Three linked views over one scenario:
//   · Stacking      — inpatient units placed on building levels (drag to relocate)
//   · Phasing       — draggable construction phases on a quarter-year timeline
//   · Bed gain/loss — staffed beds quarter by quarter against the licence and
//                     the minimum-operating floor, after the Main Patient Room
//                     Renovation bed-count/phasing sheet, greatly simplified
//
// The timeline replaces the lease timeline of the Burlington dashboard: same
// drag interaction, but the bars are construction phases and the current-time
// flag drives the stacking view, the campus map and the bed chart.
// =====================================================================

var RC_T_START = 2026.75;      // NTP + study
var RC_Q       = 0.25;

// ── Scenario model ───────────────────────────────────────────────────
function rcDefaultPhases(){
  return [
    {id:"P0", name:"Enabling moves, decanting & CUP upgrades", units:[], bldg:"faceng",
     start:2027.00, dur:1.00, swing:0, obsAfter:0, renoGSF:10000, newGSF:0, kind:"infra", enabled:true,
     note:"Relocates displaced functions and delivers the electrical, steam and med-gas capacity the later phases depend on."},
    {id:"P1", name:"East L4A — private-room conversion", units:["E4A"], bldg:"east",
     start:2028.00, dur:0.75, swing:6, obsAfter:0, renoGSF:12000, newGSF:0, kind:"reno", enabled:true,
     note:"6 semi-private rooms to private; unit off-line, swing beds absorb part of the loss."},
    {id:"P2", name:"East L4B — private-room conversion", units:["E4B"], bldg:"east",
     start:2028.75, dur:0.75, swing:6, obsAfter:0, renoGSF:12000, newGSF:0, kind:"reno", enabled:true,
     note:"Repeat of P1 on the paired unit — sequential, never concurrent."},
    {id:"P3", name:"West L4 — private-room conversion", units:["W4"], bldg:"west",
     start:2029.50, dur:0.75, swing:12, obsAfter:0, renoGSF:14000, newGSF:0, kind:"reno", enabled:true,
     note:"The largest single conversion: 7 semi-private rooms, 20 beds off-line. Half-floor sequencing plus temporary re-opening of decanted beds carries the swing."},
    {id:"P4", name:"Observation Unit fit-out — East L1", units:[], bldg:"east",
     start:2030.25, dur:0.75, swing:0, obsAfter:14, renoGSF:13000, newGSF:0, kind:"fitout", enabled:true,
     note:"Dedicated short-stay unit in repurposed space adjacent to the ED. Unlicensed — sits outside the 100-bed cap. Displaces ~13,000 GSF of existing function, which the relocation strategy has to rehouse."},
    {id:"P5", name:"East L2 — ICU modernization", units:["E2I"], bldg:"east",
     start:2031.00, dur:0.75, swing:8, obsAfter:0, renoGSF:15000, newGSF:0, kind:"reno", enabled:true,
     note:"Already all-private; scope is acuity-adaptable reconfiguration and adjacency to D&T."},
    {id:"P6", name:"East L2 — PCU modernization", units:["E2P"], bldg:"east",
     start:2031.75, dur:0.50, swing:6, obsAfter:0, renoGSF:11000, newGSF:0, kind:"reno", enabled:true,
     note:"Follows the ICU so critical-care capacity is never halved."},
    {id:"P7", name:"East L3 — LDRP refresh", units:["E3L"], bldg:"east",
     start:2032.25, dur:0.75, swing:12, obsAfter:0, renoGSF:14000, newGSF:0, kind:"reno", enabled:true,
     note:"Finishes-and-systems refresh, bed count unchanged. Obstetrics cannot close, so this phase is swing-bed dependent."},
    {id:"P8", name:"East L3 — Peds refresh", units:["E3P"], bldg:"east",
     start:2033.00, dur:0.50, swing:2, obsAfter:0, renoGSF:5000, newGSF:0, kind:"reno", enabled:true,
     note:"Smallest unit, sequenced last."}
  ];
}
function rcNewScenario(name){
  return {
    name: name||"Scenario A — conversion within the existing footprint",
    phases: rcDefaultPhases(),
    placement: {},                  // unitId -> {bldg, level}
    currentTime: 2029.75,
    timelineEnd: 2034,
    view: "proposed"                // "existing" | "proposed"
  };
}
function rcNormalizeScenario(sc){
  sc = sc||{};
  if(!sc.name) sc.name="Scenario";
  if(!Array.isArray(sc.phases)||!sc.phases.length) sc.phases=rcDefaultPhases();
  sc.phases.forEach(function(p){
    if(!Array.isArray(p.units)) p.units=[];
    ["start","dur","swing","obsAfter","renoGSF","newGSF"].forEach(function(k){ p[k]=Number(p[k])||0; });
    if(p.enabled===undefined) p.enabled=true;
    if(!p.kind) p.kind="reno";
  });
  if(!sc.placement) sc.placement={};
  if(!sc.floorPlace) sc.floorPlace={};
  for(var fk in sc.floorPlace){    // v0.2 single-placement format → array
    if(sc.floorPlace[fk] && !Array.isArray(sc.floorPlace[fk])) sc.floorPlace[fk]=[sc.floorPlace[fk]];
  }
  if(!Array.isArray(sc.customBlocks)) sc.customBlocks=[];
  if(!Array.isArray(sc.unitInstances)) sc.unitInstances=[];
  if(!sc.blockFactor) sc.blockFactor={};
  if(!sc.sections) sc.sections={};
  if(!sc.f2f) sc.f2f=14;
  if(sc.currentTime===undefined) sc.currentTime=2029.0;
  if(sc.timelineEnd===undefined) sc.timelineEnd=2033;
  if(!sc.view) sc.view="proposed";
  return sc;
}
var RC = { active:0, scenarios:[ rcNewScenario() ], _drag:null };
function rcScenario(){ return RC.scenarios[RC.active]; }

// ── Phase arithmetic ─────────────────────────────────────────────────
function rcPhaseEnd(p){ return p.start+p.dur; }
function rcPhaseUnitBeds(p){
  // licensed beds in the units this phase takes off-line, as they stand today
  return p.units.reduce(function(a,id){ var u=exUnit(id); return a+(u?unitExistingBeds(u):0); },0);
}
function rcPhaseAfterBeds(p){
  // licensed beds those units return with, once converted
  return p.units.reduce(function(a,id){ var u=exUnit(id); return a+(u?unitProposedBeds(u):0); },0);
}
function rcPhaseState(p,t){
  if(!p.enabled) return "off";
  if(t < p.start) return "future";
  if(t < rcPhaseEnd(p)) return "active";
  return "done";
}
function rcBedsAt(t){
  var sc = rcScenario();
  var licensed = existingTotals().beds;      // 100 today
  var obs = 0, offline = 0, swing = 0, activeCount = 0;
  sc.phases.forEach(function(p){
    var st = rcPhaseState(p,t);
    if(st==="active"){
      offline += rcPhaseUnitBeds(p);
      swing   += p.swing;
      activeCount++;
    } else if(st==="done"){
      licensed += rcPhaseAfterBeds(p)-rcPhaseUnitBeds(p);
      obs      += p.obsAfter;
    }
  });
  var operating = licensed-offline+swing;
  return {licensed:licensed, offline:offline, swing:swing, operating:operating, obs:obs, active:activeCount};
}
function rcTimelineSpan(){ var sc=rcScenario(); return {a:RC_T_START, b:sc.timelineEnd}; }
function rcMidpointYears(){
  var sc=rcScenario(), num=0, den=0;
  sc.phases.forEach(function(p){
    if(!p.enabled) return;
    var w=(Number(p.renoGSF)||0)+(Number(p.newGSF)||0);
    if(!w) w=1;
    num += w*(p.start+p.dur/2); den += w;
  });
  if(!den) return 3;
  return Math.max(0, num/den - RC_T_START);
}
function rcFmtYQ(v){
  var y=Math.floor(v+1e-9), q=Math.round((v-y)*4)+1;
  if(q>4){ y++; q-=4; }
  return y+" Q"+q;
}
function rcWorstQuarter(){
  var sp=rcTimelineSpan(), worst=null;
  for(var t=sp.a; t<=sp.b+1e-9; t+=RC_Q){
    var b=rcBedsAt(t+1e-6);
    if(!worst||b.operating<worst.operating) worst={t:t, operating:b.operating, obs:b.obs};
  }
  return worst;
}

// ── Unit blocks (stacking) ───────────────────────────────────────────
function rcUnitBlocks(){
  var sc=rcScenario(), d=demandMetrics(), out=[];
  S.existing.forEach(function(u){
    var beds = sc.view==="existing"? unitExistingBeds(u) : unitProposedBeds(u);
    out.push({
      id:u.id, name:bldgName(u.bldg).replace(" Wing","")+" L"+u.level+" · "+utype(u.type).name,
      short:utype(u.type).name, type:u.type, beds:beds, rooms:unitRooms(u),
      // Area follows the room count, so it is identical in both views.
      gsf:bgsfForRooms(u.type,unitRooms(u)),
      home:{bldg:u.bldg, level:u.level},
      note: sc.view==="existing"
        ? (u.single+" single · "+u.dbl+" in "+semiRooms(u)+" semi-private")
        : (unitConverted(u)? unitConverted(u)+" rooms converted · −"+unitConverted(u)+" beds" : "no conversion")
    });
  });
  if(sc.view==="proposed" && d.obsBeds>0){
    out.push({
      id:"OBS", name:"Observation Unit", short:"Observation", type:"obs", beds:d.obsBeds, rooms:d.obsBeds,
      gsf:bgsfForBeds("obs",d.obsBeds), home:{bldg:"east", level:1},
      note:"unlicensed · outside the 100-bed cap"
    });
  }
  return out;
}
function rcPlacement(blockId, home){
  var p = rcScenario().placement[blockId];
  return p ? {bldg:p.bldg, level:p.level} : home;
}
function rcStackBuildings(){
  // buildings that hold at least one block, in campus order
  var blocks=rcUnitBlocks(), ids={};
  blocks.forEach(function(b){ ids[rcPlacement(b.id,b.home).bldg]=true; });
  return S.buildings.filter(function(b){ return ids[b.id]; });
}
function rcFloorGSF(b){ return (Number(b.gsf)||0)/Math.max(1,Number(b.levels)||1); }
// Per-level GSF where the building has measured floor plates.
function rcLevelGSF(b, lv){
  if(b.floorGSF && b.floorGSF[lv]) return Number(b.floorGSF[lv]);
  return rcFloorGSF(b);
}
function rcLevelBlocks(bldgId, level){
  return rcUnitBlocks().filter(function(bk){
    var p=rcPlacement(bk.id,bk.home);
    return p.bldg===bldgId && p.level===level;
  });
}
function rcTouch(){ /* placement changed */ }
// Timeline and chart are laid out in absolute pixels, so they need a width even
// before their container is in the document — take it from the tab view instead.
function rcWidth(){
  var v=document.getElementById("view");
  return (v&&v.clientWidth)? v.clientWidth : 1180;
}
var RC_CHART_LABEL_W=244;
function rcChartWidth(){ return Math.max(620,rcWidth()-38); }

// ====================================================================
// TAB
// ====================================================================
function tabRecap(){
  var sc = rcScenario();
  var v = el("div");

  // ── scenario bar ───────────────────────────────────────────────
  var bar = el("div",{style:"display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px"});
  var sel = el("select",{style:"font-family:inherit;font-weight:900;font-size:14px;border:1px solid var(--ink);background:#fff;padding:6px 10px;color:var(--ink);max-width:420px"});
  RC.scenarios.forEach(function(s,i){
    var o=el("option",{value:String(i)},[s.name]); if(i===RC.active)o.selected=true; sel.appendChild(o);
  });
  sel.addEventListener("change",function(e){ RC.active=Number(e.target.value); render(); });
  bar.appendChild(sel);
  bar.appendChild(el("button",{class:"seg sm",onclick:function(){
    var n=prompt("Rename scenario", sc.name); if(n){ sc.name=n; render(); }
  }},["Rename"]));
  bar.appendChild(el("button",{class:"seg sm",onclick:function(){
    var copy=JSON.parse(JSON.stringify(sc)); copy.name=sc.name+" (copy)";
    RC.scenarios.push(rcNormalizeScenario(copy)); RC.active=RC.scenarios.length-1; render();
  }},["Duplicate"]));
  bar.appendChild(el("button",{class:"seg sm",onclick:function(){
    RC.scenarios.push(rcNewScenario("Scenario "+String.fromCharCode(65+RC.scenarios.length)));
    RC.active=RC.scenarios.length-1; render();
  }},["+ New"]));
  if(RC.scenarios.length>1){
    bar.appendChild(el("button",{class:"seg sm",onclick:function(){
      if(confirm("Delete “"+sc.name+"”?")){ RC.scenarios.splice(RC.active,1); RC.active=0; render(); }
    }},["Delete"]));
  }
  var vg = el("div",{style:"margin-left:auto;display:flex;gap:0"});
  [["existing","Existing"],["proposed","Proposed"]].forEach(function(p){
    vg.appendChild(el("button",{class:"seg sm"+(sc.view===p[0]?" on":""),onclick:function(){ sc.view=p[0]; render(); }},[p[1]]));
  });
  bar.appendChild(vg);
  v.appendChild(bar);

  // ── headline cards ─────────────────────────────────────────────
  var now = rcBedsAt(sc.currentTime+1e-6);
  var worst = rcWorstQuarter();
  var end = rcBedsAt(sc.timelineEnd+1e-6);
  var minBeds = Number(S.constraints.min_operating_beds.v);
  var c = costMetrics();
  var cards = el("div",{class:"cards",style:"margin-bottom:18px"});
  cards.appendChild(kcard("At "+rcFmtYQ(sc.currentTime), fmt(now.operating)+" staffed beds",
    now.operating<minBeds?"bad":null,
    now.active? now.active+" phase"+(now.active>1?"s":"")+" under construction" : "no construction active"));
  cards.appendChild(kcard("Off-line now", fmt(now.offline)+" beds", null, now.swing? "+"+fmt(now.swing)+" swing beds in use":"no swing beds in use"));
  cards.appendChild(kcard("Worst quarter", fmt(worst.operating)+" beds",
    worst.operating<minBeds?"bad":"hi", rcFmtYQ(worst.t)+" · floor is "+fmt(minBeds)));
  cards.appendChild(kcard("At completion", fmt(end.licensed)+" licensed",
    end.licensed>Number(S.constraints.licensed_beds.v)?"bad":"hi",
    "+ "+fmt(end.obs)+" observation beds"));
  cards.appendChild(kcard("Renovation", fmt(c.renoGSF)+" GSF", null, c.newGSF? fmt(c.newGSF)+" GSF new":"no addition"));
  cards.appendChild(kcard("Project cost", money(c.total), c.margin>=0?"hi":"bad",
    (c.margin>=0?money(c.margin)+" under":money(-c.margin)+" over")+" cap"));
  v.appendChild(cards);

  // ── three-panel row ────────────────────────────────────────────
  var row = el("div",{style:"display:grid;grid-template-columns:210px 1fr 330px;gap:16px;align-items:start;margin-bottom:22px"});
  var pp = el("div",{id:"rc-prog-panel"}); rcBuildBlocksPanel(pp); row.appendChild(pp);
  var st = el("div",{id:"rc-stack-panel"}); rcBuildStacking(st); row.appendChild(st);
  var sp = el("div",{id:"rc-site-panel"});  rcBuildSitePanel(sp);  row.appendChild(sp);
  v.appendChild(row);

  // ── phasing timeline + bed chart ───────────────────────────────
  var tl = el("div",{id:"rc-timeline"}); rcBuildTimeline(tl); v.appendChild(tl);
  var ch = el("div",{id:"rc-chart"});    rcBuildBedChart(ch);   v.appendChild(ch);
  var pt = el("div",{id:"rc-phase-table"}); rcBuildPhaseTable(pt); v.appendChild(pt);

  return v;
}

function rcRebuild(){
  ["rc-prog-panel","rc-stack-panel","rc-site-panel","rc-timeline","rc-chart","rc-phase-table"].forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    if(id==="rc-prog-panel") rcBuildBlocksPanel(e);
    else if(id==="rc-stack-panel") rcBuildStacking(e);
    else if(id==="rc-site-panel"){ SITE_LAYOUTS=[]; rcBuildSitePanel(e); SITE_LAYOUTS.forEach(function(f){ try{f();}catch(err){} }); }
    else if(id==="rc-timeline") rcBuildTimeline(e);
    else if(id==="rc-chart") rcBuildBedChart(e);
    else rcBuildPhaseTable(e);
  });
  renderHeader();
}

// ====================================================================
// BLOCKS PANEL — legend + unplaced blocks
// ====================================================================
function rcBuildBlocksPanel(c){
  c.innerHTML="";
  var sc=rcScenario();
  var box=el("div",{class:"box",style:"padding:12px 14px"});
  box.appendChild(el("h3",{style:"margin-bottom:8px"},["Unit types"]));
  UNIT_TYPES.forEach(function(ut){
    var beds = rcUnitBlocks().filter(function(b){return b.type===ut.id;}).reduce(function(a,b){return a+b.beds;},0);
    if(!beds && ut.id!=="obs") return;
    box.appendChild(el("div",{style:"display:flex;align-items:center;font-size:12px;margin:3px 0"},[
      el("span",{class:"dot",style:"background:"+utypeHex(ut.id)}),
      el("span",{style:"flex:1"},[ut.name]),
      el("b",{style:"font-feature-settings:'tnum' 1"},[String(beds)])
    ]));
  });
  c.appendChild(box);

  var t = existingTotals(), d = demandMetrics();
  var box2=el("div",{class:"box",style:"padding:12px 14px;margin-top:12px"});
  box2.appendChild(el("h3",{style:"margin-bottom:8px"},["Scenario totals"]));
  [["Licensed beds", fmt(sc.view==="existing"?t.beds:t.proposed)],
   ["Private rooms", Math.round((sc.view==="existing"?t.existingPrivatePct:t.privatePct)*100)+"%"],
   ["Observation beds", sc.view==="existing"?"0":fmt(d.obsBeds)],
   ["Inpatient BGSF", fmt(rcUnitBlocks().reduce(function(a,b){return a+b.gsf;},0))]
  ].forEach(function(p){
    box2.appendChild(el("div",{style:"display:flex;font-size:12px;margin:3px 0;gap:8px"},[
      el("span",{style:"flex:1;color:var(--mut)"},[p[0]]),
      el("b",{style:"font-feature-settings:'tnum' 1"},[p[1]])
    ]));
  });
  c.appendChild(box2);

  var box3=el("div",{class:"box",style:"padding:12px 14px;margin-top:12px"});
  box3.appendChild(el("h3",{style:"margin-bottom:6px"},["Relocation"]));
  box3.appendChild(el("p",{class:"hint",style:"margin:0"},[
    "Drag a unit onto another level to test a relocation. Levels turn amber when the placed program exceeds the floor plate — the signal that all-private units need more area than the floor holds."
  ]));
  var n = Object.keys(sc.placement).length;
  if(n){
    box3.appendChild(el("button",{class:"seg sm",style:"margin-top:10px",onclick:function(){
      sc.placement={}; rcRebuild();
    }},["Reset "+n+" move"+(n>1?"s":"")]));
  }
  c.appendChild(box3);
}

// ====================================================================
// STACKING DIAGRAM
// ====================================================================
function rcBuildStacking(c){
  c.innerHTML="";
  var sc=rcScenario();
  c.appendChild(el("h3",{style:"margin-bottom:2px"},["Stacking — inpatient program by building level"]));
  c.appendChild(el("p",{class:"hint",style:"margin:0 0 10px"},[
    "Block width is BGSF against the floor plate — measured per level where floor plans exist (West, NW, Perry, OCC, MOB), otherwise building GSF ÷ levels. The white remainder is floor area available for other program or for relocation; the Floor Plans tab tests the same placements against the drawn plates."
  ]));

  var wrap=el("div",{style:"display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px"});
  rcStackBuildings().forEach(function(b){
    var col=el("div",{class:"box",style:"padding:10px 12px"});
    var hd=el("div",{style:"display:flex;align-items:baseline;gap:8px;margin-bottom:8px"});
    hd.appendChild(el("b",{style:"font-size:14px"},[b.name]));
    hd.appendChild(el("span",{style:"font-size:11px;color:var(--mut);margin-left:auto"},[
      b.floorGSF? "measured plates" : fmt(rcFloorGSF(b))+" GSF / level"
    ]));
    col.appendChild(hd);

    for(var lv=b.levels; lv>=1; lv--){
      col.appendChild(rcLevelRow(b, lv));
    }
    wrap.appendChild(col);
  });
  c.appendChild(wrap);
}
function rcLevelRow(b, lv){
  var sc=rcScenario();
  var blocks=rcLevelBlocks(b.id,lv);
  var cap=rcLevelGSF(b, lv);
  var used=blocks.reduce(function(a,x){return a+x.gsf;},0);
  var pct=cap? used/cap : 0;
  var over=pct>1.001;

  var row=el("div",{style:"display:flex;align-items:stretch;gap:8px;margin-bottom:5px"});
  row.appendChild(el("div",{style:"width:34px;flex:none;font-size:11px;font-weight:900;color:var(--mut);display:flex;align-items:center"},["L"+lv]));

  var track=el("div",{style:[
    "flex:1","position:relative","height:38px","background:#f7fafc",
    "border:1px solid "+(over?"#e0a500":"var(--line2)"),"overflow:hidden"
  ].join(";")});
  track.addEventListener("dragover",function(e){ if(RC._drag){ e.preventDefault(); track.style.background="#eef6f5"; } });
  track.addEventListener("dragleave",function(){ track.style.background="#f7fafc"; });
  track.addEventListener("drop",function(e){
    if(!RC._drag) return;
    e.preventDefault();
    sc.placement[RC._drag]={bldg:b.id, level:lv};
    RC._drag=null; rcRebuild();
  });

  var x=0;
  blocks.forEach(function(bk){
    var w=cap? Math.min(100, bk.gsf/cap*100) : 0;
    var seg=el("div",{
      draggable:"true",
      title:bk.name+" — "+bk.beds+" beds · "+fmt(bk.gsf)+" BGSF\n"+bk.note+"\n(drag to another level to relocate)",
      style:[
        "position:absolute","left:"+x+"%","top:0","bottom:0","width:"+w+"%",
        "background:"+utypeHex(bk.type),"border-right:1px solid rgba(35,48,68,.25)",
        "display:flex","flex-direction:column","justify-content:center","padding:0 6px",
        "cursor:grab","overflow:hidden","white-space:nowrap"
      ].join(";")
    });
    seg.appendChild(el("div",{style:"font-size:11px;font-weight:900;line-height:1.15;text-overflow:ellipsis;overflow:hidden"},[bk.short]));
    // Narrow blocks clip the area figure mid-number, which reads as a typo — drop it instead.
    seg.appendChild(el("div",{style:"font-size:10px;font-weight:400;color:rgba(35,48,68,.75);line-height:1.15"},
      [ w>=65 ? bk.beds+" beds · "+fmt(bk.gsf)+" SF" : bk.beds+" beds" ]));
    seg.addEventListener("dragstart",function(e){ RC._drag=bk.id; e.dataTransfer.effectAllowed="move"; seg.style.opacity=".45"; });
    seg.addEventListener("dragend",function(){ seg.style.opacity="1"; });
    track.appendChild(seg);
    x+=w;
  });
  if(x<100){
    var remain = Math.max(0,cap-used);
    track.appendChild(el("div",{
      title: blocks.length
        ? fmt(remain)+" GSF of floor plate not used by inpatient program"
        : "No inpatient program on this level — "+fmt(cap)+" GSF of other hospital function, a candidate for relocation",
      style:"position:absolute;left:"+x+"%;top:0;bottom:0;right:0;display:flex;align-items:center;padding-left:6px;font-size:10px;color:var(--faint)"
    },[ blocks.length
          ? (remain>cap*0.12 ? fmt(remain)+" SF available" : "")
          : "other hospital program · "+fmt(cap)+" SF" ]));
  }
  row.appendChild(track);

  row.appendChild(el("div",{
    style:"width:44px;flex:none;font-size:11px;font-weight:900;text-align:right;display:flex;align-items:center;justify-content:flex-end;color:"+(over?"#c07f00":"var(--mut)"),
    title: over? "Placed program exceeds the floor plate by "+fmt(used-cap)+" GSF" : ""
  },[ (cap&&blocks.length)? Math.round(pct*100)+"%" : "—" ]));
  return row;
}

// ====================================================================
// SITE PANEL — campus tinted by phase state at the current time
// ====================================================================
// State fills are fully opaque and use a same-colour expansion stroke so the
// pink vector base cannot show through around the hand-traced polygon edges.
var RC_STATE_COLORS = {
  future:{fill:"#C9CCD2", op:1, label:"not started"},
  active:{fill:"#FEB522", op:1, label:"under construction"},
  done:  {fill:"#3CA09E", op:1, label:"complete"},
  none:  {fill:"#ffffff", op:1, label:"no work in scope"}
};
function rcBuildingState(id, t){
  var sc=rcScenario(), best="none";
  sc.phases.forEach(function(p){
    if(p.bldg!==id) return;
    var st=rcPhaseState(p,t);
    if(st==="off") return;
    if(st==="active") best="active";
    else if(st==="future" && best!=="active") best="future";
    else if(st==="done" && best==="none") best="done";
  });
  return best;
}
function rcBuildSitePanel(c){
  c.innerHTML="";
  var sc=rcScenario();
  c.appendChild(el("h3",{style:"margin-bottom:2px"},["Campus at "+rcFmtYQ(sc.currentTime)]));
  c.appendChild(el("p",{class:"hint",style:"margin:0 0 8px"},[
    "Move the flag on the timeline below to walk the campus through the phasing sequence."
  ]));
  var sw=el("div",{class:"sitewrap"});
  sw.appendChild(buildSiteGraphic("plan",{
    labelScale:0.85,     // narrow panel — label sizes are screen px now
    tint:function(id){
      var s=rcBuildingState(id, sc.currentTime+1e-6);
      var cfg=RC_STATE_COLORS[s];
      return {fill:cfg.fill, op:cfg.op, cover:true};
    },
    // In a 330px panel only the buildings carrying beds or work earn a label.
    label:function(id){
      var beds = rcUnitBlocks().filter(function(b){ return rcPlacement(b.id,b.home).bldg===id; })
                               .reduce(function(a,b){ return a+b.beds; },0);
      if(beds) return true;
      return rcBuildingState(id, sc.currentTime+1e-6)!=="none" ? true : false;
    },
    sub:function(id){
      var beds = rcUnitBlocks().filter(function(b){ return rcPlacement(b.id,b.home).bldg===id; })
                               .reduce(function(a,b){ return a+b.beds; },0);
      return beds? beds+" beds" : null;
    },
    tooltip:function(id){ return RC_STATE_COLORS[rcBuildingState(id, sc.currentTime+1e-6)].label; }
  }).el);
  c.appendChild(sw);
  var lg=el("div",{class:"legend",style:"margin-top:8px;font-size:11px;gap:12px"});
  [["done","Complete"],["active","Under construction"],["future","Not yet started"],["none","No work in scope"]].forEach(function(p){
    lg.appendChild(el("span",null,[
      el("span",{class:"sw",style:"background:"+RC_STATE_COLORS[p[0]].fill+";opacity:"+(RC_STATE_COLORS[p[0]].op+0.25)}),
      p[1]
    ]));
  });
  c.appendChild(lg);
}

// ====================================================================
// PHASING TIMELINE — draggable phase bars + current-time flag
// ====================================================================
var RC_KIND_COLOR = { reno:"#9EDDD1", infra:"#C2C3C8", fitout:"#FFE885", addition:"#FFAF7D" };
function rcBuildTimeline(c){
  c.innerHTML="";
  var sc=rcScenario();
  var wrap=el("div",{class:"box",style:"padding:16px 18px;margin-bottom:18px"});
  var hdr=el("div",{style:"display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"});
  hdr.appendChild(el("h3",{style:"margin:0;font-size:18px"},["Construction Phasing"]));
  hdr.appendChild(el("span",{class:"hint",style:"margin:0"},["Drag a bar's middle to move it, its edges to change duration — quarter-year steps."]));
  var endWrap=el("div",{style:"margin-left:auto;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"});
  endWrap.appendChild(el("span",null,["Timeline to"]));
  var endInp=el("input",{type:"text",value:String(sc.timelineEnd),
    style:"width:56px;font-size:13px;font-weight:800;border:1px solid var(--line2);padding:2px 6px;text-align:center;font-family:inherit"});
  endInp.addEventListener("change",function(){
    var y=parseInt(endInp.value.replace(/[^0-9]/g,""),10);
    if(isNaN(y)){ endInp.value=String(sc.timelineEnd); return; }
    if(y<100) y+=2000;
    sc.timelineEnd=Math.max(Math.ceil(RC_T_START)+1, Math.min(2060,y));
    sc.phases.forEach(function(p){
      if(p.start+p.dur>sc.timelineEnd) p.start=Math.max(RC_T_START, sc.timelineEnd-p.dur);
    });
    sc.currentTime=Math.min(sc.currentTime, sc.timelineEnd);
    rcRebuild();
  });
  endWrap.appendChild(endInp);
  hdr.appendChild(endWrap);
  wrap.appendChild(hdr);

  var LBL_W=RC_CHART_LABEL_W;
  var TL_W=rcChartWidth();
  var TW=TL_W-LBL_W;
  var ROWH=52, TOP=40;
  var sp=rcTimelineSpan(), span=sp.b-sp.a;
  var H=TOP+ROWH*sc.phases.length+32;
  function xOf(v){ return LBL_W+(v-sp.a)/span*TW; }

  var tl=el("div",{style:"position:relative;width:"+TL_W+"px;height:"+H+"px;user-select:none"});

  for(var q=0;q<=span*4+1e-9;q++){
    var v=sp.a+q/4, isYear=(Math.abs(v-Math.round(v))<1e-9);
    var gx=xOf(v);
    tl.appendChild(el("div",{style:"position:absolute;left:"+gx+"px;top:"+TOP+"px;bottom:28px;width:1px;background:"+(isYear?"var(--line2)":"var(--line)")}));
    if(isYear){
      tl.appendChild(el("div",{style:"position:absolute;left:"+gx+"px;bottom:0;transform:translateX(-50%);font-size:17px;font-weight:800;color:var(--mut)"},[String(Math.round(v))]));
    }
  }
  tl.appendChild(el("div",{style:"position:absolute;left:0;width:"+(LBL_W-12)+"px;bottom:0;font-size:17px;font-weight:900;color:var(--mut);text-align:right"},["Year"]));

  sc.phases.forEach(function(p,pi){
    var rowY=TOP+pi*ROWH;
    var lab=el("div",{style:[
      "position:absolute","left:0","width:"+(LBL_W-12)+"px","top:"+rowY+"px","height:"+(ROWH-8)+"px",
      "display:flex","align-items:center","justify-content:flex-end","gap:6px",
      "font-size:16px","font-weight:800","color:"+(p.enabled?"var(--ink)":"var(--faint)"),
      "text-align:right","overflow:hidden","white-space:nowrap"
    ].join(";")});
    var cb=el("input",{type:"checkbox",style:"width:18px;height:18px;accent-color:#233044;cursor:pointer;flex:none"});
    cb.checked=!!p.enabled;
    cb.addEventListener("change",function(e){ p.enabled=e.target.checked; rcRebuild(); });
    lab.appendChild(el("span",{style:"overflow:hidden;text-overflow:ellipsis"},[p.name]));
    lab.appendChild(cb);
    tl.appendChild(lab);

    if(!p.enabled) return;
    var col=RC_KIND_COLOR[p.kind]||"#9EDDD1";
    var bar=el("div",{
      title:p.name+"\n"+rcFmtYQ(p.start)+" → "+rcFmtYQ(rcPhaseEnd(p)-0.25)+"  ("+(p.dur*4)+" quarters)\n"+
            (rcPhaseUnitBeds(p)? rcPhaseUnitBeds(p)+" beds off-line, returns "+rcPhaseAfterBeds(p) : "no licensed beds off-line")+
            (p.obsAfter? "\n+"+p.obsAfter+" observation beds on completion":""),
      style:[
        "position:absolute","left:"+xOf(p.start)+"px","top:"+rowY+"px",
        "width:"+Math.max(6,xOf(rcPhaseEnd(p))-xOf(p.start))+"px","height:"+(ROWH-8)+"px",
        "background:"+col,"border:1px solid "+darkenColor(col,0.32),
        "cursor:grab","box-sizing:border-box","display:flex","align-items:center","padding:0 7px",
        "font-size:15px","font-weight:900","color:rgba(35,48,68,.8)","overflow:hidden","white-space:nowrap"
      ].join(";")
    },[ rcPhaseUnitBeds(p)? "−"+rcPhaseUnitBeds(p)+" beds" : (p.obsAfter? "+"+p.obsAfter+" obs" : "") ]);
    var lh=el("div",{style:"position:absolute;left:-4px;top:0;bottom:0;width:9px;cursor:ew-resize"});
    var rh=el("div",{style:"position:absolute;right:-4px;top:0;bottom:0;width:9px;cursor:ew-resize"});
    bar.appendChild(lh); bar.appendChild(rh);

    function commit(){
      bar.style.left=xOf(p.start)+"px";
      bar.style.width=Math.max(6,xOf(rcPhaseEnd(p))-xOf(p.start))+"px";
    }
    function drag(mode){
      return function(e){
        e.stopPropagation(); e.preventDefault();
        var s0=p.start, d0=p.dur, x0=e.clientX;
        function onMove(ev){
          var dq=Math.round(((ev.clientX-x0)/TW)*span*4)/4;
          if(mode==="move"){
            p.start=Math.round(Math.max(sp.a, Math.min(sp.b-d0, s0+dq))*4)/4;
          } else if(mode==="left"){
            var ns=Math.round(Math.max(sp.a, Math.min(s0+d0-0.25, s0+dq))*4)/4;
            p.dur=Math.round((s0+d0-ns)*4)/4; p.start=ns;
          } else {
            p.dur=Math.round(Math.max(0.25, Math.min(sp.b-p.start, d0+dq))*4)/4;
          }
          commit();
        }
        function onUp(){
          document.removeEventListener("mousemove",onMove);
          document.removeEventListener("mouseup",onUp);
          rcRebuild();
        }
        document.addEventListener("mousemove",onMove);
        document.addEventListener("mouseup",onUp);
      };
    }
    bar.addEventListener("mousedown",drag("move"));
    lh.addEventListener("mousedown",drag("left"));
    rh.addEventListener("mousedown",drag("right"));
    tl.appendChild(bar);
  });

  // current-time flag
  var cx=xOf(sc.currentTime);
  var line=el("div",{title:"Drag to move through the programme (quarter steps)",
    style:"position:absolute;left:"+cx+"px;top:"+(TOP-4)+"px;bottom:28px;width:12px;transform:translateX(-6px);background:linear-gradient(to right,transparent 5px,#233044 5px,#233044 7px,transparent 7px);z-index:5;cursor:ew-resize"});
  var flag=el("div",{title:"Drag to move through the programme (quarter steps)",
    style:"position:absolute;left:"+cx+"px;top:0;transform:translateX(-50%);background:#233044;color:#fff;font-size:12.5px;font-weight:900;padding:3px 9px;cursor:ew-resize;white-space:nowrap;z-index:6"
  },[rcFmtYQ(sc.currentTime)]);
  function dragCurrentTime(e){
    e.stopPropagation(); e.preventDefault();
    var x0=e.clientX, t0=sc.currentTime;
    function onMove(ev){
      var dq=Math.round(((ev.clientX-x0)/TW)*span*4)/4;
      sc.currentTime=Math.round(Math.max(sp.a, Math.min(sp.b, t0+dq))*4)/4;
      var nx=xOf(sc.currentTime);
      line.style.left=nx+"px"; flag.style.left=nx+"px"; flag.textContent=rcFmtYQ(sc.currentTime);
    }
    function onUp(){
      document.removeEventListener("mousemove",onMove);
      document.removeEventListener("mouseup",onUp);
      rcRebuild();
    }
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
  }
  flag.addEventListener("mousedown",dragCurrentTime);
  line.addEventListener("mousedown",dragCurrentTime);
  tl.appendChild(line); tl.appendChild(flag);
  var tlViewport=el("div",{style:"overflow-x:hidden;padding-bottom:2px"});
  tlViewport.appendChild(tl);
  wrap.appendChild(tlViewport);

  var lg=el("div",{class:"legend",style:"margin-top:6px;font-size:11px"});
  [["reno","Patient-unit renovation"],["fitout","Fit-out of new use"],["infra","Enabling / infrastructure"],["addition","Addition"]].forEach(function(p){
    lg.appendChild(el("span",null,[el("span",{class:"sw",style:"background:"+RC_KIND_COLOR[p[0]]}),p[1]]));
  });
  wrap.appendChild(lg);
  c.appendChild(wrap);
}

// ====================================================================
// BED GAIN / LOSS CHART
// ====================================================================
function rcBuildBedChart(c){
  c.innerHTML="";
  var sc=rcScenario();
  var sp=rcTimelineSpan(), span=sp.b-sp.a;
  var W=rcChartWidth(), LBL=RC_CHART_LABEL_W, TW=W-LBL;
  var H=276, TOP=34, BOT=H-34, PH=BOT-TOP;
  var lic=Number(S.constraints.licensed_beds.v);
  var minB=Number(S.constraints.min_operating_beds.v);

  var maxY=Math.max(lic, minB)+20;
  function xOf(v){ return LBL+(v-sp.a)/span*TW; }
  function yOf(b){ return TOP+PH-(b/maxY)*PH; }

  var ns="http://www.w3.org/2000/svg";
  var svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  svg.setAttribute("style","display:block;width:100%;height:auto;overflow:visible");
  function add(tag,attrs,text){
    var e=document.createElementNS(ns,tag);
    for(var k in attrs) e.setAttribute(k,attrs[k]);
    if(text!==undefined) e.textContent=text;
    svg.appendChild(e); return e;
  }

  // horizontal gridlines
  for(var b=0;b<=maxY;b+=20){
    add("line",{x1:LBL,x2:W,y1:yOf(b),y2:yOf(b),stroke:"#eef1f5","stroke-width":1});
    add("text",{x:LBL-10,y:yOf(b)+5,"text-anchor":"end","font-size":14,"font-weight":600,fill:"#8494ab","font-family":"Roboto, Arial, sans-serif"},String(b));
  }
  // year gridlines
  for(var y=Math.ceil(sp.a); y<=sp.b+1e-9; y++){
    add("line",{x1:xOf(y),x2:xOf(y),y1:TOP,y2:BOT,stroke:"#e2e6ec","stroke-width":1});
    add("text",{x:xOf(y),y:H-10,"text-anchor":"middle","font-size":15,"font-weight":700,fill:"#54637d","font-family":"Roboto, Arial, sans-serif"},String(y));
  }

  // sample by quarter
  var pts=[];
  for(var t=sp.a; t<sp.b-1e-9; t+=RC_Q){
    pts.push({t:t, b:rcBedsAt(t+1e-6)});
  }
  // stepped bars: licensed operating (teal) + observation (amber) stacked
  pts.forEach(function(p){
    var x1=xOf(p.t), x2=xOf(p.t+RC_Q);
    var below = p.b.operating<minB;
    add("rect",{x:x1,y:yOf(p.b.operating),width:Math.max(1,x2-x1-0.6),height:BOT-yOf(p.b.operating),
      fill: below?"#e8a0a0":"#9EDDD1", stroke:below?"#c0392b":"#3CA09E","stroke-width":.5});
    if(p.b.obs){
      add("rect",{x:x1,y:yOf(p.b.operating+p.b.obs),width:Math.max(1,x2-x1-0.6),height:yOf(p.b.operating)-yOf(p.b.operating+p.b.obs),
        fill:"#FFE885",stroke:"#d8b400","stroke-width":.5});
    }
    if(p.b.swing){
      add("line",{x1:x1,x2:x2-0.6,y1:yOf(p.b.operating-p.b.swing),y2:yOf(p.b.operating-p.b.swing),
        stroke:"#1d4f91","stroke-width":1.2,"stroke-dasharray":"2 2"});
    }
  });

  // licence + floor lines
  add("line",{x1:LBL,x2:W,y1:yOf(lic),y2:yOf(lic),stroke:"#233044","stroke-width":1.5,"stroke-dasharray":"6 4"});
  add("text",{x:LBL+8,y:yOf(lic)-7,"font-size":14,"font-weight":900,fill:"#233044","font-family":"Roboto, Arial, sans-serif"},
      "Licensed capacity — "+lic+" beds");
  add("line",{x1:LBL,x2:W,y1:yOf(minB),y2:yOf(minB),stroke:"#c0392b","stroke-width":1.5,"stroke-dasharray":"6 4"});
  add("text",{x:LBL+8,y:yOf(minB)+17,"font-size":14,"font-weight":900,fill:"#c0392b","font-family":"Roboto, Arial, sans-serif"},
      "Minimum operating beds — "+minB);

  // current time marker
  add("line",{x1:xOf(sc.currentTime),x2:xOf(sc.currentTime),y1:TOP-6,y2:BOT,stroke:"#233044","stroke-width":2});

  add("text",{x:LBL-10,y:TOP-14,"text-anchor":"end","font-size":15,"font-weight":900,fill:"#54637d","font-family":"Roboto, Arial, sans-serif"},"Beds");

  var box=el("div",{class:"box",style:"padding:12px 18px;margin-bottom:16px"});
  box.appendChild(el("h3",{style:"margin-bottom:2px"},["Bed Gain / Loss Through Construction"]));
  box.appendChild(el("p",{class:"hint",style:"margin:0 0 8px"},[
    "Staffed licensed beds by quarter: units off-line during their phase, swing beds added back (dashed blue = level without swing), and each unit returning at its converted count. Quarters below the operating floor turn red."
  ]));
  box.appendChild(svg);
  var lg=el("div",{class:"legend",style:"margin-top:8px;font-size:11px"});
  lg.appendChild(el("span",null,[el("span",{class:"sw",style:"background:#9EDDD1"}),"Staffed licensed beds"]));
  lg.appendChild(el("span",null,[el("span",{class:"sw",style:"background:#e8a0a0"}),"Below the operating floor"]));
  lg.appendChild(el("span",null,[el("span",{class:"sw",style:"background:#FFE885"}),"Observation beds (unlicensed)"]));
  lg.appendChild(el("span",null,[el("span",{class:"sw",style:"background:transparent;border-top:2px dashed #1d4f91;height:0"}),"Level without swing beds"]));
  box.appendChild(lg);
  c.appendChild(box);
}

// ====================================================================
// PHASE TABLE
// ====================================================================
function rcBuildPhaseTable(c){
  c.innerHTML="";
  var sc=rcScenario();
  var box=el("div");
  box.appendChild(el("h3",{style:"margin-bottom:8px"},["Phase schedule"]));
  var t=el("table",{class:"prog"});
  t.appendChild(el("thead",null,[el("tr",null,[
    el("th",{style:"width:22px"},[""]),
    el("th",null,["Phase"]),
    el("th",{style:"width:110px"},["Building"]),
    el("th",{class:"c",style:"width:84px"},["Start"]),
    el("th",{class:"r",style:"width:64px"},["Qtrs"]),
    el("th",{class:"r",style:"width:70px"},["Off-line"]),
    el("th",{class:"r",style:"width:64px"},["Swing"]),
    el("th",{class:"r",style:"width:72px"},["Returns"]),
    el("th",{class:"r",style:"width:66px"},["+ Obs"]),
    el("th",{class:"r",style:"width:82px"},["Reno GSF"]),
    el("th",{class:"r",style:"width:80px"},["New GSF"]),
    el("th",{class:"r",style:"width:76px"},["Cost"])
  ])]));
  var tb=el("tbody");
  var tot={off:0,reno:0,nw:0,obs:0,cost:0};
  sc.phases.forEach(function(p,pi){
    var cost=((Number(p.renoGSF)||0)*Number(S.cost.reno_psf.v)+(Number(p.newGSF)||0)*Number(S.cost.new_psf.v))/1e6;
    if(p.enabled){ tot.reno+=Number(p.renoGSF)||0; tot.nw+=Number(p.newGSF)||0; tot.obs+=Number(p.obsAfter)||0; tot.cost+=cost; }
    var tr=el("tr",{style:p.enabled?"":"opacity:.45"});
    tr.appendChild(el("td",{class:"c"},[el("span",{class:"sw",style:"background:"+(RC_KIND_COLOR[p.kind]||"#9EDDD1")})]));
    var tdN=el("td");
    var iN=el("input",{class:"cell",value:p.name});
    iN.addEventListener("change",function(e){ p.name=e.target.value; rcRebuild(); });
    tdN.appendChild(iN);
    if(p.note) tdN.appendChild(el("div",{style:"font-size:11px;font-weight:300;color:var(--mut)"},[p.note]));
    tr.appendChild(tdN);
    var tdB=el("td");
    var sel=el("select",{style:"width:100%;border:none;background:transparent;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none"});
    S.buildings.forEach(function(b){ var o=el("option",{value:b.id},[b.name]); if(b.id===p.bldg)o.selected=true; sel.appendChild(o); });
    sel.addEventListener("change",function(e){ p.bldg=e.target.value; rcRebuild(); });
    tdB.appendChild(sel); tr.appendChild(tdB);
    tr.appendChild(el("td",{class:"c"},[rcFmtYQ(p.start)]));
    tr.appendChild(el("td",{class:"r"},[String(Math.round(p.dur*4))]));
    tr.appendChild(el("td",{class:"r nsf"},[rcPhaseUnitBeds(p)?"−"+fmt(rcPhaseUnitBeds(p)):"—"]));
    var tdS=el("td",{class:"r"});
    var iS=el("input",{class:"cell r",value:p.swing});
    iS.addEventListener("change",function(e){ p.swing=Math.max(0,Number(e.target.value)||0); rcRebuild(); });
    tdS.appendChild(iS); tr.appendChild(tdS);
    tr.appendChild(el("td",{class:"r"},[rcPhaseAfterBeds(p)?fmt(rcPhaseAfterBeds(p)):"—"]));
    tr.appendChild(el("td",{class:"r"},[p.obsAfter?"+"+fmt(p.obsAfter):"—"]));
    [["renoGSF"],["newGSF"]].forEach(function(f){
      var td=el("td",{class:"r"});
      var i=el("input",{class:"cell r",value:p[f[0]]});
      i.addEventListener("change",function(e){ p[f[0]]=Math.max(0,Number(e.target.value)||0); rcRebuild(); renderHeader(); });
      td.appendChild(i); tr.appendChild(td);
    });
    tr.appendChild(el("td",{class:"r"},[money(cost)]));
    tb.appendChild(tr);
    if(p.enabled) tot.off+=rcPhaseUnitBeds(p);
  });
  var trt=el("tr",{class:"totalrow"});
  trt.appendChild(el("td",null,[""]));
  trt.appendChild(el("td",null,["Enabled phases"]));
  trt.appendChild(el("td",null,[""])); trt.appendChild(el("td",null,[""])); trt.appendChild(el("td",null,[""]));
  trt.appendChild(el("td",null,[""])); trt.appendChild(el("td",null,[""])); trt.appendChild(el("td",null,[""]));
  trt.appendChild(el("td",{class:"r"},["+"+fmt(tot.obs)]));
  trt.appendChild(el("td",{class:"r"},[fmt(tot.reno)]));
  trt.appendChild(el("td",{class:"r"},[fmt(tot.nw)]));
  trt.appendChild(el("td",{class:"r"},[money(tot.cost)]));
  tb.appendChild(trt);
  t.appendChild(tb);
  box.appendChild(t);
  box.appendChild(el("p",{class:"hint"},[
    "Cost shown is construction only. The Assumptions tab adds MEP/infrastructure uplift, contingency, soft costs and escalation to the construction midpoint ("+f1(rcMidpointYears())+" years from NTP) before testing the $"+fmt(S.constraints.budget_cap.v)+"M cap."
  ]));
  var add=el("div",{style:"margin-top:10px;display:flex;gap:8px"});
  add.appendChild(el("button",{class:"seg sm",onclick:function(){
    var sc=rcScenario();
    var last=sc.phases[sc.phases.length-1];
    sc.phases.push({id:"P"+sc.phases.length, name:"New phase", units:[], bldg:"east",
      start: last? Math.min(sc.timelineEnd-0.75, rcPhaseEnd(last)) : RC_T_START,
      dur:0.75, swing:0, obsAfter:0, renoGSF:0, newGSF:0, kind:"reno", enabled:true, note:""});
    rcRebuild();
  }},["+ Phase"]));
  add.appendChild(el("button",{class:"seg sm",onclick:function(){
    var sc=rcScenario();
    if(sc.phases.length && confirm("Delete the last phase, “"+sc.phases[sc.phases.length-1].name+"”?")){
      sc.phases.pop(); rcRebuild();
    }
  }},["− Phase"]));
  box.appendChild(add);
  c.appendChild(box);
}
