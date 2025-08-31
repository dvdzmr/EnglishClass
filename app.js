// minimal router state
const views = {
  picker: document.getElementById('picker'),
  runner: document.getElementById('runner'),
};
const els = {
  grid: document.getElementById('lessons-grid'),
  backToPicker: document.getElementById('backToPicker'),
  lessonTitle: document.getElementById('lessonTitle'),
  stageContainer: document.getElementById('stageContainer'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  stageIndicator: document.getElementById('stageIndicator'),
  diffDock: document.getElementById('difficultyDock'),
};
const tpl = {
  reading: document.getElementById('tpl-reading'),
  dialogue: document.getElementById('tpl-dialogue'),
  watch: document.getElementById('tpl-watch'),
  qanda: document.getElementById('tpl-qanda'),
};

const DIFF_KEY = 'lesson_difficulty';
let lessons = [];         // array of {id:"001", title:"Lesson 1"}
let current = { lessonId: null, stageIndex: 0, stages: [] }; // stages populated per lesson

// naive markdown fallback if CDN blocked
function mdToHtml(md) {
  if (window.marked) return marked.parse(md);
  // fallback: headers + bold + italics + paragraphs
  return md
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

// utility: fetch text if exists
async function fetchMaybe(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// parse [easy]/[medium]/[hard] sections from md
function extractByDifficulty(md, diff) {
  const lines = md.split(/\r?\n/);
  let cur = null, buckets = { easy: [], medium: [], hard: [] };
  for (const line of lines) {
    const m = line.trim().match(/^\[(easy|medium|hard)\]\s*$/i);
    if (m) { cur = m[1].toLowerCase(); continue; }
    if (cur) buckets[cur].push(line);
  }
  const body = (buckets[diff] && buckets[diff].join('\n').trim()) || '';
  return body || `*No content for **${diff}** found.*`;
}

// build visible views
function show(viewName) {
  for (const v of Object.values(views)) v.classList.add('hidden');
  views[viewName].classList.remove('hidden');
}

// difficulty dock persistence
function initDifficultyDock() {
  const saved = localStorage.getItem(DIFF_KEY) || 'easy';
  [...els.diffDock.querySelectorAll('input[name=diff]')].forEach(r => {
    r.checked = (r.value === saved);
    r.addEventListener('change', () => {
      localStorage.setItem(DIFF_KEY, r.value);
      // re-render if we are on a reading stage
      renderStage();
    });
  });
}

// stage factory
function makeStagesForLesson(lessonId, meta = {}) {
  const lessonPath = `${lessonId}`;
  // order: teacher reading, pupil reading, dialogue image, watch (optional), qanda
  return [
    { key: 'teacher', type: 'reading', title: 'Teacher Reading', path: `${lessonPath}/dialogue_teacher.md` },
    { key: 'pupil', type: 'reading', title: 'Pupil Reading', path: `${lessonPath}/dialogue_pupil.md` },
    { key: 'dialogue', type: 'dialogue', img: `${lessonPath}/dialogue_image.png` },
    { key: 'watch', type: 'watch', path: `${lessonPath}/watch_together.txt`, optional: true },
    { key: 'qanda', type: 'qanda', pathMd: `qanda.md`, img: `qanda.png` },
  ];
}

// render helpers
async function renderStage() {
  const st = current.stages[current.stageIndex];
  if (!st) return;
  els.stageContainer.innerHTML = ''; // clear
  // difficulty dock visibility: hidden on dialogue stage only
  els.diffDock.classList.toggle('difficulty-hidden', st.type === 'dialogue');

  if (st.type === 'reading') {
    const node = tpl.reading.content.cloneNode(true);
    node.querySelector('.reading-title').textContent = st.title;
    const raw = await fetchMaybe(st.path) || `*Missing file:* \`${st.path}\``;
    const diff = (localStorage.getItem(DIFF_KEY) || 'easy').toLowerCase();
    const picked = extractByDifficulty(raw, diff);
    node.querySelector('.md').innerHTML = mdToHtml(picked);
    els.stageContainer.append(node);
  }

  else if (st.type === 'dialogue') {
    const node = tpl.dialogue.content.cloneNode(true);
    const img = node.querySelector('.dialogue-bg');
    img.src = st.img;
    img.onerror = () => { img.alt = 'dialogue_image.png missing'; img.style.objectFit='contain'; img.style.background='#111'; }
    els.stageContainer.append(node);
  }

  else if (st.type === 'watch') {
    // only show if file exists and has url
    const txt = (await fetchMaybe(st.path) || '').trim();
    if (!txt) { goNext(); return; }
    const node = tpl.watch.content.cloneNode(true);
    const url = normalizeYouTubeUrl(txt);
    node.querySelector('#ytFrame').src = url;
    els.stageContainer.append(node);
  }

  else if (st.type === 'qanda') {
    const node = tpl.qanda.content.cloneNode(true);
    const md = await fetchMaybe(st.pathMd) || '*Create a `qanda.md` in the project root.*';
    node.querySelector('.qanda-md').innerHTML = mdToHtml(md);
    const img = node.querySelector('.qanda-img');
    img.src = st.img; img.onerror = () => { img.style.display='none'; };
    const btn = node.querySelector('.confetti-btn');
    btn.addEventListener('click', fireConfetti);
    els.stageContainer.append(node);
  }

  // nav state and indicator
  const total = current.stages.length;
  els.prevBtn.disabled = current.stageIndex === 0;
  els.nextBtn.disabled = current.stageIndex >= total - 1;
  els.stageIndicator.textContent = `Stage ${current.stageIndex + 1} / ${total}`;
  // update hash
  location.hash = `#lesson=${current.lessonId}&stage=${current.stageIndex}`;
}

function normalizeYouTubeUrl(input) {
  // accepts full url, shorts, youtu.be, or plain id
  let url = input.trim();
  try {
    let u = new URL(url, location.href);
    if (/youtu\.be$/.test(u.hostname)) {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}`;
    }
    if (/youtube\.com$/.test(u.hostname)) {
      // shorts -> watch
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return `https://www.youtube.com/embed/${id}`;
      }
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      // already /embed
      if (u.pathname.startsWith('/embed/')) return u.href;
    }
  } catch { /* maybe it's a bare id */ }
  // treat as video id
  return `https://www.youtube.com/embed/${url}`;
}

function fireConfetti() {
  if (window.confetti) {
    const end = Date.now() + 800;
    (function frame(){
      confetti({particleCount: 60, spread: 60, startVelocity: 38, ticks: 120, origin:{x: Math.random(), y: Math.random()*0.3}});
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  } else {
    // css pulse fallback
    document.body.animate([{filter:'brightness(1)'},{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:500});
  }
}

// nav
function goPrev(){ if (current.stageIndex>0){ current.stageIndex--; renderStage(); } }
function goNext(){ if (current.stageIndex<current.stages.length-1){ current.stageIndex++; renderStage(); } }

// load lessons manifest
async function loadLessons() {
  // lessons.json = ["001","002",...]
  const raw = await fetchMaybe('lessons.json');
  if (!raw) {
    lessons = [];
    els.grid.innerHTML = `<div class="card"><h3>No lessons found</h3><p>Add a <code>lessons.json</code> like <code>["001","002"]</code> and folders.</p></div>`;
    return;
  }
  const ids = JSON.parse(raw);
  lessons = ids.map(id => ({ id, title: `Lesson ${Number(id)}` }));
  renderPicker();
}

function renderPicker() {
  els.grid.innerHTML = '';
  for (const l of lessons) {
    const card = document.createElement('div');
    card.className = 'card';
    const nice = `${l.id} → ${l.title}`;
    card.innerHTML = `
      <div class="muted">Folder: <code>${l.id}</code></div>
      <h3>${l.title}</h3>
      <button data-id="${l.id}">Start</button>
    `;
    card.querySelector('button').addEventListener('click', ()=> startLesson(l.id));
    els.grid.append(card);
  }
}

async function startLesson(lessonId) {
  current.lessonId = lessonId;
  current.stageIndex = 0;
  current.stages = makeStagesForLesson(lessonId);
  els.lessonTitle.textContent = `${lessonId} • Lesson ${Number(lessonId)}`;
  show('runner');
  renderStage();
}

function backToPicker() {
  show('picker');
  els.stageContainer.innerHTML = '';
  // clear hash
  history.replaceState(null, '', location.pathname);
}

// hash routing support: #lesson=001&stage=2
function bootFromHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const lesson = h.get('lesson'); const stage = Number(h.get('stage')||0);
  if (lesson) {
    startLesson(lesson).then(()=> { current.stageIndex = Math.max(0, Math.min(stage, current.stages.length-1)); renderStage(); });
  } else {
    show('picker');
  }
}

// keyboard nav
document.addEventListener('keydown', (e)=>{
  if (views.runner.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft') goPrev();
});

els.backToPicker.addEventListener('click', backToPicker);
els.prevBtn.addEventListener('click', goPrev);
els.nextBtn.addEventListener('click', goNext);

// init
initDifficultyDock();
loadLessons().then(bootFromHash);
