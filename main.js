const QUESTIONS=window.__Q||[];


const TYPE_META = {judge:"判断题", single:"单选题", multi:"多选题", short:"简答题", case:"案例分析题"};
const TYPE_COUNTS = QUESTIONS.reduce((m,q)=>{m[q.type]=(m[q.type]||0)+1;return m;},{});
const MOD_COUNTS = QUESTIONS.reduce((m,q)=>{m[q.module]=(m[q.module]||0)+1;return m;},{});
const MODULES = ["汽车概论与机械基础","汽车发动机维修","汽车底盘维修","汽车电子与电器维修","汽车维修工操作知识"];
const CHAP_MOD = {}; const MOD_CHAPTERS = {};
QUESTIONS.forEach(q=>{ CHAP_MOD[q.chapter]=q.module; (MOD_CHAPTERS[q.module] = MOD_CHAPTERS[q.module]||{})[q.chapter] = (MOD_CHAPTERS[q.module][q.chapter]||0)+1; });
const STORE_KEY = "qc_progress_v1";

/* ---------- 进度持久化 ---------- */
function loadProgress(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }catch(e){ return {}; }
}
let progress = loadProgress();
function saveProgress(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }catch(e){} }

function stats(){
  const ids = Object.keys(progress).map(Number);
  let okCount = 0, totalTry = 0;
  ids.forEach(id => { const p = progress[id]; okCount += p.c || 0; totalTry += p.n || 0; });
  const rate = totalTry ? Math.round(okCount / totalTry * 100) : 0;
  const wrong = ids.filter(id => progress[id].last === false).length;
  return { answered: ids.length, totalTry, rate, wrong };
}

/* ---------- 会话 ---------- */
let session = null; // {mode, ids, idx, answers:{id:...}, verdicts:{id:true/false}}

/* ---------- 工具 ---------- */
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function sortedKey(sel){ return (Array.isArray(sel)?sel:[]).slice().sort().join(""); }

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove("show"), 2000);
}

/* ---------- 路由 ---------- */
function route(){
  const h = location.hash || "#/home";
  const nav = h.startsWith("#/quiz") ? "quiz" : h.startsWith("#/wrong") ? "wrong" : h.startsWith("#/fav") ? "fav" : "home";
  document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("active", a.dataset.nav===nav));
  if(h.startsWith("#/quiz")) renderQuiz();
  else if(h.startsWith("#/wrong")) renderWrong();
  else if(h.startsWith("#/fav")) renderFav();
  else if(h.startsWith("#/search")) renderSearch();
  else if(h.startsWith("#/report")) renderReport();
  else if(h.startsWith("#/exams")) renderExams();
  else renderHome();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange", route);

/* ---------- 首页 ---------- */
function renderHome(){
  const st = stats();
  const filter = filterState();
  const typeChips = Object.keys(TYPE_COUNTS).map(t =>
    `<button class="chip${filter.types.includes(t)?" on":""}" data-type="${t}" onclick="toggleFilterType('${t}')">${TYPE_META[t]}（${TYPE_COUNTS[t]}题）</button>`
  ).join("");
  const modChips = Object.keys(MOD_COUNTS).map(m =>
    `<button class="chip${filter.mods.includes(m)?" on":""}" data-mod="${esc(m)}" onclick="toggleFilterMod('${esc(m)}')">${m}（${MOD_COUNTS[m]}题）</button>`
  ).join("");
  const totalChap = Object.keys(CHAP_MOD).length;
  const chapEntry = `<button class="chap-entry" onclick="openChapterPicker()">
      <div><div class="chap-entry-name">进入章节选择</div><div class="chap-entry-sub">${filter.chapters.length===totalChap ? "默认全选，共36章" : "已选 "+filter.chapters.length+" / 36 章"}</div></div>
      <div class="chap-entry-arrow">→</div>
    </button>${filter.chapters.length===totalChap ? "" : `<div class="chips" style="margin-top:10px">${filter.chapters.map(c=>`<button class="chip on" data-chapter="${esc(c)}" onclick="toggleFilterChapter('${esc(c)}')">${esc(c)}（${MOD_CHAPTERS[CHAP_MOD[c]][c]}题）</button>`).join("")}</div>`}`;
  const nWrong = st.wrong;
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">刷题控制台</h1>
    <p class="view-desc">依据湖北省技能高考汽车维修类考试大纲编制的 8231 题题库，本地记录进度与错题，随时可继续。</p>
    <div class="stat-row">
      <div class="stat"><div class="stat-num">${st.answered}<small> / 8231</small></div><div class="stat-label">已作答题目</div></div>
      <div class="stat ok"><div class="stat-num">${st.rate}<small>%</small></div><div class="stat-label">总正确率</div></div>
      <div class="stat"><div class="stat-num">${st.totalTry}</div><div class="stat-label">累计作答次数</div></div>
      <div class="stat bad"><div class="stat-num">${nWrong}</div><div class="stat-label">错题数</div></div>
    </div>

    <div class="card">
      <div class="filter-block">
        <div class="filter-title">题型筛选（默认全选）</div>
        <div class="chips">${typeChips}</div>
      </div>
      <div class="filter-block">
        <div class="filter-title">知识模块筛选（默认全选）</div>
        <div class="chips">${modChips}</div>
      </div>
      <div class="filter-block">
        <div class="filter-title">章节小类筛选（默认全选，共36章）</div>
        ${chapEntry}
      </div>
      <div style="margin-top:14px">
        <button class="btn btn-ghost" onclick="resetFilter()">重置筛选</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-title">选择刷题模式</div>
      <div class="mode-grid">
        <button class="mode-card" onclick="startQuiz('order')">
          <span class="mode-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>顺序刷题</span>
          <span class="mode-desc">按题库顺序逐题练习，适合系统复习。</span>
          <span class="mode-count">${filteredCount(filter)} 题可刷</span>
        </button>
        <button class="mode-card" onclick="startQuiz('random')">
          <span class="mode-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h4l10 12h4"/><path d="M17 6h4v4"/><path d="M3 18h4l2-2.4"/></svg>随机刷题</span>
          <span class="mode-desc">随机抽题打乱顺序，检验掌握程度。</span>
          <span class="mode-count">${filteredCount(filter)} 题可刷</span>
        </button>
        <button class="mode-card" onclick="startQuiz('wrong')">
          <span class="mode-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>错题重刷</span>
          <span class="mode-desc">只刷最近答错的题，攻破薄弱点。</span>
          <span class="mode-count">${nWrong} 题待攻克</span>
        </button>
      </div>
    </div>`;
}

function filterState(){
  const t = document.querySelectorAll(".chip[data-type].on");
  const m = document.querySelectorAll(".chip[data-mod].on");
  const c = document.querySelectorAll(".chip[data-chapter].on");
  const types = t.length ? Array.from(t).map(el=>el.dataset.type) : Object.keys(TYPE_COUNTS);
  const mods = m.length ? Array.from(m).map(el=>el.dataset.mod) : Object.keys(MOD_COUNTS);
  let chapters;
  if(window._chapSel && window._chapSel.length){
    chapters = window._chapSel.slice();
  } else {
    chapters = c.length ? Array.from(c).map(el=>el.dataset.chapter) : Object.keys(CHAP_MOD);
  }
  return {types, mods, chapters};
}
function matchFilter(q,f){
  if(!f.types.includes(q.type)) return false;
  if(!f.mods.includes(q.module)) return false;
  if(!f.chapters.includes(q.chapter)) return false;
  return true;
}
function filteredCount(f){
  return QUESTIONS.filter(q=>matchFilter(q,f)).length;
}
function toggleFilterType(t){
  const el = document.querySelector(`.chip[data-type="${t}"]`);
  el.classList.toggle("on");
  renderHome();
}
function toggleFilterMod(m){
  const el = document.querySelector(`.chip[data-mod="${esc(m)}"]`);
  el.classList.toggle("on");
  if(!el.classList.contains("on")){
    document.querySelectorAll(".chip[data-chapter]").forEach(c=>{
      if(CHAP_MOD[c.dataset.chapter]===m) c.classList.remove("on");
      else c.classList.add("on");
    });
  }
  const nowOn = Array.from(document.querySelectorAll(".chip[data-chapter].on")).map(el=>el.dataset.chapter);
  window._chapSel = nowOn.length ? nowOn : null;
  renderHome();
}
function toggleFilterChapter(ch){
  const el = document.querySelector(`.chip[data-chapter="${esc(ch)}"]`);
  if(!el.classList.contains("on")){
    el.classList.add("on");
  } else {
    const all = document.querySelectorAll(".chip[data-chapter]");
    const onCount = Array.from(all).filter(c=>c.classList.contains("on")).length;
    if(onCount === all.length){
      all.forEach(c=>{ if(c!==el) c.classList.remove("on"); });
    } else {
      el.classList.remove("on");
    }
  }
  const mel = document.querySelector(`.chip[data-mod="${esc(CHAP_MOD[ch])}"]`);
  if(mel) mel.classList.add("on");
  const nowOn = Array.from(document.querySelectorAll(".chip[data-chapter].on")).map(el=>el.dataset.chapter);
  window._chapSel = nowOn.length ? nowOn : null;
  renderHome();
}
function resetFilter(){
  window._chapSel = null;
  document.querySelectorAll(".chip").forEach(c=>c.classList.add("on"));
  renderHome();
}

/* ---------- 开始刷题 ---------- */
function startQuiz(mode){
  const f = filterState();
  let ids = QUESTIONS.filter(q=>matchFilter(q,f)).map(q=>q.id);
  if(mode === "random") ids = shuffle(ids);
  if(mode === "wrong"){
    const wrongSet = new Set(Object.keys(progress).filter(id=>progress[id].last===false).map(Number));
    ids = ids.filter(id=>wrongSet.has(id));
    if(!ids.length){ toast("错题本是空的，先完成一轮刷题吧"); return; }
  }
  if(!ids.length){ toast("当前筛选下没有题目，请调整筛选"); return; }
  session = { mode, ids, idx:0, answers:{}, verdicts:{} };
  location.hash = "#/quiz";
}
function exitQuiz(){ session = null; location.hash = "#/home"; }

/* ---------- 刷题视图 ---------- */
function renderQuiz(){
  if(!session || !session.ids.length){ location.hash="#/home"; return; }
  if(session.mode === "exam"){ renderExamQ(); return; }
  const q = QUESTIONS.find(x=>x.id === session.ids[session.idx]);
  const cur = session.idx + 1, total = session.ids.length;
  const answered = Object.keys(session.answers).length;
  const pct = Math.round(answered/total*100);
  const done = answered >= total && session.idx === total-1;
  if(done){ renderDone(); return; }
  const verdict = session.verdicts[q.id];
  const hasAns = session.answers[q.id] !== undefined;

  let body = "";
  if(q.type === "judge"){
    body = `
      <div class="judge-row">
        <button class="judge-btn${hasAns?(q.a==="√"?" correct":(session.answers[q.id]==="√"?" wrong":"")):""}" id="jTrue" onclick="answerJudge('√')" ${hasAns?"disabled":""}>√　正确</button>
        <button class="judge-btn${hasAns?(q.a==="×"?" correct":(session.answers[q.id]==="×"?" wrong":"")):""}" id="jFalse" onclick="answerJudge('×')" ${hasAns?"disabled":""}>×　错误</button>
      </div>`;
  } else if(q.type === "single" || q.type === "multi"){
    const multi = q.type === "multi";
    body = `<div class="opts">` + q.opts.map(op=>{
      const sel = session.answers[q.id] || [];
      const selArr = Array.isArray(sel)?sel:[];
      const isSel = selArr.includes(op[0]);
      let cls = "opt";
      if(hasAns){
        const rightKeys = q.a.split("");
        const isRight = rightKeys.includes(op[0]);
        if(isRight) cls += " correct";
        else if(isSel) cls += " wrong";
        else cls += " dim";
      } else if(isSel){ cls += " selected"; }
      return `<button class="${cls}" onclick="toggleOpt('${op[0]}')" ${hasAns?"disabled":""}>
        <span class="opt-key">${op[0]}</span><span>${esc(op[1])}</span></button>`;
    }).join("") + `</div>`;
    if(multi && !hasAns){
      body += `<div style="margin-top:14px"><button class="btn btn-primary" onclick="submitMulti()">提交答案</button>
        <button class="btn btn-ghost" style="margin-left:10px" onclick="clearMulti()">清空选择</button></div>`;
    }
  } else {
    body = `<div style="text-align:center">
      <button class="btn btn-primary" onclick="showAnswer()">查看参考答案</button>
      <p style="font-size:13px;color:var(--muted);margin-top:10px">阅读参考答案后，请自评本题掌握情况</p>
    </div>`;
  }

  const fb = hasAns ? feedbackHtml(q, verdict) : "";
  const answerPanel = (!hasAns && (q.type==="short"||q.type==="case")) ? "" :
    (q.type==="short"||q.type==="case") && session.answers[q.id]==="shown" ? `
      <div class="answer-panel"><div class="ap-title">参考答案</div><div class="ap-text">${esc(q.a)}</div></div>
      <div class="fb-actions" style="margin-top:12px">
        <button class="btn btn-ok" onclick="selfJudge(true)">掌握</button>
        <button class="btn btn-ghost" onclick="selfJudge(false)">仍需练习</button>
      </div>` : "";

  document.getElementById("view").innerHTML = `
    <div class="quiz-head">
      <div class="quiz-progress"><i style="width:${pct}%"></i></div>
      <span class="quiz-count">${answered} / ${total}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="tag type-${q.type}">${TYPE_META[q.type]}</span>
      <span class="tag module">${esc(q.module)}</span>
    </div>
    <div class="q-body">
      <div class="q-title-row"><div class="q-title">${q.type==="case"&&q.title?`<span class="q-case-title">${esc(q.title)}</span>`:""}<span class="q-no">${session.idx+1}.</span>${esc(q.q)}</div>
      <button class="star-btn${isFav(q.id)?" on":""}" id="starBtn" onclick="toggleFav(${q.id})" title="收藏本题"><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg></button></div>
      ${body}
      ${fb}
      ${answerPanel}
      <div class="quiz-nav">
        <button class="btn btn-ghost" onclick="prevQ()" ${session.idx===0?"disabled":""}>上一题</button>
        <button class="btn btn-ghost" onclick="toggleSheet()">答题卡</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost" onclick="exitQuiz()">退出</button>
        <button class="btn btn-primary" onclick="nextQ()" ${session.idx>=total-1?"disabled":""}>下一题</button>
      </div>
    </div>
    <div class="sheet-wrap hidden" id="sheetPanel">${sheetHtml()}</div>`;
}

function feedbackHtml(q, verdict){
  const ok = verdict === true;
  return `<div class="feedback ${ok?"ok":"bad"} show">
    <div class="fb-title">${ok?"回答正确":"回答错误"}</div>
    <div class="fb-explain">正确答案：${esc(q.a)}</div>
    ${q.e?structuredExplain(q.e):""}
  </div>`;
}
function structuredExplain(e){
  e = String(e||"").replace(/【(考点|题干分析|选项逐一分析|解析|易错|记忆口诀)">/g,"【$1】");
  if(e.indexOf("【考点】") < 0) return `<div class="fb-explanation">${esc(e)}</div>`;
  const segs = [["【考点】","pt","考点"],["【题干分析】","stem","题干分析"],["【选项逐一分析】","opts","选项逐一分析"],["【解析】","an","解析"],["【易错】","warn","易错"],["【记忆口诀】","memo","记忆口诀"]];
  let rest = e, html = "";
  for(const [tag,cls,label] of segs){
    const idx = rest.indexOf(tag);
    if(idx < 0) continue;
    let after = rest.slice(idx + tag.length);
    const nxt = after.search(/【考点】|【题干分析】|【选项逐一分析】|【解析】|【易错】|【记忆口诀】/);
    const content = (nxt < 0 ? after : after.slice(0, nxt)).trim();
    if(content){
      if(tag === "【选项逐一分析】"){
        const parts = content.split(/(?=[A-D][．.、])/).map(p=>p.trim()).filter(Boolean);
        html += `<div class="explain-card expl-opts"><span class="explain-tag">${label}</span>${parts.map(p=>`<div class="opt-line">${esc(p)}</div>`).join("")}</div>`;
      } else {
        html += `<div class="explain-card expl-${cls}"><span class="explain-tag">${label}</span>${esc(content).replace(/\n/g,"<br>")}</div>`;
      }
    }
    rest = after.slice(nxt < 0 ? after.length : nxt);
  }
  return html;
}

/* ---------- 作答动作 ---------- */
function answerJudge(val){
  const q = curQ();
  if(session.answers[q.id] !== undefined) return;
  record(q.id, val, q.a === val);
}
function toggleOpt(k){
  const q = curQ();
  if(session.answers[q.id] !== undefined) return;
  if(q.type === "single"){ record(q.id, k, q.a === k); return; }
  let sel = session.answers[q.id] || [];
  if(!Array.isArray(sel)) sel = [];
  sel = sel.includes(k) ? sel.filter(x=>x!==k) : sel.concat(k);
  session.answers[q.id] = sel;
  renderQuiz();
}
function submitMulti(){
  const q = curQ();
  if(session.answers[q.id] === undefined) return;
  const sel = session.answers[q.id] || [];
  if(!sel.length){ toast("请至少选择一个选项"); return; }
  record(q.id, sel, sortedKey(sel) === q.a);
}
function clearMulti(){
  const q = curQ();
  if(session.answers[q.id] !== undefined) return;
  session.answers[q.id] = [];
  renderQuiz();
}
function showAnswer(){
  const q = curQ();
  if(session.answers[q.id] !== undefined) return;
  session.answers[q.id] = "shown";
  renderQuiz();
}
function selfJudge(ok){
  const q = curQ();
  if(session.answers[q.id] !== "shown") return;
  record(q.id, ok ? "掌握" : "未掌握", ok);
}
function record(id, selection, correct){
  session.answers[id] = selection;
  session.verdicts[id] = correct;
  const p = progress[id] || {n:0, c:0, last:false};
  p.n = (p.n||0) + 1;
  p.c = (p.c||0) + (correct?1:0);
  p.last = correct;
  progress[id] = p;
  saveProgress();
  renderQuiz();
}
function curQ(){ return QUESTIONS.find(x=>x.id === session.ids[session.idx]); }

/* ---------- 导航 ---------- */
function prevQ(){ if(session.idx>0){ session.idx--; renderQuiz(); } }
function nextQ(){
  if(session.idx < session.ids.length-1){ session.idx++; renderQuiz(); }
  else { renderQuiz(); }
}
function toggleSheet(){
  const el = document.getElementById("sheetPanel");
  el.classList.toggle("hidden");
}
function gotoQ(i){
  if(i >= 0 && i < session.ids.length){ session.idx = i; renderQuiz(); }
}

/* ---------- 答题卡 ---------- */
function sheetHtml(){
  const cells = session.ids.map((id, i)=>{
    const has = session.answers[id] !== undefined;
    const v = session.verdicts[id];
    let cls = "sheet-cell";
    if(i === session.idx) cls += " now";
    if(has) cls += v ? " ok" : " bad";
    return `<button class="${cls}" onclick="gotoQ(${i})">${i+1}</button>`;
  }).join("");
  return `<div class="sheet-head"><h3>答题卡</h3><span style="font-size:12px;color:var(--muted)">绿色=正确，红色=错误，蓝色=当前</span></div>
    <div class="sheet-grid">${cells}</div>`;
}

/* ---------- 完成页 ---------- */
function renderDone(){
  const total = session.ids.length;
  const okN = Object.values(session.verdicts).filter(v=>v===true).length;
  const rate = Math.round(okN/total*100);
  document.getElementById("view").innerHTML = `
    <div class="done-hero">
      <div class="score">${rate}<small>%</small></div>
      <p style="color:var(--muted);margin-top:6px">本轮练习完成</p>
    </div>
    <div class="done-stats">
      <div class="done-stat"><div class="d-num">${total}</div><div class="d-label">总题数</div></div>
      <div class="done-stat"><div class="d-num">${okN}</div><div class="d-label">答对</div></div>
      <div class="done-stat"><div class="d-num">${total-okN}</div><div class="d-label">答错</div></div>
    </div>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="again('${session.mode}')">再刷一轮</button>
      <button class="btn btn-ghost" onclick="exitQuiz()">返回首页</button>
      <button class="btn btn-accent" onclick="goWrong()">去错题本</button>
    </div>`;
}
function again(mode){
  const f = filterState();
  let ids = QUESTIONS.filter(q=>matchFilter(q,f)).map(q=>q.id);
  if(mode === "random") ids = shuffle(ids);
  if(mode === "wrong"){
    const wrongSet = new Set(Object.keys(progress).filter(id=>progress[id].last===false).map(Number));
    ids = ids.filter(id=>wrongSet.has(id));
    if(!ids.length){ toast("错题已全部攻克"); session=null; location.hash="#/home"; return; }
  }
  session = { mode, ids, idx:0, answers:{}, verdicts:{} };
  renderQuiz();
}
function goWrong(){ location.hash = "#/wrong"; }

/* ---------- 错题本 ---------- */
function renderWrong(){
  const wrongIds = Object.keys(progress).filter(id=>progress[id].last===false).map(Number);
  const items = QUESTIONS.filter(q=>wrongIds.includes(q.id));
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">错题本</h1>
    <p class="view-desc">记录最近一次答错的题目，共 ${items.length} 题。重新答对后会自动移出。</p>
    ${items.length ? `<button class="btn btn-accent" style="margin-bottom:14px" onclick="startWrongAll()">全部重刷</button>` : ""}
    <div class="wrong-list">
      ${items.length ? items.map(q=>`
        <div class="wrong-item">
          <div style="flex:0 0 auto">
            <span class="tag type-${q.type}">${TYPE_META[q.type]}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div class="wi-meta"><span class="tag module">${esc(q.module)}</span></div>
            <div class="wi-q">${esc(q.q)}</div>
            <div class="wi-go"><button class="btn btn-ghost" onclick="singleReview(${q.id})">查看本题</button></div>
          </div>
        </div>`).join("") : `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>
          <div>错题本是空的，继续刷题巩固吧</div>
        </div>`}
    </div>`;
}
function startWrongAll(){
  const wrongSet = new Set(Object.keys(progress).filter(id=>progress[id].last===false).map(Number));
  const ids = QUESTIONS.filter(q=>wrongSet.has(q.id)).map(q=>q.id);
  if(!ids.length){ toast("错题本是空的"); return; }
  session = { mode:"wrong", ids, idx:0, answers:{}, verdicts:{} };
  location.hash = "#/quiz";
}
function singleReview(id){
  session = { mode:"single", ids:[id], idx:0, answers:{}, verdicts:{} };
  location.hash = "#/quiz";
}

/* ================= 新增功能：收藏 / 模拟考试 / 掌握度 / 成绩历史 / 夜间模式 / 键盘 ================= */

const FAV_KEY = "qc_fav_v1";
const EXAM_KEY = "qc_exam_v1";
const THEME_KEY = "qc_theme_v1";
let favSet = loadFav();
function loadFav(){ try{ return new Set(JSON.parse(localStorage.getItem(FAV_KEY))||[]); }catch(e){ return new Set(); } }
function saveFav(){ try{ localStorage.setItem(FAV_KEY, JSON.stringify([...favSet])); }catch(e){} }
function isFav(id){ return favSet.has(id); }
function toggleFav(id){
  if(favSet.has(id)) favSet.delete(id); else favSet.add(id);
  saveFav();
  const el = document.getElementById("starBtn");
  if(el) el.classList.toggle("on", favSet.has(id));
  toast(favSet.has(id) ? "已收藏本题" : "已取消收藏");
}

let examHist = loadExams();
function loadExams(){ try{ return JSON.parse(localStorage.getItem(EXAM_KEY))||[]; }catch(e){ return []; } }
function saveExams(){ try{ localStorage.setItem(EXAM_KEY, JSON.stringify(examHist)); }catch(e){} }
function addExam(rec){ examHist.unshift(rec); if(examHist.length>20) examHist.length=20; saveExams(); }

/* 每周一练记录 */
const WEEK_KEY = "qc_week_v1";
function weekId(){ const d=new Date(); const start=new Date(d.getFullYear(),0,1); const wk=Math.ceil((((d-start)/86400000)+start.getDay()+1)/7); return d.getFullYear()+"-W"+String(wk).padStart(2,"0"); }
function loadWeek(){ try{ return JSON.parse(localStorage.getItem(WEEK_KEY))||{}; }catch(e){ return {}; } }
let weekRec = loadWeek();
function saveWeek(){ try{ localStorage.setItem(WEEK_KEY, JSON.stringify(weekRec)); }catch(e){} }
function weekStatusText(){
  if(weekRec && weekRec.week === weekId()) return "本周已练 "+weekRec.rate+" 分";
  return "本周未练 · 精选20题";
}

/* 夜间模式 */
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved === "dark" || (saved === null && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)){
    document.body.classList.add("dark");
  }
  renderThemeIcon();
}
function toggleTheme(){
  document.body.classList.toggle("dark");
  try{ localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light"); }catch(e){}
  renderThemeIcon();
}
function renderThemeIcon(){
  const el = document.getElementById("themeIcon");
  if(!el) return;
  const dark = document.body.classList.contains("dark");
  el.innerHTML = dark
    ? '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
}

/* 键盘翻题 */
document.addEventListener("keydown", function(e){
  if(location.hash.startsWith("#/quiz") && session){
    if(e.key === "ArrowLeft"){ prevQ(); }
    else if(e.key === "ArrowRight"){ nextQ(); }
  }
});

/* ---------- 模拟考试 ---------- */
function startExam(){
  const f = filterState();
  const pool = QUESTIONS.filter(q=>matchFilter(q,f));
  const judge = shuffle(pool.filter(q=>q.type==="judge")).slice(0,25);
  const single = shuffle(pool.filter(q=>q.type==="single")).slice(0,50);
  const ids = shuffle(judge.concat(single)).map(q=>q.id);
  if(ids.length < 10){ toast("当前筛选下题目太少，请扩大筛选范围"); return; }
  session = { mode:"exam", ids, idx:0, answers:{}, verdicts:{}, timeLeft: 45*60, timeMax:45*60, submitted:false };
  location.hash = "#/quiz";
}
function startLinkao(){
  const f = filterState();
  const pool = QUESTIONS.filter(q=>matchFilter(q,f));
  const judge = shuffle(pool.filter(q=>q.type==="judge")).slice(0,40);
  const single = shuffle(pool.filter(q=>q.type==="single")).slice(0,60);
  const ids = shuffle(judge.concat(single)).map(q=>q.id);
  if(ids.length < 10){ toast("当前筛选下题目太少，请扩大筛选范围"); return; }
  session = { mode:"linkao", ids, idx:0, answers:{}, verdicts:{}, timeLeft: 90*60, timeMax:90*60, submitted:false };
  location.hash = "#/quiz";
}
function startWeekly(){
  const f = filterState();
  const pool = QUESTIONS.filter(q=>matchFilter(q,f));
  const single = shuffle(pool.filter(q=>q.type==="single")).slice(0,10);
  const judge = shuffle(pool.filter(q=>q.type==="judge")).slice(0,10);
  const ids = shuffle(single.concat(judge)).map(q=>q.id);
  if(ids.length < 5){ toast("当前筛选下题目太少，请扩大筛选范围"); return; }
  session = { mode:"weekly", ids, idx:0, answers:{}, verdicts:{}, timeLeft: 60*60, timeMax:60*60, submitted:false };
  location.hash = "#/quiz";
}
let examTimer = null;
function startExamTimer(){
  stopExamTimer();
  examTimer = setInterval(function(){
    if(!session || session.mode !== "exam" || session.submitted){ stopExamTimer(); return; }
    session.timeLeft--;
    const el = document.getElementById("examTimer");
    if(el) el.textContent = fmtTime(session.timeLeft);
    if(session.timeLeft <= 0){ submitExam(); }
  }, 1000);
}
function stopExamTimer(){ if(examTimer){ clearInterval(examTimer); examTimer = null; } }
function fmtTime(s){
  const m = Math.floor(s/60), sec = s%60;
  return (m<10?"0":"") + m + ":" + (sec<10?"0":"") + sec;
}
function examAnswer(k){
  const q = curQ();
  if(session.answers[q.id] !== undefined || session.submitted) return;
  if(q.type === "single" || q.type === "judge"){
    session.answers[q.id] = k;
    if(session.idx < session.ids.length-1){ session.idx++; }
    else { submitExam(); return; }
    renderExamQ();
  } else {
    let sel = session.answers[q.id] || [];
    sel = Array.isArray(sel) ? sel : [];
    sel = sel.includes(k) ? sel.filter(x=>x!==k) : sel.concat(k);
    session.answers[q.id] = sel;
    renderExamQ();
  }
}
function renderExamQ(){
  if(!session || session.submitted){ return; }
  const total = session.ids.length;
  const answered = Object.keys(session.answers).length;
  const q = curQ();
  let body = "";
  if(q.type === "judge"){
    body = `<div class="judge-row">
      <button class="judge-btn${session.answers[q.id]==="√"?" correct":""}" onclick="examAnswer('√')">√　正确</button>
      <button class="judge-btn${session.answers[q.id]==="×"?" correct":""}" onclick="examAnswer('×')">×　错误</button></div>`;
  } else {
    body = `<div class="opts">` + q.opts.map(op=>{
      const sel = session.answers[q.id] || [];
      const selArr = Array.isArray(sel)?sel:[];
      const isSel = selArr.includes(op[0]);
      let cls = "opt" + (isSel ? " selected" : "");
      return `<button class="${cls}" onclick="examAnswer('${op[0]}')"><span class="opt-key">${op[0]}</span><span>${esc(op[1])}</span></button>`;
    }).join("") + `</div>`;
  }
  document.getElementById("view").innerHTML = `
    <div class="quiz-head">
      <span class="exam-timer${session.timeLeft<=300?" warn":""}" id="examTimer">${fmtTime(session.timeLeft)}</span>
      <div class="quiz-progress"><i style="width:${Math.round(answered/total*100)}%"></i></div>
      <span class="quiz-count">${answered} / ${total}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="tag type-${q.type}">${TYPE_META[q.type]}</span>
      <span class="tag module">${esc(q.module)}</span>
    </div>
    <div class="q-body">
      <div class="q-title-row"><div class="q-title">${q.type==="case"&&q.title?`<span class="q-case-title">${esc(q.title)}</span>`:""}<span class="q-no">${session.idx+1}.</span>${esc(q.q)}</div></div>
      ${body}
      <div class="quiz-nav">
        <button class="btn btn-ghost" onclick="prevQ()" ${session.idx===0?"disabled":""}>上一题</button>
        <button class="btn btn-ghost" onclick="toggleSheet()">答题卡</button>
        <span class="spacer"></span>
        <button class="btn btn-accent" onclick="submitExam()">交卷</button>
        <button class="btn btn-ghost" onclick="exitQuiz()">退出</button>
      </div>
    </div>
    <div class="sheet-wrap hidden" id="sheetPanel">${sheetHtml()}</div>`;
  startExamTimer();
}
function submitExam(){
  if(!session || session.submitted) return;
  session.submitted = true;
  stopExamTimer();
  const total = session.ids.length;
  const used = (session.timeMax||45*60) - (session.timeLeft||0);
  const detail = session.ids.map(id=>{
    const q = QUESTIONS.find(x=>x.id===id);
    const sel = session.answers[id];
    let right = false;
    if(q.type === "judge") right = (q.a === sel);
    else if(q.type === "single") right = (q.a === sel);
    else if(q.type === "multi") right = (Array.isArray(sel) && sel.slice().sort().join("") === q.a);
    const p = progress[id] || {n:0,c:0,last:false};
    p.n = (p.n||0)+1; p.c = (p.c||0)+(right?1:0); p.last = right;
    progress[id] = p;
    return {q, sel, right};
  });
  saveProgress();
  const okN = detail.filter(d=>d.right).length;
  const rate = Math.round(okN/total*100);
  const kindMap = {exam:"模拟考试", linkao:"全省联考", weekly:"每周一练"};
  const kindName = kindMap[session.mode]||"模拟考试";
  addExam({time:new Date().toLocaleString("zh-CN",{hour12:false}), total, okN, rate, used, kind:kindName});
  if(session.mode === "weekly"){
    weekRec = {week: weekId(), rate, okN, total, time:new Date().toLocaleString("zh-CN",{hour12:false})};
    saveWeek();
  }
  const wrongList = detail.filter(d=>!d.right);
  document.getElementById("view").innerHTML = `
    <div class="done-hero">
      <div class="score">${rate}<small> 分</small></div>
      <p style="color:var(--muted);margin-top:6px">${kindName}完成 · 用时 ${fmtTime(used)}</p>
    </div>
    <div class="done-stats">
      <div class="done-stat"><div class="d-num">${total}</div><div class="d-label">总题数</div></div>
      <div class="done-stat"><div class="d-num">${okN}</div><div class="d-label">答对</div></div>
      <div class="done-stat"><div class="d-num">${total-okN}</div><div class="d-label">答错</div></div>
    </div>
    ${wrongList.length ? `<div class="card" style="margin-top:16px">
      <div class="filter-title">本次错题（${wrongList.length}）</div>
      <div class="wrong-list">${wrongList.slice(0,10).map(x=>`
        <div class="wrong-item">
          <div style="flex:0 0 auto"><span class="tag type-${x.q.type}">${TYPE_META[x.q.type]}</span></div>
          <div style="flex:1;min-width:0">
            <div class="wi-q">${esc(x.q.q)}</div>
            <div class="fb-explain" style="margin-top:6px">正确答案：${esc(x.q.a)}</div>
          </div>
        </div>`).join("")}
        ${wrongList.length>10?`<div style="text-align:center;font-size:13px;color:var(--muted);padding:6px">其余 ${wrongList.length-10} 题可在错题本查看</div>`:""}
      </div></div>` : ""}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="startExam()">再考一次</button>
      <button class="btn btn-ghost" onclick="exitQuiz()">返回首页</button>
      <button class="btn btn-accent" onclick="goWrong()">去错题本</button>
    </div>`;
}

/* ---------- 收藏夹视图 ---------- */
function renderFav(){
  const favIds = [...favSet].map(Number);
  const items = QUESTIONS.filter(q=>favIds.includes(q.id));
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">收藏夹</h1>
    <p class="view-desc">共收藏 ${items.length} 题。刷题页题目旁点五角星即可收藏/取消。</p>
    ${items.length ? `<button class="btn btn-accent" style="margin-bottom:14px" onclick="startFavAll()">全部重刷</button>` : ""}
    <div class="wrong-list">
      ${items.length ? items.map(q=>`
        <div class="wrong-item">
          <div style="flex:0 0 auto"><span class="tag type-${q.type}">${TYPE_META[q.type]}</span></div>
          <div style="flex:1;min-width:0">
            <div class="wi-meta"><span class="tag module">${esc(q.module)}</span></div>
            <div class="wi-q">${esc(q.q)}</div>
            <div class="wi-go">
              <button class="btn btn-ghost" onclick="singleReview(${q.id})">查看本题</button>
              <button class="wi-star on" onclick="toggleFavList(${q.id})" title="取消收藏"><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg></button>
            </div>
          </div>
        </div>`).join("") : `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
          <div>收藏夹是空的，刷题时点题目旁的五角星收藏</div>
        </div>`}
    </div>`;
}
function toggleFavList(id){ toggleFav(id); renderFav(); }
function startFavAll(){
  const favIds = [...favSet].map(Number);
  const ids = QUESTIONS.filter(q=>favIds.includes(q.id)).map(q=>q.id);
  if(!ids.length){ toast("收藏夹是空的"); return; }
  session = { mode:"fav", ids, idx:0, answers:{}, verdicts:{} };
  location.hash = "#/quiz";
}

/* ---------- 模块掌握度（首页） ---------- */
function masteryHtml(){
  const modNames = Object.keys(MOD_COUNTS);
  return `<div class="mastery">` + modNames.map(m=>{
    const qs = QUESTIONS.filter(q=>q.module===m);
    const aIds = qs.filter(q=>progress[q.id]);
    if(!aIds.length){ return `<div class="mastery-row"><span class="mastery-name">${esc(m)}</span><div class="mastery-bar"><i style="width:0%"></i></div><span class="mastery-val">未刷</span></div>`; }
    let ok=0, n=0;
    aIds.forEach(q=>{ ok += progress[q.id].c||0; n += progress[q.id].n||0; });
    const rate = Math.round(ok/n*100);
    const cls = rate<60?"low":(rate<80?"mid":"");
    return `<div class="mastery-row"><span class="mastery-name">${esc(m)}</span><div class="mastery-bar"><i class="${cls}" style="width:${rate}%"></i></div><span class="mastery-val">${rate}%</span></div>`;
  }).join("") + `</div>`;
}

/* ---------- 考试记录（首页） ---------- */
function historyHtml(){
  if(!examHist.length){ return `<div class="hist-empty">暂无考试记录，来一场模拟考试吧</div>`; }
  return `<div class="hist-list">` + examHist.slice(0,5).map(h=>`
    <div class="hist-item">
      <div class="hist-score">${h.rate}<small> 分</small></div>
      <div class="hist-info">
        <div class="hist-meta">${h.total} 题 · 答对 ${h.okN} · 用时 ${fmtTime(h.used||0)}</div>
        <div class="hist-time">${esc(h.time)}</div>
      </div>
      <div class="hist-rate">${h.rate}%</div>
    </div>`).join("") + `</div>`;
}
function clearHistory(){
  examHist = []; saveExams(); renderHome();
}

/* ---------- 首页（新版：Hero + 掌握度 + 考试记录 + 五种模式） ---------- */
function renderHome(){
  const st = stats();
  const f = filterState();
  const nFav = favSet.size;
  const nWrong = st.wrong;
  const typeChips = Object.keys(TYPE_COUNTS).map(t =>
    `<button class="chip${f.types.includes(t)?" on":""}" data-type="${t}" onclick="toggleFilterType('${t}')">${TYPE_META[t]}（${TYPE_COUNTS[t]}题）</button>`
  ).join("");
  const modChips = Object.keys(MOD_COUNTS).map(m =>
    `<button class="chip${f.mods.includes(m)?" on":""}" data-mod="${esc(m)}" onclick="toggleFilterMod('${esc(m)}')">${m}（${MOD_COUNTS[m]}题）</button>`
  ).join("");
  const totalChap = Object.keys(CHAP_MOD).length;
  const chapEntry = `<button class="chap-entry" onclick="openChapterPicker()">
      <div><div class="chap-entry-name">进入章节选择</div><div class="chap-entry-sub">${f.chapters.length===totalChap ? "默认全选，共36章" : "已选 "+f.chapters.length+" / 36 章"}</div></div>
      <div class="chap-entry-arrow">→</div>
    </button>${f.chapters.length===totalChap ? "" : `<div class="chips" style="margin-top:10px">${f.chapters.map(c=>`<button class="chip on" data-chapter="${esc(c)}" onclick="toggleFilterChapter('${esc(c)}')">${esc(c)}（${MOD_CHAPTERS[CHAP_MOD[c]][c]}题）</button>`).join("")}</div>`}`;
  document.getElementById("view").innerHTML = `
    <div class="hero">
      <div class="h-title">匠考通关宝</div>
      <div class="h-sub">湖北省技能高考 · 汽车维修类 · 8231 题题库</div>
      <div class="h-stats">
        <div class="h-stat"><div class="h-num">${st.answered}<small> / 8231</small></div><div class="h-label">已作答</div></div>
        <div class="h-stat"><div class="h-num">${st.rate}<small>%</small></div><div class="h-label">总正确率</div></div>
        <div class="h-stat"><div class="h-num">${nFav}</div><div class="h-label">收藏题目</div></div>
        <div class="h-stat"><div class="h-num">${nWrong}</div><div class="h-label">待攻克错题</div></div>
      </div>
    </div>

    <div class="card">
      <div class="filter-block">
        <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v4M15 2v4M4 8h16M6 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg>题型筛选（默认全选）</div>
        <div class="chips">${typeChips}</div>
      </div>
      <div class="filter-block">
        <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>知识模块筛选（默认全选）</div>
        <div class="chips">${modChips}</div>
      </div>
      <div class="filter-block">
        <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v4M15 2v4M4 8h16M6 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg>章节小类筛选（默认全选，共36章）</div>
        ${chapEntry}
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="resetFilter()">重置筛选</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>快速练习</div>
      <div class="quick-row">
        <button class="quick-btn" onclick="startQuiz('order')">
          <span class="qk-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>顺序刷题</span>
          <span class="qk-sub">${filteredCount(f)} 题</span>
        </button>
        <button class="quick-btn" onclick="startQuiz('random')">
          <span class="qk-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h4l10 12h4"/><path d="M17 6h4v4"/><path d="M3 18h4l2-2.4"/></svg>随机刷题</span>
          <span class="qk-sub">${filteredCount(f)} 题</span>
        </button>
        <button class="quick-btn" onclick="startQuiz('wrong')">
          <span class="qk-name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>错题重刷</span>
          <span class="qk-sub">${nWrong} 题</span>
        </button>
        <button class="quick-btn" onclick="startExam()">
          <span class="qk-name" style="color:var(--accent)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>模拟考试</span>
          <span class="qk-sub">45分钟组卷</span>
        </button>
        <button class="quick-btn" onclick="startLinkao()">
          <span class="qk-name" style="color:var(--m2)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M10 21V7M15 21V4M20 21V9"/></svg>全省联考</span>
          <span class="qk-sub">90分钟 · 100题</span>
        </button>
        <button class="quick-btn" onclick="startWeekly()">
          <span class="qk-name" style="color:var(--m3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M12 12l1.4 1.4L16 10.8"/></svg>每周一练</span>
          <span class="qk-sub">${weekStatusText()}</span>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6V2M4.5 9.5 1.8 7.7M12 22v-4M20.5 9.5 22.2 7.7M6 16a6 6 0 1 1 12 0"/></svg>全部功能</div>
      <div class="icon-grid">
        <button class="icon-item" onclick="goReport()">
          <span class="icon-box bl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
          <span>智能批改</span>
        </button>
        <button class="icon-item" onclick="startSmart()">
          <span class="icon-box or"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span>
          <span>智能组题<span class="badge-mini">练习</span></span>
        </button>
        <button class="icon-item" onclick="toast('面试AI需要云端AI服务，离线网页版暂不支持；可先用搜一搜题复习')">
          <span class="icon-box gy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M8 9l3 2.5L8 14"/><path d="M13 14h3"/></svg></span>
          <span>面试AI</span>
        </button>
        <button class="icon-item" onclick="goExams()">
          <span class="icon-box cy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
          <span>考试记录</span>
        </button>
        <button class="icon-item" onclick="goWrong()">
          <span class="icon-box gr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg></span>
          <span>错题练习</span>
        </button>
        <button class="icon-item" onclick="goFav()">
          <span class="icon-box pu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg></span>
          <span>我的收藏</span>
        </button>
        <button class="icon-item" onclick="goSearch()">
          <span class="icon-box te"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
          <span>搜一搜题</span>
        </button>
        <button class="icon-item" onclick="toast('拍照搜题需要云端OCR服务，离线网页版暂不支持；可用搜一搜题代替')">
          <span class="icon-box rd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h2l2-3h8l2 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
          <span>拍照搜题</span>
        </button>
      </div>
    </div>

    <div class="card card-hover">
      <div class="filter-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6"/></svg>模块掌握度</div>
      ${masteryHtml()}
    </div>

    <div class="card card-hover">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <div class="filter-title" style="margin-bottom:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>考试记录</div>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" style="min-height:32px;padding:4px 12px;font-size:12px" onclick="clearHistory()">清空记录</button>
      </div>
      ${historyHtml()}
    </div>`;
}

/* ---------- 搜一搜题 ---------- */
function goSearch(){ location.hash = "#/search"; }
function renderSearch(){
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">搜一搜题</h1>
    <p class="view-desc">输入关键词（题目、选项、解析、模块均可），从 8231 题中查找。</p>
    <div class="search-box">
      <input class="search-input" id="searchKw" placeholder="如：活塞、正时、电路、制动…" oninput="doSearch()">
    </div>
    <div id="searchResult"></div>`;
  const kw = document.getElementById("searchKw");
  if(kw) kw.focus();
}
function doSearch(){
  const box = document.getElementById("searchKw");
  const res = document.getElementById("searchResult");
  if(!box || !res) return;
  const raw = box.value.trim();
  if(!raw){ res.innerHTML = `<div class="empty" style="padding:24px"><div>输入关键词开始搜索</div></div>`; return; }
  const kws = raw.split(/\s+/).map(k=>k.toLowerCase());
  const hits = QUESTIONS.filter(q=>{
    const text = (q.q + " " + (Array.isArray(q.opts)?q.opts.map(o=>o[0]+"."+o[1]).join(" "):"") + " " + (q.e||"") + " " + q.module + " " + TYPE_META[q.type]).toLowerCase();
    return kws.every(k=>text.includes(k));
  });
  if(!hits.length){ res.innerHTML = `<div class="empty" style="padding:24px"><div>没有找到相关题目，换个关键词试试</div></div>`; return; }
  res.innerHTML = `<div style="font-size:13px;color:var(--muted);margin-bottom:12px">共找到 ${hits.length} 题</div>` + hits.slice(0,50).map(q=>{
    const p = progress[q.id];
    const stateTxt = p ? (p.last ? "已答对" : "最近答错") : "未作答";
    return `<div class="search-result">
      <div style="flex:0 0 auto"><span class="tag type-${q.type}">${TYPE_META[q.type]}</span></div>
      <div style="flex:1;min-width:0">
        <div class="sr-q">${esc(q.q)}</div>
        <div class="sr-ans">${esc(q.module)} · ${stateTxt} · 答案 ${esc(q.a)}</div>
        <div style="margin-top:8px"><button class="btn btn-ghost" style="min-height:32px;padding:4px 14px;font-size:13px" onclick="singleReview(${q.id})">查看本题</button></div>
      </div>
    </div>`;
  }).join("") + (hits.length>50?`<div style="text-align:center;font-size:13px;color:var(--muted);padding:6px">仅显示前 50 条，请用更精确的关键词</div>`:"");
}

/* ---------- 智能组题（薄弱模块优先 + 错题优先） ---------- */
function startSmart(){
  const f = filterState();
  const pool = QUESTIONS.filter(q=>matchFilter(q,f));
  if(pool.length < 5){ toast("当前筛选下题目太少，请扩大筛选范围"); return; }
  const modRate = {};
  Object.keys(MOD_COUNTS).forEach(m=>{
    const qs = QUESTIONS.filter(q=>q.module===m);
    const aIds = qs.filter(q=>progress[q.id]);
    if(!aIds.length){ modRate[m] = 50; return; }
    let ok=0,n=0; aIds.forEach(q=>{ ok += progress[q.id].c||0; n += progress[q.id].n||0; });
    modRate[m] = n ? Math.round(ok/n*100) : 50;
  });
  const wrongPool = pool.filter(q=>progress[q.id] && progress[q.id].last === false);
  const pick = shuffle(wrongPool).slice(0,10);
  const rest = shuffle(pool.filter(q=>!pick.includes(q))).sort((a,b)=>(modRate[a.module]||50)-(modRate[b.module]||50));
  const need = 30 - pick.length;
  const ids = shuffle(pick.concat(rest.slice(0, need)).map(q=>q.id));
  if(ids.length < 5){ toast("题目不足，请调整筛选"); return; }
  session = { mode:"smart", ids, idx:0, answers:{}, verdicts:{} };
  toast("已按薄弱模块智能组卷 " + ids.length + " 题");
  location.hash = "#/quiz";
}

/* ---------- 智能批改（学情诊断报告） ---------- */
function goReport(){ location.hash = "#/report"; }
function renderReport(){
  const st = stats();
  const mods = Object.keys(MOD_COUNTS).map(m=>{
    const qs = QUESTIONS.filter(q=>q.module===m);
    const aIds = qs.filter(q=>progress[q.id]);
    if(!aIds.length){ return {m, rate:null, n:0, ans:0}; }
    let ok=0,n=0; aIds.forEach(q=>{ ok += progress[q.id].c||0; n += progress[q.id].n||0; });
    return {m, rate: Math.round(ok/n*100), n, ans:aIds.length};
  });
  const errRank = Object.keys(progress).map(id=>{
    const p = progress[id]; const q = QUESTIONS.find(x=>x.id===Number(id));
    return q ? {q, err:(p.n||0)-(p.c||0)} : null;
  }).filter(Boolean).sort((a,b)=>b.err-a.err).slice(0,5).filter(x=>x.err>0);
  const weak = mods.filter(x=>x.rate!==null && x.rate<60);
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">智能批改 · 学情报告</h1>
    <p class="view-desc">基于你的全部作答记录，自动诊断薄弱环节。</p>
    <div class="report-head">
      <div class="rh-score">${st.rate}<small>%</small></div>
      <div class="rh-sub">累计作答 ${st.totalTry} 次 · 覆盖 ${st.answered}/${QUESTIONS.length} 题 · 错题 ${st.wrong} 题</div>
    </div>
    <div class="card">
      <div class="filter-title">各模块正确率</div>
      <div class="mastery">${mods.map(x=>{
        if(x.rate===null){ return `<div class="mastery-row"><span class="mastery-name">${esc(x.m)}</span><div class="mastery-bar"><i style="width:0%"></i></div><span class="mastery-val">未刷</span></div>`; }
        const cls = x.rate<60?"low":(x.rate<80?"mid":"");
        return `<div class="mastery-row"><span class="mastery-name">${esc(x.m)}</span><div class="mastery-bar"><i class="${cls}" style="width:${x.rate}%"></i></div><span class="mastery-val">${x.rate}%</span></div>`;
      }).join("")}</div>
    </div>
    ${weak.length?`<div class="tip-box">建议：优先巩固薄弱模块 —— ${weak.map(x=>esc(x.m)).join("、")}，用“错题重刷”或“智能组题”针对性练习。</div>`:`<div class="tip-box">各已刷模块正确率均在 60% 以上，保持节奏，继续用“随机刷题”检验。</div>`}
    <div class="card">
      <div class="filter-title">高频错题 Top5</div>
      ${errRank.length?`<div class="wrong-list">${errRank.map(x=>`
        <div class="wrong-item">
          <div style="flex:0 0 auto"><span class="tag type-${x.q.type}">${TYPE_META[x.q.type]}</span></div>
          <div style="flex:1;min-width:0">
            <div class="wi-q">${esc(x.q.q)}</div>
            <div class="wi-go"><button class="btn btn-ghost" onclick="singleReview(${x.q.id})">再练本题</button></div>
          </div>
        </div>`).join("")}</div>`:`<div class="hist-empty">暂无答错记录，继续刷题后这里会显示最需要巩固的题目</div>`}
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
      <button class="btn btn-primary" onclick="startSmart()">智能组题练习</button>
      <button class="btn btn-ghost" onclick="goWrong()">去错题本</button>
    </div>`;
}

/* ---------- 考试记录视图 ---------- */
function goExams(){ location.hash = "#/exams"; }
function renderExams(){
  document.getElementById("view").innerHTML = `
    <h1 class="view-title">考试记录</h1>
    <p class="view-desc">共 ${examHist.length} 次考试记录（最近 20 次）。</p>
    ${examHist.length?`<button class="btn btn-ghost" style="margin-bottom:14px" onclick="clearHistory()">清空全部记录</button>`:""}
    ${examHist.length?`<div class="hist-list">${examHist.map(h=>`
      <div class="hist-item">
        <div class="hist-score">${h.rate}<small> 分</small></div>
        <div class="hist-info">
          <div class="hist-meta">${h.kind?`<span class="tag module">${esc(h.kind)}</span>`:""} ${h.total} 题 · 答对 ${h.okN} · 用时 ${fmtTime(h.used||0)}</div>
          <div class="hist-time">${esc(h.time)}</div>
        </div>
        <div class="hist-rate">${h.rate}%</div>
      </div>`).join("")}</div>`:`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><div>暂无考试记录，来一场模拟考试吧</div></div>`}
    <div style="margin-top:16px"><button class="btn btn-primary" onclick="startExam()">开始模拟考试</button></div>`;
}

/* ===== 动态雨丝 ===== */
(function(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var cv=document.createElement('canvas');
  cv.id='rain';cv.setAttribute('aria-hidden','true');
  document.body.appendChild(cv);
  var ctx=cv.getContext('2d');
  var W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);
  function resize(){W=window.innerWidth;H=window.innerHeight;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
  window.addEventListener('resize',resize);
  resize();
  var LAYERS=[
    {s:10,l:16,w:1,a:.16,sl:10,color:'rgba(94,234,212,.9)'},
    {s:15,l:24,w:1.2,a:.22,sl:8,color:'rgba(129,140,248,.9)'},
    {s:21,l:36,w:1.5,a:.28,sl:6,color:'rgba(240,171,218,.9)'}
  ];
  var total=Math.min(240,Math.round(W*H/6500));
  var per=Math.max(20,Math.round(total/3));
  function make(L){
    return {x:Math.random()*W,y:Math.random()*H,s:L.s*(0.8+Math.random()*0.5),l:L.l*(0.8+Math.random()*0.6),w:L.w,a:L.a*(0.55+Math.random()*0.6)};
  }
  LAYERS.forEach(function(L){L.drops=[];for(var i=0;i<per;i++)L.drops.push(make(L));});
  var wind=0.7,target=0.7;
  setInterval(function(){target=-0.9+Math.random()*1.8;},6000);
  function tick(){
    ctx.clearRect(0,0,W,H);
    wind+=(target-wind)*0.02;
    LAYERS.forEach(function(L){
      ctx.strokeStyle=L.color;
      for(var i=0;i<L.drops.length;i++){
        var d=L.drops[i];
        ctx.globalAlpha=d.a;ctx.lineWidth=d.w;
        ctx.beginPath();
        ctx.moveTo(d.x,d.y);
        ctx.lineTo(d.x+wind*d.s*0.7,d.y+d.l);
        ctx.stroke();
        d.y+=d.s;d.x+=wind*d.s*0.55;
        if(d.y>H+24){d.y=-24-Math.random()*60;d.x=Math.random()*W;}
        if(d.x>W+16)d.x=-16;else if(d.x<-16)d.x=W+16;
      }
    });
    ctx.globalAlpha=1;
    requestAnimationFrame(tick);
  }
  tick();
  document.addEventListener('visibilitychange',function(){cv.style.display=document.hidden?'none':'';});
})();



/* ===== 章节选择页逻辑 ===== */
let pickerSel = [];
function openChapterPicker(){
  pickerSel = Array.from(filterState().chapters);
  renderChapterPicker();
  document.getElementById("chapter-picker").classList.add("show");
}
function closeChapterPicker(){ document.getElementById("chapter-picker").classList.remove("show"); }
function renderChapterPicker(){
  const groups = MODULES.map(m=>{
    const chs = MOD_CHAPTERS[m]||{};
    return `<div class="picker-group-title">${esc(m)}</div><div class="picker-grid">`+
      Object.keys(chs).map(c=>{
        const on = pickerSel.includes(c);
        return `<button class="ch-card${on?" on":""}" onclick="togglePickerChapter('${esc(c)}')">
          <div class="ch-name">${esc(c)}</div>
          <div class="ch-count">${chs[c]} 题</div>
          <div class="ch-check">✓</div>
        </button>`;
      }).join("")+`</div>`;
  }).join("");
  document.getElementById("picker-body").innerHTML = groups;
  const n = pickerSel.length, total = Object.keys(CHAP_MOD).length;
  document.getElementById("picker-selcount").textContent = `已选 ${n}/${total} 章`;
}
function togglePickerChapter(ch){
  const i = pickerSel.indexOf(ch);
  if(i>=0) pickerSel.splice(i,1); else pickerSel.push(ch);
  renderChapterPicker();
}
function pickerAll(){ pickerSel = Object.keys(CHAP_MOD).slice(); renderChapterPicker(); }
function pickerClear(){ pickerSel = []; renderChapterPicker(); }
function applyChapterPicker(){
  closeChapterPicker();
  window._chapSel = pickerSel.length ? pickerSel.slice() : null;
  MODULES.forEach(m=>{
    const chs = Object.keys(MOD_CHAPTERS[m]||{});
    const anyOn = chs.some(c=>pickerSel.includes(c));
    const mel = document.querySelector(`.chip[data-mod="${esc(m)}"]`);
    if(mel) mel.classList.toggle("on", anyOn);
  });
  renderHome();
  const f = filterState();
  toast(f.chapters.length===Object.keys(CHAP_MOD).length ? "已恢复全部章节" : "已选择 "+f.chapters.length+" 个章节，可开始刷题");
}

/* ---------- 初始化 ---------- */
(function(){
  function boot(){
    document.querySelectorAll(".chip").forEach(c=>c.classList.add("on"));
    initTheme();
    route();
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
})();




