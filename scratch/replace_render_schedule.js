import fs from 'fs';
import path from 'path';

const file = path.resolve('src/renderer.js');
let code = fs.readFileSync(file, 'utf-8');

const newRenderSchedule = `function renderSchedule() {
  const container = document.getElementById('schedule-list');
  container.innerHTML = '';
  
  if ((!appData.schedule || appData.schedule.length === 0) && (!appData.tasks || appData.tasks.length === 0)) {
    container.innerHTML = \`<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">Rien de prévu !</p>\`;
    return;
  }
  
  const scheduleItemsByDate = {};
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const getLocalDateString = (d) => {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };
  
  const getDayKey = (d) => {
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  // 1. Process Classes
  if (appData.schedule) {
    appData.schedule.forEach(cls => {
      const d = new Date(cls.startTime);
      if (d < today) return;
      
      const dateKey = getLocalDateString(d);
      if (!scheduleItemsByDate[dateKey]) {
        scheduleItemsByDate[dateKey] = {
          dateObj: new Date(d.setHours(0,0,0,0)),
          displayDate: getDayKey(d),
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
      if (!task.date) return;
      const [y, m, d] = task.date.split('-');
      const taskDate = new Date(y, m-1, d);
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
    container.innerHTML = \`<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">Rien de prévu dans le futur !</p>\`;
    return;
  }
  
  for (const dateKey of sortedDates) {
    const dayData = scheduleItemsByDate[dateKey];
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-group';
    dayGroup.innerHTML = \`<h3 class="day-header">\${dayData.displayDate}</h3>\`;
    
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
        
        const profStr = cls.prof ? \`<div><i class="ph ph-user"></i> \${cls.prof}</div>\` : '';
        const roomStr = cls.room ? \`<div><i class="ph ph-map-pin"></i> \${cls.room}</div>\` : '';
        
        let attachedTasksHtml = '';
        if (cls.attachedTasks && cls.attachedTasks.length > 0) {
          attachedTasksHtml = \`<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed \${colors.border}; display:flex; flex-direction:column; gap:0.25rem;">\`;
          cls.attachedTasks.forEach(t => {
             let icon = t.type === 'Devoir' ? 'ph-pencil-simple' : (t.type === 'Examen' ? 'ph-file-text' : 'ph-microphone-stage');
             attachedTasksHtml += \`<div style="font-size:0.75rem; color:\${colors.text}; display:flex; align-items:center; gap:0.25rem;">
               <strong><i class="ph \${icon}"></i> \${t.type}</strong>: \${t.title} \${t.time ? \`(\${t.time})\` : ''}
             </div>\`;
          });
          attachedTasksHtml += \`</div>\`;
        }
        
        card.innerHTML = \`
          <div class="class-time" style="color: \${colors.text}">\${cls.time}</div>
          <div class="class-title" style="color: \${colors.text}">\${cls.title}</div>
          <div class="class-details">
            \${profStr}
            \${roomStr}
          </div>
          \${attachedTasksHtml}
        \`;
        dayGroup.appendChild(card);
        
      } else {
        const t = item.data;
        const card = document.createElement('div');
        card.className = 'class-card task-card-standalone';
        card.style.backgroundColor = 'transparent';
        card.style.borderColor = 'var(--border-color)';
        card.style.borderStyle = 'dashed';
        
        let icon = t.type === 'Devoir' ? 'ph-pencil-simple' : (t.type === 'Examen' ? 'ph-file-text' : 'ph-microphone-stage');
        let linkStr = t.link ? \`<a href="\${t.link}" target="_blank" style="color:var(--accent-color); text-decoration:none;"><i class="ph ph-link"></i> Lien</a>\` : '';
        
        card.innerHTML = \`
          <div class="class-time" style="color: var(--text-secondary)">\${t.time || 'Toute la journée'}</div>
          <div class="class-title" style="color: var(--text-primary)"><i class="ph \${icon}"></i> \${t.title}</div>
          <div class="class-details" style="display:flex; flex-direction:row; flex-wrap:wrap; gap:0.5rem; align-items:center;">
            <span>\${t.type}</span>
            \${t.subject ? \`<span style="color:var(--accent-color)"><i class="ph ph-book-open"></i> \${t.subject}</span>\` : ''}
            \${linkStr}
          </div>
        \`;
        dayGroup.appendChild(card);
      }
    });
    
    container.appendChild(dayGroup);
  }
}`

const oldFnStart = code.indexOf('function renderSchedule() {');
const oldFnEnd = code.indexOf('function renderTasks() {');
const newCode = code.substring(0, oldFnStart) + newRenderSchedule + '\n\n' + code.substring(oldFnEnd);
fs.writeFileSync(file, newCode);
console.log('done');
