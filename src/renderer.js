import './index.css';
import './tray.css';
import confetti from 'canvas-confetti';

// Check if we are rendering the Tray Window or the Main Hub
const isTrayWindow = window.location.search.includes('tray=true');

// DOM Elements
const notesTextarea = document.getElementById('notes-textarea');

// Data State
let appData = {
  schedule: [],
  tasks: [],
  notes: '',
  links: []
};

// Initialize App
async function init() {
  // Load data from Main process
  appData = await window.api.getData();

  if (!appData.schedule) appData.schedule = [];
  if (!appData.tasks) appData.tasks = [];
  if (!appData.links) appData.links = [];
  if (!appData.notes) appData.notes = '';

  // Setup Notes Sync
  notesTextarea.value = appData.notes;
  let notesTimeout;
  notesTextarea.addEventListener('input', (e) => {
    clearTimeout(notesTimeout);
    notesTimeout = setTimeout(() => {
      appData.notes = e.target.value;
      window.api.setData('notes', appData.notes);
    }, 500);
  });

  // Auto-sync ADE on startup if we already have a URL stored
  // For UI, we first render the stored schedule
  renderSchedule();
  renderTasks();
  renderLinks();

  // Background ADE sync
  const adeUrl = await window.api.getData('adeUrl');
  if (adeUrl) {
    const updatedSchedule = await window.api.syncAde();
    if (updatedSchedule) {
      appData.schedule = updatedSchedule;
      renderSchedule();
    }
  }


  if (isTrayWindow) {
    initTray();
  } else {
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tray-app').style.display = 'none';
    renderSchedule();
    renderTasks();
    renderLinks();
    setupModals();
    setupPomodoro();
    updateWeatherWidget();
    updateStreakWidget();
  }

  // Listen for background schedule updates
  window.api.on('schedule-updated', async () => {
    appData.schedule = await window.api.getData('schedule');
    if (isTrayWindow) {
      initTray();
    } else {
      renderSchedule();
    }
  });
}

async function updateWeatherWidget() {
  const container = document.getElementById('header-weather-widget');
  if (!container) return;

  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const now = new Date();
  const dateStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  try {
    // Montbéliard coordinates: 47.51, 6.7983
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=47.51&longitude=6.7983&current_weather=true');
    const data = await res.json();
    const temp = Math.round(data.current_weather.temperature);
    const code = data.current_weather.weathercode;

    let icon = 'ph-cloud';
    if (code === 0) icon = 'ph-sun';
    else if (code <= 3) icon = 'ph-cloud-sun';
    else if (code <= 49) icon = 'ph-cloud-fog';
    else if (code <= 69) icon = 'ph-cloud-rain';
    else if (code <= 79) icon = 'ph-cloud-snow';
    else if (code <= 99) icon = 'ph-cloud-lightning';

    container.innerHTML = `<span>${dateStr} &nbsp;|&nbsp; ${temp}°C</span> <i class="ph ${icon}" style="font-size:1.1rem"></i>`;
  } catch (e) {
    container.innerHTML = `<span>${dateStr}</span>`;
  }
}


function updateStreakWidget() {
  const container = document.getElementById('streak-count');
  if (!container) return;
  appData.streak = appData.streak || 0;
  container.textContent = appData.streak;
}

async function initTray() {
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('tray-app').style.display = 'flex';

  appData = await window.api.getData();

  // Display next class
  const nextClassEl = document.getElementById('tray-next-class');

  // Filter classes to only show today's and future classes
  const today = new Date();
  const futureClasses = appData.schedule ? appData.schedule.filter(cls => {
    const isVacation = cls.title.toLowerCase().includes('entreprise') || cls.title.toLowerCase().includes('projet tuteuré');
    return new Date(cls.endTime) >= today && !isVacation;
  }) : [];

  if (futureClasses.length > 0) {
    const cls = futureClasses[0];
    const colors = getPastelColor(cls.title);

    const profStr = cls.prof ? `<div><i class="ph ph-user"></i> ${cls.prof}</div>` : '';
    const roomStr = cls.room ? `<div><i class="ph ph-map-pin"></i> ${cls.room}</div>` : '';

    nextClassEl.innerHTML = `
      <div class="class-card" style="background-color: ${colors.bg}; border-color: ${colors.border}; margin: 0;">
        <div class="class-time" style="color: ${colors.text}">${cls.time}</div>
        <div class="class-title" style="color: ${colors.text}">${cls.title}</div>
        <div class="class-details">
          ${profStr}
          ${roomStr}
        </div>
      </div>
    `;
  } else {
    nextClassEl.innerHTML = '<div style="font-weight: 500; font-size: 0.9rem; color:var(--text-primary)">Aucun cours prévu prochainement</div>';
  }
}

function getPastelColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return {
    bg: `hsl(${h}, 60%, 95%)`,
    border: `hsl(${h}, 60%, 80%)`,
    text: `hsl(${h}, 60%, 30%)`
  };
}

function renderSchedule() {
  const container = document.getElementById('schedule-list');
  container.innerHTML = '';

  if ((!appData.schedule || appData.schedule.length === 0) && (!appData.tasks || appData.tasks.length === 0)) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">Rien de prévu !</p>`;
    return;
  }

  const scheduleItemsByDate = {};

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getLocalDateString = (d) => {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const getDayKey = (d) => {
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  // 1. Process Classes
  if (appData.schedule) {
    appData.schedule.forEach(cls => {
      const dStart = new Date(cls.startTime);
      const dEnd = new Date(cls.endTime);
      if (dEnd < now) return;

      const dateKey = getLocalDateString(dStart);
      if (!scheduleItemsByDate[dateKey]) {
        scheduleItemsByDate[dateKey] = {
          dateObj: new Date(dStart.setHours(0, 0, 0, 0)),
          displayDate: getDayKey(dStart),
          classes: [],
          standaloneTasks: []
        };
      }

      cls.attachedTasks = [];
      scheduleItemsByDate[dateKey].classes.push(cls);
    });
  }

  // 2. Process Tasks
  if (appData.tasks) {
    appData.tasks.forEach(task => {
      if (task.completed) return;
      if (!task.date) return;
      const [y, m, d] = task.date.split('-');
      const taskDate = new Date(y, m - 1, d);
      if (taskDate < today) return;

      const dateKey = task.date;
      if (!scheduleItemsByDate[dateKey]) {
        scheduleItemsByDate[dateKey] = {
          dateObj: taskDate,
          displayDate: getDayKey(taskDate),
          classes: [],
          standaloneTasks: []
        };
      }

      let merged = false;
      if (task.subject) {
        const matchingClass = scheduleItemsByDate[dateKey].classes.find(c => c.title === task.subject);
        if (matchingClass) {
          matchingClass.attachedTasks.push(task);
          merged = true;
        }
      }

      if (!merged) {
        scheduleItemsByDate[dateKey].standaloneTasks.push(task);
      }
    });
  }

  const sortedDates = Object.keys(scheduleItemsByDate).sort();

  if (sortedDates.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">Rien de prévu dans le futur !</p>`;
    return;
  }

  for (const dateKey of sortedDates) {
    const dayData = scheduleItemsByDate[dateKey];
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-group';
    dayGroup.innerHTML = `<h3 class="day-header">${dayData.displayDate}</h3>`;

    const allItems = [];
    dayData.classes.forEach(c => allItems.push({ type: 'class', data: c, sortTime: c.startTime }));
    dayData.standaloneTasks.forEach(t => {
      let sortTime = dayData.dateObj.getTime();
      if (t.time) {
        const [h, m] = t.time.split(':');
        sortTime += (parseInt(h) * 60 + parseInt(m)) * 60000;
      }
      allItems.push({ type: 'task', data: t, sortTime });
    });

    allItems.sort((a, b) => a.sortTime - b.sortTime);

    allItems.forEach(item => {
      if (item.type === 'class') {
        const cls = item.data;
        const colors = getPastelColor(cls.title);
        const card = document.createElement('div');
        card.className = 'class-card';
        card.style.backgroundColor = colors.bg;
        card.style.borderColor = colors.border;

        const profStr = cls.prof ? `<div><i class="ph ph-user"></i> ${cls.prof}</div>` : '';
        const roomStr = cls.room ? `<div><i class="ph ph-map-pin"></i> ${cls.room}</div>` : '';

        let attachedTasksHtml = '';
        if (cls.attachedTasks && cls.attachedTasks.length > 0) {
          attachedTasksHtml = `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed ${colors.border}; display:flex; flex-direction:column; gap:0.25rem;">`;
          cls.attachedTasks.forEach(t => {
            let icon = t.type === 'Devoir' ? 'ph-pencil-simple' : (t.type === 'Examen' ? 'ph-file-text' : 'ph-microphone-stage');
            attachedTasksHtml += `<div style="font-size:0.75rem; color:${colors.text}; display:flex; align-items:center; gap:0.25rem;">
               <strong><i class="ph ${icon}"></i> ${t.type}</strong>: ${t.title} ${t.time ? `(${t.time})` : ''}
             </div>`;
          });
          attachedTasksHtml += `</div>`;
        }

        card.innerHTML = `
          <div class="class-time" style="color: ${colors.text}">${cls.time}</div>
          <div class="class-title" style="color: ${colors.text}">${cls.title}</div>
          <div class="class-details">
            ${profStr}
            ${roomStr}
          </div>
          ${attachedTasksHtml}
        `;
        dayGroup.appendChild(card);

      } else {
        const t = item.data;
        const card = document.createElement('div');
        card.className = 'class-card task-card-standalone';
        card.style.backgroundColor = 'transparent';
        card.style.borderColor = 'var(--border-color)';
        card.style.borderStyle = 'dashed';

        let icon = t.type === 'Devoir' ? 'ph-pencil-simple' : (t.type === 'Examen' ? 'ph-file-text' : 'ph-microphone-stage');
        let linkStr = t.link ? `<a href="${t.link}" target="_blank" style="color:var(--accent-color); text-decoration:none;"><i class="ph ph-link"></i> Lien</a>` : '';

        card.innerHTML = `
          <div class="class-time" style="color: var(--text-secondary)">${t.time || 'Toute la journée'}</div>
          <div class="class-title" style="color: var(--text-primary)"><i class="ph ${icon}"></i> ${t.title}</div>
          <div class="class-details" style="display:flex; flex-direction:row; flex-wrap:wrap; gap:0.5rem; align-items:center;">
            <span>${t.type}</span>
            ${t.subject ? `<span style="color:var(--accent-color)"><i class="ph ph-book-open"></i> ${t.subject}</span>` : ''}
            ${linkStr}
          </div>
        `;
        dayGroup.appendChild(card);
      }
    });

    container.appendChild(dayGroup);
  }
  updateVacationTimer();
}

function updateVacationTimer() {
  const container = document.getElementById('header-vacation-widget');
  if (!container || !appData.schedule) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all vacation events
  const vacationEvents = appData.schedule.filter(cls =>
    cls.title.toLowerCase().includes('entreprise') ||
    cls.title.toLowerCase().includes('projet tuteuré')
  );

  if (vacationEvents.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Check if we have one today
  const hasVacationToday = vacationEvents.some(cls => {
    const d = new Date(cls.startTime);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  if (hasVacationToday) {
    container.style.display = 'block';
    container.textContent = 'En vacances !';
    return;
  }

  // Find the next vacation event
  const futureEvents = vacationEvents.filter(cls => {
    const d = new Date(cls.startTime);
    d.setHours(0, 0, 0, 0);
    return d.getTime() > today.getTime();
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (futureEvents.length > 0) {
    const nextDate = new Date(futureEvents[0].startTime);
    nextDate.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(nextDate - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    container.style.display = 'block';
    container.textContent = `J-${diffDays} avant les vacances`;
  } else {
    container.style.display = 'none';
  }
}


function renderTasks() {
  const container = document.getElementById('agenda-list');
  container.innerHTML = '';

  const showCompleted = window.showCompletedTasks || false;

  const filteredTasks = appData.tasks.map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => showCompleted ? true : !t.completed)
    .sort((a, b) => {
      const dateA = a.date || '9999-99-99';
      const dateB = b.date || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.time || '99:99';
      const timeB = b.time || '99:99';
      return timeA.localeCompare(timeB);
    });

  if (filteredTasks.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">${showCompleted ? "Aucune tâche terminée." : "Aucune tâche en cours. Vous êtes à jour !"}</p>`;
    return;
  }

  const formatRelativeDate = (dateStr) => {
    if (!dateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-');
    const taskDate = new Date(y, m - 1, d);
    const diffDays = Math.round((taskDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    if (diffDays === 2) return "Après-demain";
    return `${d}/${m}/${y}`;
  };

  filteredTasks.forEach((task) => {
    const index = task.originalIndex;
    const card = document.createElement('div');
    card.className = task.completed ? 'list-item completed' : 'list-item';
    
    if (!task.completed) {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.title);
      });
      card.title = "Glissez-moi sur le Pomodoro !";
    }

    const displayDate = formatRelativeDate(task.date);

    let linkStr = task.link ? `<a href="${task.link}" target="_blank" style="display:flex; align-items:center; gap:0.2rem; color:var(--accent-color); text-decoration:none;"><i class="ph ph-link"></i> Lien</a>` : '';
    let timeStr = task.time ? `<span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-clock"></i> ${task.time}</span>` : '';
    let subjectStr = task.subject ? `<span style="display:flex; align-items:center; gap:0.2rem; color:var(--accent-color);"><i class="ph ph-book-open"></i> ${task.subject}</span>` : '';

    const iconBtn = task.completed ? 'ph-arrow-u-up-left' : 'ph-check-circle';

    card.innerHTML = `
      <div class="list-item-text" style="flex: 1; padding-right: 1rem;">
        <h3>${task.title}</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
          <span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-tag"></i> ${task.type}</span>
          <span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-calendar-blank"></i> ${displayDate}</span>
          ${timeStr}
          ${subjectStr}
          ${linkStr}
        </div>
      </div>
      <div class="card-actions">
        <button class="action-btn" onclick="toggleTaskCompletion(${index})" style="color:var(--accent-color)" title="${task.completed ? 'Restaurer' : 'Valider'}"><i class="ph-fill ${iconBtn}"></i></button>
        ${!task.completed ? `<button class="action-btn" onclick="editTask(${index})" style="color:var(--text-secondary)" title="Modifier"><i class="ph ph-pencil-simple"></i></button>` : ''}
        ${task.completed ? `<button class="action-btn" onclick="deleteTask(${index})" style="color:var(--danger-color)" title="Supprimer"><i class="ph-fill ph-trash"></i></button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

window.toggleTaskCompletion = async (index) => {
  appData.tasks[index].completed = !appData.tasks[index].completed;
  
  if (appData.tasks[index].completed) {
    appData.streak = (appData.streak || 0) + 1;
    if (confetti) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        zIndex: 10000
      });
    }
  } else {
    appData.streak = Math.max(0, (appData.streak || 0) - 1);
  }
  
  updateStreakWidget();
  
  await window.api.setData('tasks', appData.tasks);
  await window.api.setData('streak', appData.streak);
  renderTasks();
  renderSchedule(); // Also refresh schedule to hide completed tasks
};


window.editTask = (index) => {
  window.editingTaskIndex = index;
  const task = appData.tasks[index];

  document.getElementById('task-title').value = task.title || '';
  document.getElementById('task-type').value = task.type || 'Devoir';
  document.getElementById('task-date').value = task.date || '';
  document.getElementById('task-time').value = task.time || '';
  document.getElementById('task-link').value = task.link || '';

  // Populate subjects before setting value
  const subjectSelect = document.getElementById('task-subject');
  subjectSelect.innerHTML = '<option value="">Aucune</option>';
  if (appData.schedule && appData.schedule.length > 0) {
    const uniqueSubjects = [...new Set(appData.schedule.map(c => c.title))].sort();
    uniqueSubjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      subjectSelect.appendChild(opt);
    });
  }
  subjectSelect.value = task.subject || '';

  document.getElementById('modal-task').querySelector('h2').textContent = 'Modifier la tâche';
  document.getElementById('modal-task').showModal();
};

window.deleteTask = async (index) => {
  appData.tasks.splice(index, 1);
  await window.api.setData('tasks', appData.tasks);
  renderTasks();
  renderSchedule(); // Also refresh schedule
};

function renderLinks() {
  const container = document.getElementById('links-grid');
  container.innerHTML = '';
  if (appData.links.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); font-size: 0.8rem;">Aucun lien.</p>';
    return;
  }

  appData.links.forEach((link, index) => {
    const card = document.createElement('div');
    card.className = 'link-chip';
    card.innerHTML = `
      <span onclick="window.open('${link.url}', '_blank')"><i class="ph ph-globe"></i> ${link.name}</span>
      <button class="action-btn" onclick="deleteLink(${index})" style="margin-left: 0.25rem;"><i class="ph ph-x"></i></button>
    `;
    container.appendChild(card);
  });
}

window.deleteLink = async (index) => {
  appData.links.splice(index, 1);
  await window.api.setData('links', appData.links);
  renderLinks();
};

function setupModals() {
  // ADE Sync Modal
  const modalAde = document.getElementById('modal-ade');
  const btnSyncAde = document.getElementById('btn-sync-ade');

  btnSyncAde.addEventListener('click', async () => {
    const currentUrl = await window.api.getData('adeUrl');
    if (currentUrl) {
      document.getElementById('ade-url').value = currentUrl;
    }
    modalAde.showModal();
  });

  document.getElementById('btn-close-ade').addEventListener('click', () => modalAde.close());
  document.getElementById('form-ade').addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSyncAde.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; // Loading state

    const url = document.getElementById('ade-url').value;
    try {
      const updatedSchedule = await window.api.syncAde(url);

      if (updatedSchedule) {
        appData.schedule = updatedSchedule;
        renderSchedule();
      } else {
        alert("Erreur: Impossible de synchroniser l'emploi du temps avec le lien fourni. Vérifiez le lien ou la console.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur système lors de la synchronisation : " + err.message);
    } finally {
      btnSyncAde.innerHTML = '<i class="ph ph-arrows-clockwise"></i>';
      modalAde.close();
    }
  });

  document.getElementById('btn-toggle-completed').addEventListener('click', (e) => {
    window.showCompletedTasks = !window.showCompletedTasks;
    const icon = e.currentTarget.querySelector('i');
    if (window.showCompletedTasks) {
      icon.className = 'ph ph-eye';
      e.currentTarget.style.color = 'var(--accent-color)';
      e.currentTarget.style.borderColor = 'var(--accent-color)';
    } else {
      icon.className = 'ph ph-eye-slash';
      e.currentTarget.style.color = '';
      e.currentTarget.style.borderColor = '';
    }
    renderTasks();
  });

  // Task Modal
  const modalTask = document.getElementById('modal-task');
  document.getElementById('btn-add-task').addEventListener('click', () => {
    // Populate subjects from schedule
    const subjectSelect = document.getElementById('task-subject');
    subjectSelect.innerHTML = '<option value="">Aucune</option>';

    if (appData.schedule && appData.schedule.length > 0) {
      const uniqueSubjects = [...new Set(appData.schedule.map(c => c.title))].sort();
      uniqueSubjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        subjectSelect.appendChild(opt);
      });
    }

    window.editingTaskIndex = null;
    document.getElementById('form-task').reset();
    document.getElementById('modal-task').querySelector('h2').textContent = 'Nouvelle tâche';
    modalTask.showModal();
  });
  document.getElementById('btn-close-task').addEventListener('click', () => {
    window.editingTaskIndex = null;
    document.getElementById('form-task').reset();
    document.getElementById('modal-task').querySelector('h2').textContent = 'Nouvelle tâche';
    modalTask.close();
  });
  document.getElementById('form-task').addEventListener('submit', async (e) => {
    const title = document.getElementById('task-title').value;
    const type = document.getElementById('task-type').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;
    const link = document.getElementById('task-link').value;
    const subject = document.getElementById('task-subject').value;
    if (typeof window.editingTaskIndex === 'number') {
      appData.tasks[window.editingTaskIndex] = { ...appData.tasks[window.editingTaskIndex], title, type, date, time, link, subject };
      window.editingTaskIndex = null;
    } else {
      appData.tasks.push({ title, type, date, time, link, subject });
    }
    await window.api.setData('tasks', appData.tasks);
    renderTasks();
    renderSchedule(); // Also refresh schedule to show the new task
    e.target.reset();
  });

  // Link Modal
  const modalLink = document.getElementById('modal-link');
  document.getElementById('btn-add-link').addEventListener('click', () => modalLink.showModal());
  document.getElementById('btn-close-link').addEventListener('click', () => modalLink.close());
  document.getElementById('form-link').addEventListener('submit', async (e) => {
    const name = document.getElementById('link-name').value;
    const url = document.getElementById('link-url').value;
    appData.links.push({ name, url });
    await window.api.setData('links', appData.links);
    renderLinks();
    e.target.reset();
  });
}

// Pomodoro State
let pomoInterval;
let pomoTimeLeft = 25 * 60; // 25 minutes
let isPomoRunning = false;

function setupPomodoro() {
  const display = document.getElementById('pomodoro-time');
  const btnStart = document.getElementById('btn-pomo-start');
  const btnPause = document.getElementById('btn-pomo-pause');
  const btnReset = document.getElementById('btn-pomo-reset');

  const pomoCard = display.closest('.module-card');
  
  let pomoTitle = document.getElementById('pomo-task-title');
  if (!pomoTitle) {
    pomoTitle = document.createElement('div');
    pomoTitle.id = 'pomo-task-title';
    pomoTitle.style.fontSize = '0.9rem';
    pomoTitle.style.color = 'var(--accent-color)';
    pomoTitle.style.fontWeight = '500';
    pomoTitle.style.display = 'none';
    pomoTitle.style.justifyContent = 'center';
    pomoTitle.style.alignItems = 'center';
    pomoTitle.style.gap = '0.5rem';
    pomoTitle.style.marginBottom = '0.5rem';
    display.parentNode.insertBefore(pomoTitle, display);

    pomoCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      pomoCard.style.boxShadow = '0 0 0 2px var(--accent-color) inset';
    });
    
    pomoCard.addEventListener('dragleave', () => {
      pomoCard.style.boxShadow = '';
    });
    
    pomoCard.addEventListener('drop', (e) => {
      e.preventDefault();
      pomoCard.style.boxShadow = '';
      const taskName = e.dataTransfer.getData('text/plain');
      if (taskName) {
        pomoTitle.innerHTML = `
          <i class="ph ph-target"></i> 
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">En cours : <strong>${taskName}</strong></span>
          <button id="btn-cancel-pomo-task" class="btn-icon" style="padding:0; min-height:0; width:auto; height:auto; color:var(--danger-color); margin-left:0.5rem;"><i class="ph ph-x"></i></button>
        `;
        pomoTitle.style.display = 'flex';
        
        document.getElementById('btn-cancel-pomo-task').addEventListener('click', () => {
          pomoTitle.style.display = 'none';
          pomoTitle.innerHTML = '';
        });
      }
    });
  }

  const updateDisplay = () => {
    const minutes = Math.floor(pomoTimeLeft / 60);
    const seconds = pomoTimeLeft % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  btnStart.addEventListener('click', () => {
    if (isPomoRunning) return;
    isPomoRunning = true;
    pomoInterval = setInterval(() => {
      if (pomoTimeLeft > 0) {
        pomoTimeLeft--;
        updateDisplay();
      } else {
        clearInterval(pomoInterval);
        isPomoRunning = false;
        // Native notification can be added here
        new Notification("Pomodoro Terminé", { body: "C'est l'heure d'une pause !" });
      }
    }, 1000);
  });

  btnPause.addEventListener('click', () => {
    clearInterval(pomoInterval);
    isPomoRunning = false;
  });

  btnReset.addEventListener('click', () => {
    clearInterval(pomoInterval);
    isPomoRunning = false;
    pomoTimeLeft = 25 * 60;
    updateDisplay();
  });

  updateDisplay();
}

// Ensure init is called after DOM load if defer is used, or just call it:
if (isTrayWindow) {
  initTray();
} else {
  init();
}
