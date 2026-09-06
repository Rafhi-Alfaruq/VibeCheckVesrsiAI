// ==========================================
// VIBECHECK - FULL ENGINE LOGIC (app.js) - OPTIMIZED V5 (WITH SYSTEM NOTIFICATIONS)
// ==========================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('btn-install').classList.remove('hidden');
});
document.getElementById('btn-install').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('btn-install').classList.add('hidden');
    deferredPrompt = null;
  }
});
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
  const txt = document.getElementById('status-text');
  const iconWrap = document.getElementById('status-icon-wrapper');
  if(navigator.onLine) { 
    txt.textContent = "System Ready ⚡"; txt.className = "font-bold text-gray-200 text-sm tracking-wide"; 
    iconWrap.innerHTML = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><i data-lucide="wifi" class="relative inline-flex rounded-full w-4 h-4 text-blue-400"></i>';
  } else { 
    txt.textContent = "Offline Mode 🛡️"; txt.className = "font-bold text-gray-400 text-sm tracking-wide"; 
    iconWrap.innerHTML = '<i data-lucide="wifi-off" class="relative inline-flex rounded-full w-4 h-4 text-gray-500"></i>';
  }
  if (window.lucide) lucide.createIcons({ root: document.getElementById('status-bar') });
}

const liburNasional = {
  "2026-01-01": "Tahun Baru Masehi", "2026-02-18": "Isra Mikraj Nabi Muhammad SAW", "2026-03-03": "Hari Raya Nyepi", "2026-03-20": "Idul Fitri 1447 H",
  "2026-03-21": "Idul Fitri 1447 H", "2026-04-03": "Wafat Isa Al Masih", "2026-05-01": "Hari Buruh Internasional", "2026-05-14": "Kenaikan Isa Al Masih",
  "2026-05-27": "Idul Adha 1447 H", "2026-06-01": "Hari Lahir Pancasila", "2026-06-16": "Tahun Baru Islam 1448 H", "2026-08-17": "Hari Kemerdekaan RI",
  "2026-08-25": "Maulid Nabi Muhammad SAW", "2026-12-25": "Hari Raya Natal"
};

let db;
let currentDate = new Date();
let reminderEngineInterval = null;
let chartInstance = null;
let monthlyChartInstance = null;
let calViewDate = new Date();
let eventImageBlob = null; 
let currentEditEventId = null;
let currentJournalImageBlob = null;
let cachedEventsList = []; 

const catColors = { 
  'Kerja': 'text-blue-400 border-blue-500/50 bg-blue-500/10', 
  'Kesehatan': 'text-green-400 border-green-500/50 bg-green-500/10', 
  'Personal': 'text-blue-400 border-blue-500/50 bg-blue-500/10', 
  'Belajar': 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10',
  'Istirahat': 'text-indigo-400 border-indigo-500/50 bg-indigo-500/10'
};

function getLocalISODate(dateObj) {
  const offset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ProductivityEngineDB', 10);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if(!database.objectStoreNames.contains('tasks')) database.createObjectStore('tasks', { keyPath: 'id' });
      if(!database.objectStoreNames.contains('journal')) database.createObjectStore('journal', { keyPath: 'id' });
      if(!database.objectStoreNames.contains('events')) database.createObjectStore('events', { keyPath: 'id' });
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

const dbAct = {
  add: (store, data) => new Promise(res => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(data); tx.oncomplete = res; }),
  get: (store, id) => new Promise(res => { const req = db.transaction(store).objectStore(store).get(id); req.onsuccess = () => res(req.result); }),
  getAll: (store) => new Promise(res => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess = () => res(req.result); }),
  del: (store, id) => new Promise(res => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete = res; })
};

// ========== GLOBAL SWITCH TAB FUNCTION ==========
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  
  // Remove active class from all buttons
  document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'));
  
  // Show selected tab
  const tabEl = document.getElementById(`content-${tabName}`);
  if (tabEl) tabEl.classList.remove('hidden');
  
  // Add active class to clicked button(s)
  document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(btn => btn.classList.add('active'));
  
  // Render specific content based on tab
  if (tabName === 'quests') renderTasks();
  if (tabName === 'journal') loadJournal();
  if (tabName === 'stats') renderStatsTab();
  if (tabName === 'calendar') renderCalendar();
}

// Add event listeners to all nav buttons
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', function() {
    switchTab(this.getAttribute('data-tab'));
  });
});

['input-date', 'input-journal-date'].forEach(id => {
  document.getElementById(id).addEventListener('change', e => { currentDate = new Date(e.target.value); updateDateUI(); renderTasks(); loadJournal(); });
});

function changeDate(days) { currentDate.setDate(currentDate.getDate() + days); updateDateUI(); renderTasks(); loadJournal(); }
document.getElementById('btn-prev-date').onclick = () => changeDate(-1);
document.getElementById('btn-next-date').onclick = () => changeDate(1);
document.getElementById('btn-prev-journal-date').onclick = () => changeDate(-1);
document.getElementById('btn-next-journal-date').onclick = () => changeDate(1);

function updateDateUI() {
  const dStr = getLocalISODate(currentDate);
  document.getElementById('input-date').value = dStr;
  document.getElementById('input-journal-date').value = dStr;
  document.getElementById('display-date').innerText = currentDate.toLocaleDateString('id-ID', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

// --- ENGINE: TUGAS & TAMPILAN DOM ---
async function renderTasks() {
  const dateStr = getLocalISODate(currentDate);
  let allTasks = await dbAct.getAll('tasks');
  let dayTasks = allTasks.filter(t => t.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));

  const container = document.getElementById('task-list-container');
  let htmlString = '';
  let comp = 0;
  
  if(dayTasks.length === 0) {
    htmlString = '<div class="glass-card rounded-3xl p-8 text-center text-gray-500 font-bold border-dashed border-2 border-gray-700">Tidak ada jadwal hari ini. Ambil nafas sejenak! 🛌</div>';
  } else {
    dayTasks.forEach(t => {
      if(t.completed) comp++;
      const colorCls = catColors[t.category] || 'text-gray-400 border-gray-500/50 bg-gray-500/10';
      
      htmlString += `
        <div class="bg-[#1a1f2e] p-4 rounded-xl border border-white/5 flex items-center gap-4 transition-all hover:bg-[#202638] group shadow-sm relative overflow-hidden">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)" class="task-cb ml-2" />
          <div class="flex-1 overflow-hidden">
            <p class="font-bold text-[15px] ${t.completed ? 'line-through text-gray-500' : 'text-gray-200'} flex items-center gap-2 truncate">
              ${t.title} 
              ${t.notif ? '<i data-lucide="bell" class="w-3 h-3 text-blue-400"></i>' : ''}
            </p>
            <div class="flex items-center gap-3 mt-1.5">
              <span class="text-xs font-semibold text-gray-400">${t.time}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${colorCls}">${t.category}</span>
            </div>
          </div>
          <button onclick="deleteTask('${t.id}')" class="p-2 text-red-400 hover:text-red-300 opacity-70 hover:opacity-100 transition-opacity">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>`;
    });
  }
  
  container.innerHTML = htmlString;
  if (window.lucide) lucide.createIcons({ root: container });
  
  document.getElementById('stat-total').innerText = dayTasks.length;
  document.getElementById('stat-completed').innerText = comp;
  
  renderChart(allTasks);
  renderDailyBanner(dateStr);
}

async function renderDailyBanner(dateStr) {
  const bannerContainer = document.getElementById('daily-event-banner');
  if (!bannerContainer) return;
  
  let bannerHTML = '';
  let hasEvent = false;
  const holidayName = liburNasional[dateStr];
  if (holidayName) {
    hasEvent = true;
    bannerHTML += `
      <div class="bg-gradient-to-r from-red-600 to-red-800 rounded-3xl p-6 mb-4 shadow-[0_0_20px_rgba(220,38,38,0.3)] border border-red-500/50 flex items-center gap-5 transform transition-all hover:scale-[1.01]">
        <div class="p-4 bg-white/20 rounded-2xl backdrop-blur-sm"><i data-lucide="flag" class="w-8 h-8 text-white"></i></div>
        <div>
          <p class="text-red-200 text-[10px] font-black tracking-widest uppercase mb-1">Peringatan / Libur Nasional</p>
          <h3 class="text-2xl font-black text-white leading-tight">${holidayName}</h3>
        </div>
      </div>`;
  }
  
  const dayEvents = cachedEventsList.filter(e => e.date === dateStr);
  for(const ev of dayEvents) {
    hasEvent = true;
    let imgHTML = '';
    if(ev.imageBlob) {
      const imgUrl = URL.createObjectURL(ev.imageBlob);
      imgHTML = `<img src="${imgUrl}" class="w-full h-56 object-cover rounded-2xl mb-5 border border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">`;
    }
    
    bannerHTML += `
      <div class="bg-[#151923] rounded-3xl p-6 mb-4 border-l-4 border-l-blue-500 shadow-xl border-y border-r border-white/5 relative overflow-hidden transition-all hover:-translate-y-1">
        ${imgHTML}
        <p class="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-2 flex items-center gap-2"><i data-lucide="calendar-star" class="w-4 h-4"></i> Event Khusus Anda</p>
        <h3 class="text-2xl font-black text-white mb-2">${ev.title}</h3>
        ${ev.description ? `<p class="text-gray-400 text-sm font-medium mb-5 bg-black/30 p-4 rounded-xl border border-white/5">${ev.description}</p>` : ''}
        <button onclick="editEventObj('${ev.id}')" class="bg-white/10 hover:bg-blue-500/20 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-2 w-full sm:w-auto"><i data-lucide="pencil" class="w-4 h-4"></i> Edit / Hapus Event</button>
      </div>`;
  }
  bannerContainer.innerHTML = bannerHTML;
  bannerContainer.style.display = hasEvent ? 'block' : 'none';
  if (window.lucide) lucide.createIcons({ root: bannerContainer });
}

async function toggleTask(id, isC) { const t = await dbAct.get('tasks', id); t.completed = isC; await dbAct.add('tasks', t); renderTasks(); }
async function deleteTask(id) { if(confirm('Hapus tugas ini?')) { await dbAct.del('tasks', id); renderTasks(); } }

function openTaskModal() {
  const modal = document.getElementById('modal-task-form');
  modal.classList.remove('hidden'); modal.style.display = 'flex';
  document.getElementById('t-title').value = '';
  document.getElementById('t-everyday').checked = false;
  document.getElementById('t-notif').checked = false;
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.add('inactive'); btn.classList.remove('active');
  });
}

function closeTaskModal() {
  const modal = document.getElementById('modal-task-form');
  modal.classList.add('hidden'); modal.style.display = 'none';
}

document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    this.classList.toggle('active');
    this.classList.toggle('inactive');
    const activeCount = document.querySelectorAll('.day-btn.active').length;
    document.getElementById('t-everyday').checked = (activeCount === 7);
  });
});

function toggleEveryday() {
  const isChecked = document.getElementById('t-everyday').checked;
  document.querySelectorAll('.day-btn').forEach(btn => {
    if (isChecked) { btn.classList.add('active'); btn.classList.remove('inactive'); } 
    else { btn.classList.remove('active'); btn.classList.add('inactive'); }
  });
}

async function saveNewTask() {
  const title = document.getElementById('t-title').value;
  const time = document.getElementById('t-time').value;
  const category = document.getElementById('t-category').value;
  const useNotif = document.getElementById('t-notif').checked;
  
  if(!title || !time) return alert('Nama dan Waktu tugas harus diisi!');
  
  const selectedDays = Array.from(document.querySelectorAll('.day-btn.active')).map(b => parseInt(b.dataset.day));
  
  if (selectedDays.length === 0) {
    // Tambahkan field 'notified: false' agar bisa dideteksi oleh radar
    await dbAct.add('tasks', { id: `t_${Date.now()}`, title: title, time: time, category: category, date: getLocalISODate(currentDate), completed: false, notif: useNotif, notified: false });
  } else {
    const baseDate = new Date(currentDate); 
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(baseDate);
      checkDate.setDate(baseDate.getDate() + i);
      if (selectedDays.includes(checkDate.getDay())) {
        await dbAct.add('tasks', { id: `t_${Date.now()}_${i}`, title: title, time: time, category: category, date: getLocalISODate(checkDate), completed: false, notif: useNotif, notified: false });
      }
    }
  }
  closeTaskModal();
  renderTasks();
}

// --- ENGINE: CHART & STATISTIK ---
function renderChart(allTasks) {
  const labels = [], data = [];
  for(let i=29; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dT = allTasks.filter(t => t.date === getLocalISODate(d));
    labels.push(d.getDate()); data.push(dT.length ? Math.round((dT.filter(t=>t.completed).length / dT.length)*100) : 0);
  }
  
  const ctx = document.getElementById('perfChart').getContext('2d');
  
  if(chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
  } else {
    Chart.defaults.color = '#6b7280';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    chartInstance = new Chart(ctx, { 
      type: 'line', 
      data: { labels, datasets: [{ data, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#8b5cf6', pointBorderColor: '#09090b', pointBorderWidth: 1 }] }, 
      options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}, tooltip:{callbacks:{label: function(c){return c.raw+'% selesai';}}}}, scales:{y:{max:100, display:false}, x:{display:false}} } 
    });
  }
}

async function renderStatsTab() {
  const allTasks = await dbAct.getAll('tasks');
  let activeDaysCount = 0, perfectDaysCount = 0, totalCompletionSum = 0, peakCompletion = 0;
  const labels30 = [], data30 = [];
  
  for(let i=29; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = getLocalISODate(d);
    const dayTasks = allTasks.filter(t => t.date === dateStr);
    labels30.push(d.getDate());
    
    if(dayTasks.length > 0) {
      activeDaysCount++;
      const comp = dayTasks.filter(t => t.completed).length;
      const rate = Math.round((comp / dayTasks.length) * 100);
      if(rate === 100) perfectDaysCount++;
      if(rate > peakCompletion) peakCompletion = rate;
      totalCompletionSum += rate; data30.push(rate);
    } else { data30.push(0); }
  }
  
  const avgCompletion = activeDaysCount > 0 ? Math.round(totalCompletionSum / activeDaysCount) : 0;
  document.getElementById('stat-avg-completion').innerText = avgCompletion + '%';
  document.getElementById('stat-perfect-days').innerText = perfectDaysCount;
  document.getElementById('stat-active-days').innerText = activeDaysCount;
  document.getElementById('stat-peak-completion').innerText = peakCompletion + '%';
  
  const ctx30 = document.getElementById('consistencyChart').getContext('2d');
  if(window.consistencyChartInstance) {
    window.consistencyChartInstance.data.labels = labels30;
    window.consistencyChartInstance.data.datasets[0].data = data30;
    window.consistencyChartInstance.update();
  } else {
    window.consistencyChartInstance = new Chart(ctx30, { 
      type: 'bar', 
      data: { labels: labels30, datasets: [{ data: data30, backgroundColor: '#4ade80', borderRadius: 4, barThickness: 8 }] }, 
      options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}, tooltip:{callbacks:{label: function(c){return c.raw+'% selesai';}}}}, scales:{ y:{max:100, display:false}, x:{ grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } } } } 
    });
  }

  const year = new Date().getFullYear();
  const monthlyData = new Array(12).fill(0);
  const monthlyTaskCount = new Array(12).fill(0);
  const monthlyCompletedCount = new Array(12).fill(0);

  allTasks.forEach(t => {
    const tDate = new Date(t.date);
    if (tDate.getFullYear() === year) {
      const mIndex = tDate.getMonth();
      monthlyTaskCount[mIndex]++;
      if (t.completed) monthlyCompletedCount[mIndex]++;
    }
  });
  for (let i = 0; i < 12; i++) {
    if (monthlyTaskCount[i] > 0) {
      monthlyData[i] = Math.round((monthlyCompletedCount[i] / monthlyTaskCount[i]) * 100);
    }
  }

  const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  
  if(window.monthlyChartInstance) {
    window.monthlyChartInstance.data.datasets[0].data = monthlyData;
    window.monthlyChartInstance.update();
  } else {
    window.monthlyChartInstance = new Chart(ctxMonthly, {
      type: 'bar',
      data: { labels: monthNames, datasets: [{ data: monthlyData, backgroundColor: '#10b981', borderRadius: 4, barThickness: 12 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return 'Rata-rata: ' + c.raw + '%'; } } } },
        scales: { y: { max: 100, display: false }, x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11, weight: 'bold' } } } }
      }
    });
  }
}

// --- ENGINE: KALENDER ---
function openCalendarModal() {
  const modal = document.getElementById('calendar-overlay');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  calViewDate = new Date(currentDate); 
  renderCalendar();
}
function closeCalendarModal() {
  const modal = document.getElementById('calendar-overlay');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}
function calPrevMonth() { calViewDate.setMonth(calViewDate.getMonth() - 1); renderCalendar(); }
function calNextMonth() { calViewDate.setMonth(calViewDate.getMonth() + 1); renderCalendar(); }

async function renderCalendar() {
  const gridEl = document.getElementById('calendar-grid');
  const monthYearEl = document.getElementById('cal-month-year');
  if (!gridEl || !monthYearEl) return;

  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  monthYearEl.innerText = `${monthNames[month]} $
