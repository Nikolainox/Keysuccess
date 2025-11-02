/******************************************
 * STATE
 ******************************************/
const S = {
  key: 'sensei_flow_v9_state',
  start: new Date().toISOString().slice(0,10),
  day: 1,
  xp: 0,
  lvl: 1,
  streak: 0,
  axes: { AI:0, Brand:0, Law:0 },
  blocks: {
    a:{ topic:'', link:'', tasks:[], done:false },
    b:{ topic:'', link:'', tasks:[], done:false },
    c:{ topic:'', link:'', tasks:[], done:false },
  },
  plan: [],
  dayNotes: {},
  books: []
};


/******************************************
 * SAVE / LOAD
 ******************************************/
function save(){
  localStorage.setItem(S.key, JSON.stringify(S));
  renderDashboard();
}

function manualSave(){
  save();
  const toast = byId('saveToast');
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'),1200);
}

function load(){
  const raw = localStorage.getItem(S.key);
  if(raw){
    try { Object.assign(S, JSON.parse(raw)); } catch(e){}
  }
  initNav();
  seedBooksIfEmpty();
  // auto-fill plan on first load so materials exist
  if(!S.plan || !S.plan.length){
    fillFullPlan(true); // silent
  }
  renderAll();
}


/******************************************
 * UTILS
 ******************************************/
function byId(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

document.addEventListener('keydown',e=>{
  if(e.ctrlKey && e.key.toLowerCase()==='s'){
    e.preventDefault();
    manualSave();
  }
});


/******************************************
 * NAV / TAB HANDLING
 ******************************************/
function initNav(){
  const tabs = byId('tabs');
  tabs.addEventListener('click', e=>{
    if(e.target.tagName==='BUTTON'){
      goTab(e.target.dataset.tab);
    }
  });
}

function goTab(id){
  document.querySelectorAll('.tab').forEach(sec=>sec.classList.add('hidden'));
  byId(id).classList.remove('hidden');
  document.querySelectorAll('#tabs button').forEach(btn=>btn.classList.remove('active'));
  qs(`#tabs button[data-tab="${id}"]`).classList.add('active');
}


/******************************************
 * DASHBOARD / LEVEL / RADAR
 ******************************************/
function lvlNeed(l){ return 100 + (l-1)*40; }

function gainXP(n){
  S.xp += n;
  while(S.xp >= lvlNeed(S.lvl)){
    S.xp -= lvlNeed(S.lvl);
    S.lvl++;
  }
}

function renderDashboard(){
  byId('dayLabel').textContent = `Day ${S.day} / 90`;
  byId('startDate').textContent = S.start;

  const pct = Math.round((S.day-1)/90*100);
  const circ = 2*Math.PI*70;
  const off = circ*(1-pct/100);
  byId('progPct').textContent = pct+'%';
  qs('#ringProg').setAttribute('stroke-dasharray', circ.toFixed(1));
  qs('#ringProg').setAttribute('stroke-dashoffset', off.toFixed(1));

  byId('xp').textContent = S.xp;
  byId('xpNext').textContent = 100+(S.lvl-1)*40;
  byId('lvl').textContent = S.lvl;
  byId('streak').textContent = S.streak;

  byId('aiScore').textContent = S.axes.AI;
  byId('brandScore').textContent = S.axes.Brand;
  byId('lawScore').textContent = S.axes.Law;

  renderRadar();
  renderSensei();
}

function renderSensei(){
  const dn = S.dayNotes[S.day] || {notes:'',reflection:''};
  const allDone = S.blocks.a.done && S.blocks.b.done && S.blocks.c.done;
  const msg = allDone
    ? 'Full day complete — discipline compounds. 📈'
    : 'Finish all 3 focus blocks today.';
  const hint = (dn.notes||'').length>60
    ? 'Nice depth. Turn this into 1 headline.'
    : 'Write 2 bullets: What I learned / How it helps my future.';
  byId('senseiFeedback').textContent = `${msg} Tip: ${hint}`;
}

function renderRadar(){
  const box = byId('radarBox');
  if(!box) return;
  box.innerHTML = '';
  const w=260,h=260,cx=130,cy=130,r=100;
  const axes = [
    {name:'AI',   val:clamp(S.axes.AI,0,100)},
    {name:'Brand',val:clamp(S.axes.Brand,0,100)},
    {name:'Law',  val:clamp(S.axes.Law,0,100)},
  ];
  const pts = axes.map((a,i)=>{
    const ang=-Math.PI/2 + i*2*Math.PI/axes.length;
    const rr=r*(a.val/100);
    const x=cx+rr*Math.cos(ang);
    const y=cy+rr*Math.sin(ang);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  let grid='';
  for(let k=1;k<=4;k++){
    const rr=r*k/4;
    grid += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#1b2a3a" stroke-dasharray="2 4"></circle>`;
  }

  let lines='', labels='';
  axes.forEach((a,i)=>{
    const ang=-Math.PI/2+i*2*Math.PI/axes.length;
    const x=cx+r*Math.cos(ang), y=cy+r*Math.sin(ang);
    lines+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#1b2a3a"></line>`;
    const lx=cx+(r+16)*Math.cos(ang), ly=cy+(r+16)*Math.sin(ang);
    labels+=`<text x="${lx}" y="${ly}" fill="#9fb0c6" font-size="12" text-anchor="middle" alignment-baseline="middle">${a.name}</text>`;
  });

  box.innerHTML =
    `<svg width="${w}" height="${h}">
      ${grid}
      ${lines}
      <polygon points="${pts}" fill="url(#rg)" stroke="#00bfff" stroke-width="2" opacity="0.9"></polygon>
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgba(0,191,255,.35)"></stop>
          <stop offset="100%" stop-color="rgba(139,92,246,.25)"></stop>
        </radialGradient>
      </defs>
      ${labels}
    </svg>`;
}


/******************************************
 * TODAY VIEW / TASKS / TIMER / SAVE DAY
 ******************************************/
['a','b','c'].forEach(k=>{
  document.addEventListener('input',e=>{
    if(e.target.id===k+'Topic'){ S.blocks[k].topic=e.target.value; save(); }
    if(e.target.id===k+'Link'){ S.blocks[k].link=e.target.value; save(); }
  });
});

function renderTasks(k){
  const box = byId(k+'Tasks');
  if(!box) return;
  box.innerHTML = '';
  (S.blocks[k].tasks||[]).forEach((t,i)=>{
    const row = document.createElement('div');
    row.className='checkline';
    row.innerHTML = `
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask('${k}',${i})">
      <span>${t.t}</span>`;
    box.appendChild(row);
  });
}

function addTask(k){
  const inp = byId(k+'New');
  const v = (inp.value||'').trim();
  if(!v) return;
  (S.blocks[k].tasks ||= []).push({t:v,done:false});
  inp.value='';
  save();
  renderTasks(k);
}

function toggleTask(k,i){
  S.blocks[k].tasks[i].done = !S.blocks[k].tasks[i].done;
  save();
  renderTasks(k);
}

function openLink(k){
  const u = S.blocks[k].link;
  if(u) window.open(u,'_blank');
}

/*** Focus timer / overlay ***/
let timers = {};
let focusInt = null;
let focusSecs = 0;

function startTimer(which){
  const el = byId('timer'+which);
  clearInterval(timers[which]);
  let secs = 90*60;
  timers[which] = setInterval(()=>{
    secs--;
    if(secs<=0){
      clearInterval(timers[which]);
      el.textContent='00:00';
    } else {
      const m = String(Math.floor(secs/60)).padStart(2,'0');
      const s = String(secs%60).padStart(2,'0');
      el.textContent = `${m}:${s}`;
    }
  },1000);
}

function startFocus(which){
  startTimer(which);
  focusSecs = 90*60;
  byId('focusWhat').textContent = `Now focusing: Block ${which}`;
  byId('focusTimer').textContent = '90:00';
  byId('focusOverlay').style.display='grid';

  clearInterval(focusInt);
  focusInt = setInterval(()=>{
    focusSecs--;
    if(focusSecs<=0){
      stopFocus();
      alert('Focus session complete!');
    } else {
      const m = String(Math.floor(focusSecs/60)).padStart(2,'0');
      const s = String(focusSecs%60).padStart(2,'0');
      byId('focusTimer').textContent = `${m}:${s}`;
    }
  },1000);
}

function stopFocus(){
  byId('focusOverlay').style.display='none';
  clearInterval(focusInt);
}

/*** Mark block done → XP / radar ***/
function finishBlock(k){
  if(S.blocks[k].done) return;
  S.blocks[k].done = true;
  gainXP(25);

  if(k==='a') S.axes.AI   +=2;
  if(k==='b') S.axes.Brand+=2;
  if(k==='c') S.axes.Law  +=2;

  save();
  alert('Block completed! +25 XP');
}

/*** Day notes / reflection ***/
byId('notesToday').addEventListener('input', e=>{
  const dn = (S.dayNotes[S.day] ||= {notes:'',reflection:''});
  dn.notes = e.target.value;
  save();
});

byId('reflection').addEventListener('input', e=>{
  const dn = (S.dayNotes[S.day] ||= {notes:'',reflection:''});
  dn.reflection = e.target.value;
  save();
});

function saveDay(){
  const aOk = (S.blocks.a.tasks||[]).every(t=>t.done) || (S.blocks.a.tasks||[]).length===0;
  const bOk = (S.blocks.b.tasks||[]).every(t=>t.done) || (S.blocks.b.tasks||[]).length===0;
  const cOk = (S.blocks.c.tasks||[]).every(t=>t.done) || (S.blocks.c.tasks||[]).length===0;

  if(S.blocks.a.done && S.blocks.b.done && S.blocks.c.done && aOk && bOk && cOk){
    S.streak += 1;
    gainXP(50);
  } else {
    S.streak = 0;
  }
  save();
  alert('Day saved!');
}

function nextDay(){
  if(S.day < 90){
    S.day += 1;
    S.blocks.a={topic:'',link:'',tasks:[],done:false};
    S.blocks.b={topic:'',link:'',tasks:[],done:false};
    S.blocks.c={topic:'',link:'',tasks:[],done:false};
    save();
    autoLoadToday();
  }
}


/******************************************
 * ROADMAP (90 DAYS PLAN)
 ******************************************/
const AIs = [
  ['Elements of AI — Intro','https://www.elementsofai.com/',['Read Chapters 1–2','Write 5 AI use-cases','Write your AI vision (4 lines)']],
  ['AI for Everyone (audit mode)','https://www.coursera.org/learn/ai-for-everyone',['Watch Week 1–2','AI vs non-AI notes','Brand impact summary']],
  ['Prompt Engineering Basics','https://learn.deeplearning.ai/courses/chatgpt-prompt-engineering-for-developers',['Role + Context + Constraints','Write 5 marketing prompts','Refine them']],
  ['Google AI Crash Course','https://developers.google.com/machine-learning/crash-course',['Intro lessons','Define 10 terms','1 practical example']],
  ['freeCodeCamp: Data Analysis with Python','https://www.freecodecamp.org/learn/data-analysis-with-python/',['Do 1 section','Note pandas basics','1 data insight']],
  ['Storyboard / Canva Visual Concept','https://www.canva.com/',['Make 6-frame storyboard','1 line per frame','Prep short video']],
  ['AI Content Calendar','https://www.hootsuite.com/resources/templates/social-media-content-calendar',['Plan 7 posts','Define 3 CTAs','Write 1 hook per post']],
];

const BRANDs = [
  ['StoryBrand (free resources)','https://storybrand.com/resources/',['Define hero & villain','Write your brand story','Problem → solution']],
  ['HubSpot Content Marketing','https://academy.hubspot.com/',['Watch Lesson 1–2','List 10 content ideas','Pick best channel']],
  ['The Brand Gap (summary)','https://www.youtube.com/results?search_query=the+brand+gap+summary',['Choose 5 brand adjectives','Write position sentence','Competitor set']],
  ['Canva Design School','https://www.canva.com/learn/',['Make moodboard','Pick brand colors','Choose 2 fonts']],
  ['Copywriting Basics (Copyblogger)','https://www.copyblogger.com/',['Write 10 hooks','H/S/O outline','Draft hero section']],
  ['Content Strategy (Backlinko)','https://www.backlinko.com/content-marketing-strategy',['Plan 1-week content map','Define channel','Define success metric']],
  ['Landing Page (freeCodeCamp)','https://www.freecodecamp.org/learn/2022/responsive-web-design/',['Draft landing page','Hero + USP + CTA','Collect feedback']],
];

const LAWCOMMs = [
  ['Business Law for Entrepreneurs','https://www.coursera.org/learn/business-law-entrepreneurs',['10 key terms','NDA headings','Contract basics']],
  ['WIPO DL-101 (IP)','https://www.wipo.int/academy/en/courses/dl101/',['TM vs Copyright','AI-output IP','Attribution plan']],
  ['Successful Negotiation','https://www.coursera.org/learn/negotiation#syllabus',['Mirroring & labeling','Accusation audit','Practice script']],
  ['International Business Law (edX)','https://www.edx.org/course/international-business-law',['Entity types','Jurisdiction','Risk list']],
  ['EU AI Act – official','https://digital-strategy.ec.europa.eu/en/policies/european-ai-act',['Marketing impact','Risk checklist','Compliance note']],
  ['Personal MBA – finance','https://personalmba.com/',['P&L / BS / CF','Unit economics','Pricing thought']],
  ['Presentation basics','https://www.duarte.com/presentation-skills-resources/',['3-min pitch','Slide outline','Rehearse x2']],
];

function fillFullPlan(silent){
  S.plan = [];
  for(let d=1; d<=90; d++){
    const a = AIs[(d-1)%AIs.length];
    const b = BRANDs[(d-1)%BRANDs.length];
    const c = LAWCOMMs[(d-1)%LAWCOMMs.length];
    S.plan.push({
      day:d,
      A:a[0], Alink:a[1]||'', Atasks:a[2]||[],
      B:b[0], Blink:b[1]||'', Btasks:b[2]||[],
      C:c[0], Clink:c[1]||'', Ctasks:c[2]||[]
    });
  }
  save();
  renderPlan();
  autoLoadToday();
  if(!silent) alert('Full 90-day plan loaded (all FREE).');
}

function clearPlan(){
  S.plan = [];
  save();
  renderPlan();
}

function renderPlan(){
  const box = byId('planList');
  box.innerHTML = '';
  if(!S.plan.length){
    box.innerHTML = `<div class="card">No plan yet — press “Fill full 90 days (FREE)”.</div>`;
    return;
  }
  S.plan.forEach(p=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `
      <div class="row">
        <b>Day ${p.day}</b>
        <span class="right small muted">A / B / C</span>
      </div>

      <label>A (AI)</label>
      <input value="${p.A}" oninput="editPlan(${p.day},'A',this.value)">
      <input type="url" placeholder="Link A" value="${p.Alink}" oninput="editPlan(${p.day},'Alink',this.value)">
      <div class="small muted">${(p.Atasks||[]).join(' • ')}</div>

      <label>B (Brand)</label>
      <input value="${p.B}" oninput="editPlan(${p.day},'B',this.value)">
      <input type="url" placeholder="Link B" value="${p.Blink}" oninput="editPlan(${p.day},'Blink',this.value)">
      <div class="small muted">${(p.Btasks||[]).join(' • ')}</div>

      <label>C (Law & Comm)</label>
      <input value="${p.C}" oninput="editPlan(${p.day},'C',this.value)">
      <input type="url" placeholder="Link C" value="${p.Clink}" oninput="editPlan(${p.day},'Clink',this.value)">
      <div class="small muted">${(p.Ctasks||[]).join(' • ')}</div>
    `;
    box.appendChild(card);
  });
}

function editPlan(day,key,val){
  const p = S.plan.find(x=>x.day===day);
  if(p){
    p[key] = val;
    save();
  }
}

function autoLoadToday(){
  const p = S.plan.find(x=>x.day===S.day);
  if(!p) return;
  S.blocks.a = { topic:p.A, link:p.Alink, tasks:(p.Atasks||[]).map(t=>({t,done:false})), done:false };
  S.blocks.b = { topic:p.B, link:p.Blink, tasks:(p.Btasks||[]).map(t=>({t,done:false})), done:false };
  S.blocks.c = { topic:p.C, link:p.Clink, tasks:(p.Ctasks||[]).map(t=>({t,done:false})), done:false };
  save();
  renderToday();
}

document.addEventListener('DOMContentLoaded',()=>{
  const fillBtn = byId('fillPlan');
  if(fillBtn) fillBtn.addEventListener('click', ()=>fillFullPlan(false));
});


/******************************************
 * BOOKS
 ******************************************/
function seedBooksIfEmpty(){
  if(S.books && S.books.length) return;
  S.books = [
    {title:'Deep Work — Cal Newport',focus:'Focus',link:'https://www.youtube.com/results?search_query=deep+work+cal+newport+summary',notes:'',done:false},
    {title:'The Personal MBA — Josh Kaufman',focus:'Business',link:'https://personalmba.com/',notes:'',done:false},
    {title:'Show Your Work! — Austin Kleon',focus:'Creative',link:'https://austinkleon.com/show-your-work/',notes:'',done:false},
    {title:'The Brand Gap — Marty Neumeier',focus:'Brand',link:'https://www.youtube.com/results?search_query=the+brand+gap+summary',notes:'',done:false},
    {title:'This Is Marketing — Seth Godin',focus:'Marketing',link:'https://www.youtube.com/results?search_query=this+is+marketing+summary',notes:'',done:false},
    {title:'Never Split the Difference — Chris Voss',focus:'Negotiation',link:'https://www.youtube.com/results?search_query=never+split+the+difference+summary',notes:'',done:false},
    {title:'Influence — Robert Cialdini',focus:'Persuasion',link:'https://www.youtube.com/results?search_query=influence+cialdini+summary',notes:'',done:false},
    {title:'Made to Stick — Heath Brothers',focus:'Communication',link:'https://www.youtube.com/results?search_query=made+to+stick+summary',notes:'',done:false},
    {title:'Hooked — Nir Eyal',focus:'Product',link:'https://www.youtube.com/results?search_query=hooked+nir+eyal+summary',notes:'',done:false},
    {title:'Think Again — Adam Grant',focus:'Learning',link:'https://www.youtube.com/results?search_query=think+again+adam+grant+summary',notes:'',done:false},
    {title:'The Mom Test — Rob Fitzpatrick',focus:'Validation',link:'https://www.youtube.com/results?search_query=the+mom+test+summary',notes:'',done:false},
    {title:'Atomic Habits — James Clear',focus:'Systems',link:'https://jamesclear.com/atomic-habits',notes:'',done:false},
  ].map((b,i)=>({id:'b'+i,...b}));
  save();
}

function renderBooks(){
  const box = byId('booksList');
  if(!box) return;
  box.innerHTML = '';
  S.books.forEach((b,i)=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `
      <div class="row">
        <b>${b.title}</b>
        <span class="pill">${b.focus}</span>
        <div class="right">
          <label class="pill small">
            <input type="checkbox" ${b.done?'checked':''} onchange="toggleBook(${i})"> done
          </label>
        </div>
      </div>
      <div class="row">
        <input type="url" value="${b.link}" oninput="editBookLink(${i},this.value)">
        <button class="btn ghost smallbtn right" onclick="openBook(${i})">Open</button>
      </div>
      <label>Your notes</label>
      <textarea oninput="editBookNotes(${i},this.value)" placeholder="- key idea
- how I apply it">${b.notes||''}</textarea>
    `;
    box.appendChild(card);
  });
}

function toggleBook(i){
  S.books[i].done = !S.books[i].done;
  save();
  renderBooks();
}
function editBookLink(i,v){ S.books[i].link=v; save(); }
function editBookNotes(i,v){ S.books[i].notes=v; save(); }
function openBook(i){ const u=S.books[i].link; if(u) window.open(u,'_blank'); }

/******************************************
 * SETTINGS / BACKUP
 ******************************************/
function saveBase(){
  const s = byId('start').value;
  const d = +byId('dayNum').value;
  if(s) S.start = s;
  if(d>=1 && d<=90) S.day = d;
  save();
  autoLoadToday();
  alert('Settings saved.');
}

function exportData(){
  const data = JSON.stringify(S,null,2);
  const blob = new Blob([data],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download='sensei-flow-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      Object.assign(S, JSON.parse(r.result));
      save();
      renderAll();
      alert('Backup imported.');
    }catch(e){
      alert('Import error: '+e.message);
    }
  };
  r.readAsText(f);
}


/******************************************
 * RENDER SECTIONS
 ******************************************/
function renderToday(){
  byId('currentDay').textContent = S.day;
  byId('aTopic').value = S.blocks.a.topic||'';
  byId('aLink').value  = S.blocks.a.link||'';
  renderTasks('a');

  byId('bTopic').value = S.blocks.b.topic||'';
  byId('bLink').value  = S.blocks.b.link||'';
  renderTasks('b');

  byId('cTopic').value = S.blocks.c.topic||'';
  byId('cLink').value  = S.blocks.c.link||'';
  renderTasks('c');

  const dn = S.dayNotes[S.day] || {notes:'',reflection:''};
  byId('notesToday').value = dn.notes || '';
  byId('reflection').value = dn.reflection || '';
}

function renderSettings(){
  byId('start').value = S.start;
  byId('dayNum').value = S.day;
}

function renderAll(){
  renderDashboard();
  renderToday();
  renderPlan();
  renderBooks();
  renderSettings();
}


/******************************************
 * INIT
 ******************************************/
load();
