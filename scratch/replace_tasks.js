import fs from 'fs';
import path from 'path';

const file = path.resolve('src/renderer.js');
let code = fs.readFileSync(file, 'utf-8');

const newRenderTasks = `
function renderTasks() {
  const container = document.getElementById('agenda-list');
  container.innerHTML = '';
  
  const showCompleted = document.getElementById('toggle-completed-tasks').checked;
  
  const filteredTasks = appData.tasks.map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => showCompleted ? true : !t.completed);

  if (filteredTasks.length === 0) {
    container.innerHTML = \`<p style="color:var(--text-secondary); font-size: 0.9rem; padding: 1rem; text-align: center;">\${showCompleted ? "Aucune tâche terminée." : "Aucune tâche en cours. Vous êtes à jour !"}</p>\`;
    return;
  }
  
  filteredTasks.forEach((task) => {
    const index = task.originalIndex;
    const card = document.createElement('div');
    card.className = task.completed ? 'list-item completed' : 'list-item';
    
    let linkStr = task.link ? \`<a href="\${task.link}" target="_blank" style="display:flex; align-items:center; gap:0.2rem; color:var(--accent-color); text-decoration:none;"><i class="ph ph-link"></i> Lien</a>\` : '';
    let timeStr = task.time ? \`<span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-clock"></i> \${task.time}</span>\` : '';
    let subjectStr = task.subject ? \`<span style="display:flex; align-items:center; gap:0.2rem; color:var(--accent-color);"><i class="ph ph-book-open"></i> \${task.subject}</span>\` : '';
    
    const iconBtn = task.completed ? 'ph-arrow-u-up-left' : 'ph-check-circle';
    
    card.innerHTML = \`
      <div class="list-item-text" style="flex: 1; padding-right: 1rem;">
        <h3>\${task.title}</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
          <span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-tag"></i> \${task.type}</span>
          <span style="display:flex; align-items:center; gap:0.2rem;"><i class="ph ph-calendar-blank"></i> \${task.date}</span>
          \${timeStr}
          \${subjectStr}
          \${linkStr}
        </div>
      </div>
      <div class="card-actions">
        <button class="action-btn" onclick="toggleTaskCompletion(\${index})" style="color:var(--accent-color)" title="\${task.completed ? 'Restaurer' : 'Valider'}"><i class="ph-fill \${iconBtn}"></i></button>
        \${task.completed ? \`<button class="action-btn" onclick="deleteTask(\${index})" style="color:var(--danger-color)" title="Supprimer"><i class="ph-fill ph-trash"></i></button>\` : ''}
      </div>
    \`;
    container.appendChild(card);
  });
}

window.toggleTaskCompletion = async (index) => {
  appData.tasks[index].completed = !appData.tasks[index].completed;
  await window.api.setData('tasks', appData.tasks);
  renderTasks();
  renderSchedule(); // Also refresh schedule to hide completed tasks
};

window.deleteTask = async (index) => {
  appData.tasks.splice(index, 1);
  await window.api.setData('tasks', appData.tasks);
  renderTasks();
  renderSchedule(); // Also refresh schedule
};
`;

const oldFnStart = code.indexOf('function renderTasks() {');
const oldFnEnd = code.indexOf('function renderLinks() {');
const newCode = code.substring(0, oldFnStart) + newRenderTasks + '\n' + code.substring(oldFnEnd);
fs.writeFileSync(file, newCode);

// Add event listener to toggle
let newCode2 = fs.readFileSync(file, 'utf-8');
const toggleCode = `
  document.getElementById('toggle-completed-tasks').addEventListener('change', renderTasks);
`;
const insertIdx = newCode2.indexOf('// Task Modal');
newCode2 = newCode2.substring(0, insertIdx) + toggleCode + '\n  ' + newCode2.substring(insertIdx);
fs.writeFileSync(file, newCode2);

console.log('done');
