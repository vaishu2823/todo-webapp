/* ---- Utilities ---- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

/* ---- Elements ---- */
const taskInput = $('#taskInput');
const addBtn = $('#addBtn');
const taskList = $('#taskList');
const categorySelect = $('#categorySelect');
const filterCategory = $('#filterCategory');
const remainingCountEl = $('#remainingCount');
const totalCountEl = $('#totalCount');
const progressFill = $('#progressFill');
const progressPct = $('#progressPct');
const clearCompletedBtn = $('#clearCompleted');
const darkToggle = $('#darkToggle');

/* ---- Local storage keys ---- */
const STORAGE_KEY = 'creative_todo_v1';
const SETTINGS_KEY = 'creative_todo_settings_v1';

/* ---- App State ---- */
let state = {
  tasks: [], // { id, text, completed, category, createdAt }
  settings: { dark: false },
  filter: 'All'
};

/* ---- Particle background setup ---- */
(function initParticles(){
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = canvas.width = innerWidth;
  let h = canvas.height = innerHeight;
  window.addEventListener('resize',()=>{ w = canvas.width = innerWidth; h = canvas.height = innerHeight; });

  const particles = Array.from({length:60}, () => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: 2 + Math.random()*6,
    vx: -0.3 + Math.random()*0.6,
    vy: -0.2 + Math.random()*0.4,
    alpha: 0.02 + Math.random()*0.12
  }));

  function tick(){
    ctx.clearRect(0,0,w,h);
    for (let p of particles){
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = w+20;
      if (p.x > w+20) p.x = -20;
      if (p.y < -20) p.y = h+20;
      if (p.y > h+20) p.y = -20;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---- Load & Save ---- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const sraw = localStorage.getItem(SETTINGS_KEY);
    if (raw) state.tasks = JSON.parse(raw);
    if (sraw) state.settings = JSON.parse(sraw);
  } catch(e) { console.error('Load parse error', e); }
  applySettings();
  render();
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

/* ---- Apply settings (dark mode) ---- */
function applySettings(){
  document.documentElement.setAttribute('data-dark', state.settings.dark ? 'true' : 'false');
  darkToggle.checked = !!state.settings.dark;
}
darkToggle.addEventListener('change', e => {
  state.settings.dark = e.target.checked;
  applySettings();
  save();
});

/* ---- Render tasks ---- */
function render() {
  taskList.innerHTML = '';
  let items = state.tasks.slice().sort((a,b)=> b.createdAt - a.createdAt);
  if (state.filter === 'Completed') items = items.filter(t => t.completed);
  else if (state.filter !== 'All') items = items.filter(t => t.category === state.filter);

  items.forEach(task => {
    const li = createTaskNode(task);
    taskList.appendChild(li);
    requestAnimationFrame(()=> li.classList.add('enter'));
  });

  updateProgress();
}

/* ---- Create task DOM ---- */
function createTaskNode(task) {
  const li = document.createElement('li');
  li.className = 'task' + (task.completed ? ' completed' : '');
  li.dataset.id = task.id;

  li.innerHTML = `
    <div class="left">
      <button class="check" title="Toggle complete" aria-label="Toggle complete">
        <span class="material-icons">${task.completed ? 'check_circle' : 'radio_button_unchecked'}</span>
      </button>
      <div class="info">
        <div class="title" title="${escapeHtml(task.text)}">${escapeHtml(task.text)}</div>
        <div class="meta">${task.category} • ${new Date(task.createdAt).toLocaleString()}</div>
      </div>
    </div>

    <div class="right">
      <button class="icon-btn edit" title="Edit"><span class="material-icons">edit</span></button>
      <button class="icon-btn delete" title="Delete"><span class="material-icons">delete</span></button>
    </div>
  `;

  // elements
  const checkBtn = li.querySelector('.check');
  const editBtn = li.querySelector('.edit');
  const deleteBtn = li.querySelector('.delete');
  const titleEl = li.querySelector('.title');

  // toggle complete
  checkBtn.addEventListener('click', () => {
    toggleComplete(task.id, /*rerenderNeeded*/ false);
    // animate check
    const icon = checkBtn.querySelector('.material-icons');
    icon.style.transform = 'scale(.85)';
    setTimeout(()=> icon.style.transform = '', 180);
    li.classList.toggle('completed');
    // update icon text after state updated
    icon.textContent = state.tasks.find(t=>t.id===task.id).completed ? 'check_circle' : 'radio_button_unchecked';
    updateProgress();
    save();
  });

  // delete animation then remove
  deleteBtn.addEventListener('click', () => {
    li.classList.add('removing');
    setTimeout(()=> {
      deleteTask(task.id);
    }, 280);
  });

  // edit
  function enableEdit(){
    const info = li.querySelector('.info');
    const titleEl = info.querySelector('.title');
    const input = document.createElement('input');
    input.className = 'edit-input';
    input.value = task.text;
    info.replaceChild(input, titleEl);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    function commit(){
      const newText = input.value.trim();
      if (!newText){ cancel(); return; }
      task.text = newText;
      save();
      render();
    }
    function cancel(){
      render();
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', commit);
  }

  editBtn.addEventListener('click', enableEdit);
  titleEl.addEventListener('dblclick', enableEdit);

  return li;
}

/* ---- Add task ---- */
function addTask() {
  const text = taskInput.value.trim();
  const category = categorySelect.value || 'General';
  if (!text) { taskInput.focus(); return; }

  const newTask = { id: uid(), text, completed:false, category, createdAt: Date.now() };
  state.tasks.push(newTask);
  save();

  const node = createTaskNode(newTask);
  taskList.prepend(node);
  requestAnimationFrame(()=> node.classList.add('enter'));
  taskInput.value = '';
  taskInput.blur();
  pulse(addBtn);
  updateProgress();
}
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

/* ---- Toggle complete helper ---- */
function toggleComplete(id){ const t = state.tasks.find(x=>x.id===id); if (!t) return; t.completed = !t.completed; save(); render(); }

/* ---- Delete task ---- */
function deleteTask(id){ state.tasks = state.tasks.filter(t=>t.id!==id); save(); render(); }

/* ---- Clear completed ---- */
clearCompletedBtn.addEventListener('click', () => { state.tasks = state.tasks.filter(t=>!t.completed); save(); render(); });

/* ---- Filter change ---- */
filterCategory.addEventListener('change', (e) => { state.filter = e.target.value; render(); });

/* ---- Progress bar ---- */
function updateProgress(){
  const total = state.tasks.length;
  const completed = state.tasks.filter(t=>t.completed).length;
  const remaining = total - completed;
  const pct = total === 0 ? 0 : Math.round((completed/total)*100);
  remainingCountEl.textContent = remaining;
  totalCountEl.textContent = total;
  progressPct.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
}

/* ---- UX helpers ---- */
function pulse(el){ el.animate([{transform:'scale(1)'},{transform:'scale(.96)'},{transform:'scale(1)'}], {duration:240, easing:'cubic-bezier(.2,.9,.2,1)'}); }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

/* ---- Start ---- */
load();

/* ---- Initialize sample micro-interactions for polish ---- */
(function microPolish(){
  // subtle pulse when empty list
  const checkEmpty = () => {
    if (!state.tasks.length){
      // gently animate the canvas / blobs for empty state
      const blobs = document.querySelectorAll('.blob');
      blobs.forEach((b,i)=> b.animate([{transform:'scale(1)'},{transform:'scale(1.02)'},{transform:'scale(1)'}], {duration:2000 + i*200, iterations:1} ));
    }
  };
  checkEmpty();
})();
