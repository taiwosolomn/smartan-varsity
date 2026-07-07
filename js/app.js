// ─── ROUTER ──────────────────────────────────────────────
let currentPage = 'dashboard';
let currentTrackId = null;
let currentTrackTab = 'overview';

function navigate(page, extra) {
  currentPage = page;
  if (extra?.trackId) currentTrackId = extra.trackId;
  if (extra?.tab) currentTrackTab = extra.tab;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const navLink = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  // Update topbar page title
  const titles = { dashboard: 'Dashboard', tracks: 'Tracks', track: 'Track View', log: 'Log Session', analytics: 'Analytics & Reports', calendar: 'Calendar', resources: 'Resources', profile: 'Profile', settings: 'Settings' };
  document.getElementById('topbar-page-title').textContent = titles[page] || '';

  render();
}

function render() {
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'tracks': renderTracks(); break;
    case 'track': renderTrackView(); break;
    case 'log': renderLog(); break;
    case 'analytics': renderAnalytics(); break;
    case 'calendar': renderCalendar(); break;
    case 'resources': renderResources(); break;
    case 'profile': renderProfile(); break;
    case 'settings': renderSettings(); break;
  }
  updateTopbarStreak();
}

function updateTopbarStreak() {
  const streak = calcStreak();
  document.getElementById('topbar-streak').textContent = streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet';
}

// ─── DASHBOARD ───────────────────────────────────────────
function renderDashboard() {
  const streak = calcStreak();
  const activeCount = DB.tracks.filter(t => {
    const p = trackProgress(t);
    return p.pct > 0 && p.pct < 100;
  }).length;

  // Status strip
  document.getElementById('dash-status').innerHTML =
    `🔥 <span>${streak}-day streak</span> · <span>${hoursThisMonth().toFixed(1)}h logged this month</span> · <span>${activeCount} tracks active</span>`;

  // Stat cards
  document.getElementById('s-hours').textContent = totalHours();
  document.getElementById('s-sessions').textContent = sessionsThisWeek();
  document.getElementById('s-tracks').textContent = DB.tracks.length;
  document.getElementById('s-streak').textContent = streak;

  // Track progress column
  const tpl = document.getElementById('track-progress-list');
  tpl.innerHTML = DB.tracks.map(t => {
    const p = trackProgress(t);
    return `<div class="track-progress-row" onclick="navigate('track',{trackId:'${t.id}'})">
      <div class="track-progress-icon" style="background:${t.color}22">${t.icon}</div>
      <div class="track-progress-name">${t.name}</div>
      <div class="track-progress-pct">${p.pct}%</div>
      <div class="track-progress-bar"><div class="progress-bar"><div class="progress-fill" style="width:${p.pct}%;background:${t.color}"></div></div></div>
    </div>`;
  }).join('');

  // Today column
  const todayLogs = DB.logs.filter(l => l.date === today());
  const todayPlanned = DB.calendar.filter(e => e.date === today());

  let todayHtml = '';
  todayHtml += `<div class="today-section-label">Planned</div>`;
  if (todayPlanned.length) {
    todayHtml += todayPlanned.map(e => {
      const t = getTrack(e.trackId);
      return `<div class="today-item"><div class="today-dot" style="background:${t?.color||'#666'}"></div><div class="today-text">${e.topic}</div><div class="today-dur">${e.duration}min</div></div>`;
    }).join('');
  } else {
    todayHtml += `<div style="font-size:12px;color:var(--text3);padding:8px 0">No sessions planned — <a onclick="navigate('calendar')" style="color:var(--red);cursor:pointer">add to calendar</a></div>`;
  }
  todayHtml += `<div class="today-divider"></div>`;
  todayHtml += `<div class="today-section-label">Logged</div>`;
  if (todayLogs.length) {
    todayHtml += todayLogs.map(l => {
      const t = getTrack(l.trackId);
      return `<div class="today-item"><div class="today-dot" style="background:${t?.color||'#666'}"></div><div class="today-text">${l.topic}</div><div class="today-dur">${l.duration}min · ${l.rating}/10</div></div>`;
    }).join('');
  } else {
    todayHtml += `<div style="font-size:12px;color:var(--text3);padding:8px 0">Nothing logged yet today.</div>`;
  }
  document.getElementById('today-col').innerHTML = todayHtml;

  // Recent activity
  const recent = [...DB.logs].sort((a,b) => b.date.localeCompare(a.date)).slice(0,8);
  document.getElementById('recent-activity').innerHTML = recent.map(l => {
    const t = getTrack(l.trackId);
    return `<div class="activity-card">
      <div class="activity-card-date">${formatDate(l.date)}</div>
      <div class="activity-card-meta"><span class="pill" style="background:${t?.color||'#666'}22;color:${t?.color||'#aaa'};border:1px solid ${t?.color||'#444'}44;font-size:10px">${t?.icon||''} ${t?.name||'?'}</span></div>
      <div class="activity-card-topic" style="margin-top:6px">${l.topic}</div>
      <div class="activity-card-rating">⭐ ${l.rating}/10 · ${l.duration}min</div>
    </div>`;
  }).join('');
}

// ─── TRACKS ──────────────────────────────────────────────
let tracksView = 'grid';
let tracksFilter = 'all';

function renderTracks() {
  const filtered = DB.tracks.filter(t => {
    const p = trackProgress(t);
    if (tracksFilter === 'active') return p.pct > 0 && p.pct < 100;
    if (tracksFilter === 'complete') return p.pct === 100;
    return true;
  });

  if (tracksView === 'grid') {
    document.getElementById('tracks-container').innerHTML = `<div class="tracks-grid">${
      filtered.map(t => {
        const p = trackProgress(t);
        return `<div class="track-card">
          <div class="track-card-band" style="background:${t.color}22">${t.icon}</div>
          <div class="track-card-body">
            <div class="track-card-name">${t.name}</div>
            <div class="track-card-phase">${t.phase}</div>
            <div class="track-card-meta">${t.courses.length} courses · ${p.done} of ${p.total} modules complete</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${p.pct}%;background:${t.color}"></div></div>
            <div class="track-card-pct">${p.pct}% complete</div>
            <div class="track-card-actions"><button class="btn btn-outline btn-sm" onclick="navigate('track',{trackId:'${t.id}'})">Open Track</button></div>
          </div>
        </div>`;
      }).join('')
    }</div>`;
  } else {
    document.getElementById('tracks-container').innerHTML = filtered.map(t => {
      const p = trackProgress(t);
      return `<div class="track-list-item">
        <div class="track-list-band" style="background:${t.color}22">${t.icon}</div>
        <div class="track-list-info">
          <div class="track-list-name">${t.name}</div>
          <div class="track-list-meta">${t.phase} · ${t.courses.length} courses · ${p.done}/${p.total} modules</div>
          <div class="progress-bar" style="width:300px"><div class="progress-fill" style="width:${p.pct}%;background:${t.color}"></div></div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:12px">
          <span style="font-size:13px;color:var(--text2)">${p.pct}%</span>
          <button class="btn btn-outline btn-sm" onclick="navigate('track',{trackId:'${t.id}'})">Open Track</button>
        </div>
      </div>`;
    }).join('');
  }
}

// ─── TRACK VIEW ──────────────────────────────────────────
function renderTrackView() {
  const track = getTrack(currentTrackId);
  if (!track) return;
  const p = trackProgress(track);

  // Hero
  document.getElementById('track-hero').style.background = `linear-gradient(135deg, ${track.color}44, ${track.color}11)`;
  document.getElementById('track-hero').style.borderColor = track.color + '44';
  document.getElementById('track-hero').style.border = `1px solid ${track.color}44`;
  document.getElementById('hero-icon').textContent = track.icon;
  document.getElementById('hero-name').textContent = track.name;
  document.getElementById('hero-phase').textContent = track.phase + ' · Self-directed · Est. Jan 2026';
  document.getElementById('hero-pct').textContent = `${p.pct}% complete`;
  document.getElementById('hero-bar-fill').style.width = p.pct + '%';

  // Tabs
  document.querySelectorAll('#page-track .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`track-tab-${currentTrackTab}`).classList.add('active');
  document.querySelectorAll('.track-tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`track-panel-${currentTrackTab}`).style.display = 'block';

  if (currentTrackTab === 'overview') renderTrackOverview(track);
  if (currentTrackTab === 'progress') renderTrackProgress(track);
  if (currentTrackTab === 'log') renderTrackLog(track);

  // Sidebar drawer
  renderTrackDrawer(track);
}

function renderTrackOverview(track) {
  document.getElementById('track-overview-body').innerHTML = track.courses.map(course => {
    const cp = courseProgress(course);
    return `<div class="section-block" id="sb-${course.id}">
      <div class="section-block-header" onclick="toggleSection('${course.id}')">
        <div class="section-block-title">
          <h3>${course.name}</h3>
          <div class="section-block-progress">${cp.done} of ${cp.total} modules complete</div>
          <div class="section-block-bar progress-bar" style="width:180px;margin-top:6px"><div class="progress-fill" style="width:${cp.pct}%"></div></div>
        </div>
        <div class="section-block-controls">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openAddModule('${track.id}','${course.id}')">+ Add</button>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openEditCourse('${track.id}','${course.id}')"><i class="ti ti-dots-vertical"></i></button>
          <i class="ti ti-chevron-down section-block-chevron" id="chev-${course.id}"></i>
        </div>
      </div>
      <div class="section-block-body open" id="body-${course.id}">
        ${course.modules.map(m => `
          <div class="task-row" id="task-${m.id}">
            <div class="task-icon"><i class="ti ${typeIcon(m.type)}"></i></div>
            <div class="task-title">${m.title}<div class="task-meta">${m.type}</div></div>
            <div style="display:flex;align-items:center;gap:8px">
              ${statusLabel(m.status)}
              <button class="btn btn-outline btn-sm" onclick="cycleStatus('${track.id}','${course.id}','${m.id}')" title="Change status"><i class="ti ti-refresh" style="font-size:12px"></i></button>
            </div>
          </div>`).join('')}
        <div style="padding:10px 16px"><button class="btn btn-outline btn-sm" onclick="openAddModule('${track.id}','${course.id}')"><i class="ti ti-plus"></i> Add module</button></div>
      </div>
    </div>`;
  }).join('') + `<div style="margin-top:12px"><button class="btn btn-outline" onclick="openAddCourse('${track.id}')"><i class="ti ti-plus"></i> Add course</button></div>`;
}

function renderTrackProgress(track) {
  const logs = DB.logs.filter(l => l.trackId === track.id);
  const body = document.getElementById('track-progress-body');
  body.innerHTML = `<table class="data-table" style="width:100%">
    <thead><tr>
      <th>Course</th><th>Done</th><th>Total</th><th>Complete</th><th>Avg mastery</th><th>Last session</th>
    </tr></thead>
    <tbody>${track.courses.map(c => {
      const cp = courseProgress(c);
      const cLogs = logs.filter(l => {
        // Match logs that mention this course roughly
        return l.trackId === track.id;
      });
      const ratings = cLogs.filter(l => l.rating).map(l => l.rating);
      const avgR = ratings.length ? (ratings.reduce((a,r)=>a+r,0)/ratings.length).toFixed(1) : '—';
      const lastLog = cLogs.sort((a,b) => b.date.localeCompare(a.date))[0];
      return `<tr>
        <td>${c.name}</td>
        <td>${cp.done}</td>
        <td>${cp.total}</td>
        <td><div class="progress-bar" style="width:80px;display:inline-block"><div class="progress-fill" style="width:${cp.pct}%"></div></div> ${cp.pct}%</td>
        <td>${avgR}</td>
        <td>${lastLog ? formatDate(lastLog.date) : '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>
  <div style="margin-top:16px;padding:12px 16px;background:var(--surface2);border-radius:var(--radius);font-size:13px;color:var(--text2)">
    ${(() => {
      const sorted = track.courses.map(c => ({c, p: courseProgress(c)})).sort((a,b) => b.p.pct - a.p.pct);
      const best = sorted[0]?.c.name || '—';
      const worst = sorted.filter(x => x.p.pct < 100).pop()?.c.name || '—';
      const lastLog = [...DB.logs].filter(l => l.trackId === track.id).sort((a,b) => b.date.localeCompare(a.date))[0];
      return `Strongest: <b>${best}</b> · Needs attention: <b>${worst}</b> · Last active: <b>${lastLog ? formatDate(lastLog.date) : 'Never'}</b>`;
    })()}
  </div>`;
}

function renderTrackLog(track) {
  const logs = DB.logs.filter(l => l.trackId === track.id).sort((a,b) => b.date.localeCompare(a.date));
  const body = document.getElementById('track-log-body');
  if (!logs.length) { body.innerHTML = '<div class="empty-state"><i class="ti ti-note"></i>No sessions logged for this track yet.</div>'; return; }
  body.innerHTML = `<table class="data-table">
    <thead><tr><th>Date</th><th>Topic</th><th>Duration</th><th>Notes</th><th>Rating</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td>${formatDate(l.date)}</td>
      <td>${l.topic}</td>
      <td>${l.duration}min</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.notes || '—'}</td>
      <td>${l.rating}/10</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderTrackDrawer(track) {
  const drawerBody = document.getElementById('drawer-body');
  drawerBody.innerHTML = track.courses.map(c => {
    return `<div class="drawer-section">${c.name}</div>
    ${c.modules.map(m => `<div class="drawer-item${m.status==='done'?' active':''}" onclick="scrollToModule('${m.id}')">${m.title}</div>`).join('')}`;
  }).join('');
}

function scrollToModule(id) {
  const el = document.getElementById('task-' + id);
  if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.background='rgba(204,51,51,0.08)'; setTimeout(() => el.style.background='', 1000); }
  closeDrawer();
}

function toggleSection(courseId) {
  const body = document.getElementById('body-' + courseId);
  const chev = document.getElementById('chev-' + courseId);
  body.classList.toggle('open');
  chev.classList.toggle('open');
}

function cycleStatus(trackId, courseId, moduleId) {
  const track = getTrack(trackId);
  const course = track?.courses.find(c => c.id === courseId);
  const mod = course?.modules.find(m => m.id === moduleId);
  if (!mod) return;
  const cycle = { 'todo': 'inprogress', 'inprogress': 'done', 'done': 'todo' };
  mod.status = cycle[mod.status];
  save();
  renderTrackView();
  showToast(`${mod.title} → ${mod.status === 'done' ? '✓ Done' : mod.status}`);
}

// ─── LOG SESSION ─────────────────────────────────────────
let logState = { trackId: null, duration: null, mastery: null, milestone: false };

function renderLog() {
  // Track pills
  document.getElementById('log-track-pills').innerHTML = DB.tracks.map(t =>
    `<button class="track-pill-btn${logState.trackId===t.id?' sel':''}" style="background:${t.color}" onclick="selectLogTrack('${t.id}')">${t.icon} ${t.name}</button>`
  ).join('');
  // Duration quick
  document.querySelectorAll('.duration-quick').forEach(b => {
    b.classList.toggle('sel', parseInt(b.dataset.dur) === logState.duration);
  });
  // Mastery
  document.querySelectorAll('.mastery-btn').forEach(b => {
    b.classList.toggle('sel', parseInt(b.dataset.m) === logState.mastery);
  });
}

function selectLogTrack(id) { logState.trackId = id; renderLog(); }

function selectDuration(val) {
  logState.duration = val;
  document.getElementById('log-dur-input').value = val;
  renderLog();
}

function selectMastery(val) { logState.mastery = val; renderLog(); }

function toggleMilestoneInput() {
  logState.milestone = !logState.milestone;
  document.getElementById('milestone-name-wrap').classList.toggle('visible', logState.milestone);
}

function saveLog() {
  const topic = document.getElementById('log-topic').value.trim();
  const duration = parseInt(document.getElementById('log-dur-input').value) || logState.duration;
  const date = document.getElementById('log-date').value;
  const notes = document.getElementById('log-notes').value.trim();
  const milestoneName = document.getElementById('milestone-name').value.trim();

  if (!logState.trackId) { showToast('Select a track first'); return; }
  if (!topic) { showToast('Add a topic'); return; }
  if (!duration) { showToast('Set a duration'); return; }
  if (!date) { showToast('Set a date'); return; }

  const log = { id: uid(), trackId: logState.trackId, topic, duration, date, notes, rating: logState.mastery || 7, milestone: milestoneName || null };
  DB.logs.unshift(log);

  if (milestoneName) {
    DB.milestones.unshift({ id: uid(), trackId: logState.trackId, name: milestoneName, date });
  }

  save();

  const track = getTrack(logState.trackId);
  showToast(`${track?.icon} ${track?.name} · ${duration}min logged`);

  // Reset
  document.getElementById('log-topic').value = '';
  document.getElementById('log-dur-input').value = '';
  document.getElementById('log-notes').value = '';
  document.getElementById('milestone-name').value = '';
  document.getElementById('milestone-toggle-cb').checked = false;
  document.getElementById('milestone-name-wrap').classList.remove('visible');
  logState = { trackId: null, duration: null, mastery: null, milestone: false };
  renderLog();
}

// ─── ANALYTICS ───────────────────────────────────────────
function renderAnalytics() {
  const logs = DB.logs;
  const totalMins = logs.reduce((a,l) => a+l.duration, 0);
  const avgSess = logs.length ? Math.round(totalMins/logs.length) : 0;
  const byTrack = {};
  logs.forEach(l => { byTrack[l.trackId] = (byTrack[l.trackId]||0) + l.duration; });
  const bestTid = Object.entries(byTrack).sort((a,b)=>b[1]-a[1])[0];
  const bestTrack = bestTid ? getTrack(bestTid[0]) : null;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (weekStart.getDay()||7) + 1);
  const weekMins = logs.filter(l => l.date >= weekStart.toISOString().slice(0,10)).reduce((a,l)=>a+l.duration,0);
  const ratings = logs.filter(l=>l.rating).map(l=>l.rating);
  const avgQ = ratings.length ? (ratings.reduce((a,r)=>a+r,0)/ratings.length).toFixed(1) : '—';

  document.getElementById('a-hours').textContent = (totalMins/60).toFixed(1);
  document.getElementById('a-avg').textContent = avgSess + 'min';
  document.getElementById('a-best').textContent = bestTrack ? bestTrack.icon + ' ' + bestTrack.name : '—';
  document.getElementById('a-quality').textContent = avgQ;
  document.getElementById('a-week').textContent = (weekMins/60).toFixed(1) + 'h';

  // Hours by track bar chart
  const maxMins = Math.max(...Object.values(byTrack), 1);
  document.getElementById('hours-by-track').innerHTML = DB.tracks.map(t => {
    const mins = byTrack[t.id] || 0;
    const hrs = (mins/60).toFixed(1);
    const w = Math.round(mins/maxMins*100);
    return `<div class="bar-chart-row">
      <div class="bar-chart-label">${t.icon} ${t.name.split(' ')[0]}</div>
      <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${w}%;background:${t.color}">${hrs}h</div></div>
    </div>`;
  }).join('') || '<div class="empty-state">Log sessions to see data</div>';

  // Heatmap — last 91 days
  const heatDates = {};
  logs.forEach(l => { heatDates[l.date] = (heatDates[l.date]||0) + l.duration; });
  const days = 91;
  const cells = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const mins = heatDates[key] || 0;
    const lvl = mins === 0 ? 0 : mins < 60 ? 1 : mins < 120 ? 2 : mins < 180 ? 3 : 4;
    cells.push({ key, lvl, d });
  }
  const weeks = Math.ceil(days/7);
  let heatHtml = `<div style="display:grid;grid-template-columns:repeat(${weeks},1fr);gap:3px">`;
  cells.forEach((c,i) => {
    if (i % 7 === 0 && i > 0) { /* handled by grid */ }
  });
  // Build week-by-week columns
  let wrapHtml = `<div style="display:flex;gap:3px;overflow-x:auto">`;
  for (let w = 0; w < weeks; w++) {
    wrapHtml += `<div style="display:flex;flex-direction:column;gap:3px">`;
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (idx < cells.length) {
        const c = cells[idx];
        const cls = ['heat-cell', 'heat-cell heat-1', 'heat-cell heat-2', 'heat-cell heat-3', 'heat-cell heat-4'][c.lvl];
        wrapHtml += `<div class="${cls}" title="${c.key}" style="width:12px;height:12px;border-radius:2px"></div>`;
      } else {
        wrapHtml += `<div style="width:12px;height:12px"></div>`;
      }
    }
    wrapHtml += `</div>`;
  }
  wrapHtml += `</div><div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--text3)">Less <div class="heat-cell" style="width:12px;height:12px;border-radius:2px;display:inline-block"></div><div class="heat-cell heat-1" style="width:12px;height:12px;border-radius:2px;display:inline-block"></div><div class="heat-cell heat-2" style="width:12px;height:12px;border-radius:2px;display:inline-block"></div><div class="heat-cell heat-3" style="width:12px;height:12px;border-radius:2px;display:inline-block"></div><div class="heat-cell heat-4" style="width:12px;height:12px;border-radius:2px;display:inline-block"></div> More</div>`;
  document.getElementById('heatmap-container').innerHTML = wrapHtml;

  // Donut
  const donutSvg = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');
  const totalD = Object.values(byTrack).reduce((a,v)=>a+v,0) || 1;
  const tracksWithData = DB.tracks.filter(t => byTrack[t.id]);
  const cx=60,cy=60,r=45,strokeW=14;
  const circ = 2*Math.PI*r;
  let offset = 0;
  let paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a3045" stroke-width="${strokeW}"/>`;
  let legendHtml = '';
  if (tracksWithData.length) {
    tracksWithData.forEach(t => {
      const pct = (byTrack[t.id]||0)/totalD;
      const dash = pct*circ;
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.color}" stroke-width="${strokeW}" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
      legendHtml += `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${t.color}"></div>${t.name}: ${((byTrack[t.id]||0)/60).toFixed(1)}h</div>`;
    });
  } else {
    legendHtml = '<div style="font-size:12px;color:var(--text3)">No data yet</div>';
  }
  donutSvg.innerHTML = paths;
  legend.innerHTML = legendHtml;

  // Streak history (current month calendar)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year,month,1).getDay() || 7;
  const daysInMonth = new Date(year,month+1,0).getDate();
  let calHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px">';
  ['M','T','W','T','F','S','S'].forEach(d => { calHtml += `<div style="text-align:center;color:var(--text3);padding:4px">${d}</div>`; });
  for (let i=1;i<firstDay;i++) calHtml += '<div></div>';
  for (let d=1;d<=daysInMonth;d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasLog = DB.logs.some(l => l.date === key);
    const isToday = key === today();
    calHtml += `<div style="text-align:center;padding:4px 0;font-size:11px;border-radius:3px;${hasLog?`background:var(--red);color:#fff;font-weight:600;`:isToday?`border:1px solid var(--red);color:var(--red);`:`color:var(--text3);`}">${d}</div>`;
  }
  calHtml += '</div>';
  document.getElementById('streak-calendar').innerHTML = calHtml;
  document.getElementById('streak-current').textContent = calcStreak();
}

// ─── CALENDAR ────────────────────────────────────────────
let calDate = new Date();

function renderCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = calDate.toLocaleDateString('en-GB', { month:'long', year:'numeric' });

  const firstDay = new Date(year,month,1).getDay() || 7;
  const daysInMonth = new Date(year,month+1,0).getDate();
  const prevDays = new Date(year,month,0).getDate();

  const days = [];
  for (let i=firstDay-1;i>0;i--) days.push({date:new Date(year,month-1,prevDays-i+1),other:true});
  for (let d=1;d<=daysInMonth;d++) days.push({date:new Date(year,month,d),other:false});
  while (days.length%7!==0) days.push({date:new Date(year,month+1,days.length-daysInMonth-firstDay+2),other:true});

  const todayKey = today();
  let html = '';
  days.forEach(({date,other}) => {
    const key = date.toISOString().slice(0,10);
    const isToday = key === todayKey;
    const events = [...DB.calendar.filter(e=>e.date===key), ...DB.logs.filter(l=>l.date===key).map(l=>({...l,isLog:true}))];
    html += `<div class="calendar-cell${other?' other-month':''}${isToday?' today':''}" onclick="openDayModal('${key}')">
      <div class="cell-date">${date.getDate()}</div>
      <div class="cell-events">${events.slice(0,3).map(e => {
        const t = getTrack(e.trackId||e.trackId);
        const label = e.isLog ? `✓ ${e.topic}` : e.topic;
        return `<div class="cell-event" style="background:${t?.color||'#666'}">${label}</div>`;
      }).join('')}${events.length>3?`<div style="font-size:10px;color:var(--text3)">+${events.length-3} more</div>`:''}</div>
    </div>`;
  });
  document.getElementById('cal-grid').innerHTML = html;
}

function calNav(dir) { calDate.setMonth(calDate.getMonth()+dir); renderCalendar(); }

function openPlanSession(dateStr) {
  document.getElementById('ps-date').value = dateStr || today();
  document.getElementById('ps-track').innerHTML = DB.tracks.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');
  document.getElementById('plan-modal').classList.add('open');
}

function savePlanSession() {
  const trackId = document.getElementById('ps-track').value;
  const topic = document.getElementById('ps-topic').value.trim();
  const date = document.getElementById('ps-date').value;
  const time = document.getElementById('ps-time').value || '09:00';
  const duration = parseInt(document.getElementById('ps-duration').value) || 60;
  if (!topic || !date) { showToast('Fill in topic and date'); return; }
  DB.calendar.push({ id: uid(), trackId, topic, date, time, duration });
  save();
  document.getElementById('plan-modal').classList.remove('open');
  renderCalendar();
  showToast('Session planned');
}

function openDayModal(dateStr) {
  openPlanSession(dateStr);
}

// ─── RESOURCES ───────────────────────────────────────────
let resourceFilter = 'all';
let resourceTrackFilter = 'all';

function renderResources() {
  // Sidebar
  const sidebar = document.getElementById('resources-sidebar');
  sidebar.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin-bottom:8px;font-weight:600">Type</div>
  ${['all','Article','Video','Book','Tool','Paper','Course'].map(f =>
    `<div class="resource-filter-item${resourceFilter===f?' active':''}" onclick="setResourceFilter('${f}')">${f==='all'?'All types':f}</div>`
  ).join('')}
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin:14px 0 8px;font-weight:600">Track</div>
  <div class="resource-filter-item${resourceTrackFilter==='all'?' active':''}" onclick="setResourceTrackFilter('all')">All tracks</div>
  ${DB.tracks.map(t => `<div class="resource-filter-item${resourceTrackFilter===t.id?' active':''}" onclick="setResourceTrackFilter('${t.id}')">${t.icon} ${t.name.split(' ')[0]}</div>`).join('')}`;

  // Cards
  let filtered = DB.resources;
  if (resourceFilter !== 'all') filtered = filtered.filter(r => r.type === resourceFilter);
  if (resourceTrackFilter !== 'all') filtered = filtered.filter(r => r.trackId === resourceTrackFilter);

  document.getElementById('resource-cards').innerHTML = filtered.length ? filtered.map(r => {
    const t = getTrack(r.trackId);
    return `<div class="resource-card">
      <div class="resource-card-type">${r.type}</div>
      <div class="resource-card-title">${r.title}</div>
      ${t ? `<span class="pill" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;margin-bottom:8px;display:inline-flex">${t.icon} ${t.name}</span>` : ''}
      ${r.notes ? `<div class="resource-card-note">${r.notes}</div>` : ''}
      <div class="resource-card-footer">
        <div class="resource-card-date">${formatDate(r.added)}</div>
        ${r.url ? `<a href="${r.url}" target="_blank" class="btn btn-outline btn-sm"><i class="ti ti-external-link"></i> Open</a>` : ''}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state"><i class="ti ti-books"></i>No resources yet.</div>';
}

function setResourceFilter(f) { resourceFilter = f; renderResources(); }
function setResourceTrackFilter(f) { resourceTrackFilter = f; renderResources(); }

function openAddResource() {
  document.getElementById('ar-track').innerHTML = DB.tracks.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');
  document.getElementById('add-resource-modal').classList.add('open');
}

function saveResource() {
  const title = document.getElementById('ar-title').value.trim();
  if (!title) { showToast('Add a title'); return; }
  DB.resources.unshift({
    id: uid(),
    title,
    type: document.getElementById('ar-type').value,
    trackId: document.getElementById('ar-track').value,
    url: document.getElementById('ar-url').value.trim(),
    notes: document.getElementById('ar-notes').value.trim(),
    added: today()
  });
  save();
  document.getElementById('add-resource-modal').classList.remove('open');
  ['ar-title','ar-url','ar-notes'].forEach(id => document.getElementById(id).value='');
  renderResources();
  showToast('Resource saved');
}

// ─── PROFILE ─────────────────────────────────────────────
let profileTab = 'mission';

function renderProfile() {
  const totalH = totalHours();
  const milestones = DB.milestones.length;
  document.getElementById('p-hours').textContent = totalH;
  document.getElementById('p-sessions').textContent = DB.logs.length;
  document.getElementById('p-milestones').textContent = milestones;

  document.querySelectorAll('#page-profile .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`ptab-${profileTab}`).classList.add('active');
  document.querySelectorAll('.profile-tab-panel').forEach(p => p.style.display='none');
  document.getElementById(`ppanel-${profileTab}`).style.display='block';

  if (profileTab === 'mission') {
    document.getElementById('p-mission').innerHTML = `
      <div style="font-size:28px;font-weight:800;margin-bottom:16px;color:var(--red)">${DB.profile.mission}</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px;text-transform:uppercase;letter-spacing:0.5px">Active Goals</div>
      ${DB.profile.goals.map(g => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:6px;height:6px;border-radius:50%;background:var(--red);flex-shrink:0"></div>
        <div style="flex:1;font-size:13px">${g.text}</div>
        <div style="font-size:11px;color:var(--text3)">${g.target}</div>
      </div>`).join('')}
      <div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--red)">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--red);margin-bottom:8px;font-weight:600">Acorn Project</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6">${DB.profile.project}</div>
      </div>`;
  }

  if (profileTab === 'tracks') {
    document.getElementById('p-tracks').innerHTML = DB.tracks.map(t => {
      const p = trackProgress(t);
      return `<div class="track-list-item" onclick="navigate('track',{trackId:'${t.id}'})" style="cursor:pointer">
        <div class="track-list-band" style="background:${t.color}22">${t.icon}</div>
        <div class="track-list-info">
          <div class="track-list-name">${t.name}</div>
          <div class="track-list-meta">${t.phase} · ${p.done}/${p.total} modules · ${p.pct}%</div>
          <div class="progress-bar" style="margin-top:6px;width:260px"><div class="progress-fill" style="width:${p.pct}%;background:${t.color}"></div></div>
        </div>
        <button class="btn btn-outline btn-sm" style="margin-left:auto">View</button>
      </div>`;
    }).join('');
  }

  if (profileTab === 'milestones') {
    const ms = [...DB.milestones].sort((a,b) => b.date.localeCompare(a.date));
    document.getElementById('p-milestones-list').innerHTML = ms.length ? ms.map(m => {
      const t = getTrack(m.trackId);
      return `<div class="milestone-item">
        <div class="milestone-dot" style="background:${t?.color||'var(--red)'}"></div>
        <div class="milestone-info">
          <div class="milestone-name">${m.name}</div>
          <div class="milestone-meta">${t?.icon||''} ${t?.name||'Unknown track'}</div>
        </div>
        <div class="milestone-date">${formatDate(m.date)}</div>
      </div>`;
    }).join('') : '<div class="empty-state"><i class="ti ti-trophy"></i>No milestones yet. Keep building.</div>';
  }
}

function switchProfileTab(tab) { profileTab = tab; renderProfile(); }

// ─── SETTINGS ────────────────────────────────────────────
function renderSettings() { /* Settings are static HTML with JS handlers */ }

function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='smartan-varsity-data.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

function clearData() {
  if (!confirm('Delete all data permanently? This cannot be undone.')) return;
  localStorage.removeItem(DB_KEY);
  location.reload();
}

// ─── MODALS (Add Track, Course, Module) ──────────────────
function openAddTrack() {
  document.getElementById('at-name').value='';
  document.getElementById('at-icon').value='';
  document.getElementById('at-color').value='#3b82f6';
  document.getElementById('at-phase').value='Phase I';
  document.getElementById('add-track-modal').classList.add('open');
}

function saveTrack() {
  const name = document.getElementById('at-name').value.trim();
  if (!name) { showToast('Add a track name'); return; }
  DB.tracks.push({
    id: uid(), name,
    icon: document.getElementById('at-icon').value.trim() || '📚',
    color: document.getElementById('at-color').value,
    phase: document.getElementById('at-phase').value.trim() || 'Phase I',
    courses: []
  });
  save();
  document.getElementById('add-track-modal').classList.remove('open');
  renderTracks();
  showToast('Track created');
}

function openAddCourse(trackId) {
  document.getElementById('ac-track-id').value = trackId;
  document.getElementById('ac-name').value = '';
  document.getElementById('add-course-modal').classList.add('open');
}

function saveCourse() {
  const trackId = document.getElementById('ac-track-id').value;
  const name = document.getElementById('ac-name').value.trim();
  if (!name) { showToast('Add a course name'); return; }
  const track = getTrack(trackId);
  track.courses.push({ id: uid(), name, modules: [] });
  save();
  document.getElementById('add-course-modal').classList.remove('open');
  renderTrackView();
  showToast('Course added');
}

function openAddModule(trackId, courseId) {
  document.getElementById('am-track-id').value = trackId;
  document.getElementById('am-course-id').value = courseId;
  document.getElementById('am-title').value = '';
  document.getElementById('add-module-modal').classList.add('open');
}

function saveModule() {
  const trackId = document.getElementById('am-track-id').value;
  const courseId = document.getElementById('am-course-id').value;
  const title = document.getElementById('am-title').value.trim();
  if (!title) { showToast('Add a module title'); return; }
  const track = getTrack(trackId);
  const course = track?.courses.find(c => c.id === courseId);
  if (!course) return;
  course.modules.push({
    id: uid(), title,
    type: document.getElementById('am-type').value,
    status: 'todo'
  });
  save();
  document.getElementById('add-module-modal').classList.remove('open');
  renderTrackView();
  showToast('Module added');
}

function openEditCourse(trackId, courseId) {
  // Simple: prompt for rename
  const track = getTrack(trackId);
  const course = track?.courses.find(c => c.id === courseId);
  if (!course) return;
  const newName = prompt('Course name:', course.name);
  if (newName && newName.trim()) { course.name = newName.trim(); save(); renderTrackView(); }
}

// ─── DRAWER ──────────────────────────────────────────────
function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

// ─── TOAST ───────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── CLOSE MODALS ────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set log date default
  document.getElementById('log-date').value = today();

  // Duration quick-select
  document.querySelectorAll('.duration-quick').forEach(b => {
    b.addEventListener('click', () => {
      selectDuration(parseInt(b.dataset.dur));
      document.getElementById('log-dur-input').value = b.dataset.dur;
    });
  });

  // Mastery buttons
  document.querySelectorAll('.mastery-btn').forEach(b => {
    b.addEventListener('click', () => selectMastery(parseInt(b.dataset.m)));
  });

  // Track filter tabs
  document.querySelectorAll('.filter-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      tracksFilter = b.dataset.filter;
      renderTracks();
    });
  });

  // View toggles
  document.querySelectorAll('.view-toggle').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      tracksView = b.dataset.view;
      renderTracks();
    });
  });

  navigate('dashboard');
});
