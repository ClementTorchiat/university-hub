import fs from 'fs';
import path from 'path';

const file = path.resolve('src/renderer.js');
let code = fs.readFileSync(file, 'utf-8');

// Add editTask button to renderTasks
code = code.replace(
  '<button class="action-btn" onclick="toggleTaskCompletion(${index})" style="color:var(--accent-color)" title="${task.completed ? \'Restaurer\' : \'Valider\'}"><i class="ph-fill ${iconBtn}"></i></button>',
  `<button class="action-btn" onclick="toggleTaskCompletion(\${index})" style="color:var(--accent-color)" title="\${task.completed ? 'Restaurer' : 'Valider'}"><i class="ph-fill \${iconBtn}"></i></button>
        \${!task.completed ? \`<button class="action-btn" onclick="editTask(\${index})" style="color:var(--text-secondary)" title="Modifier"><i class="ph ph-pencil-simple"></i></button>\` : ''}`
);

// Add editTask function
const editTaskFn = `
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
`;

code = code.replace(
  'window.deleteTask = async (index) => {',
  editTaskFn + '\nwindow.deleteTask = async (index) => {'
);

// Update submit handler
code = code.replace(
  "appData.tasks.push({ title, type, date, time, link, subject });",
  `if (typeof window.editingTaskIndex === 'number') {
      appData.tasks[window.editingTaskIndex] = { ...appData.tasks[window.editingTaskIndex], title, type, date, time, link, subject };
      window.editingTaskIndex = null;
    } else {
      appData.tasks.push({ title, type, date, time, link, subject });
    }`
);

// Reset modal state on close
code = code.replace(
  "document.getElementById('btn-close-task').addEventListener('click', () => modalTask.close());",
  `document.getElementById('btn-close-task').addEventListener('click', () => {
    window.editingTaskIndex = null;
    document.getElementById('form-task').reset();
    document.getElementById('modal-task').querySelector('h2').textContent = 'Nouvelle tâche';
    modalTask.close();
  });`
);

// Reset modal state on add
code = code.replace(
  "modalTask.showModal();",
  `window.editingTaskIndex = null;
    document.getElementById('form-task').reset();
    document.getElementById('modal-task').querySelector('h2').textContent = 'Nouvelle tâche';
    modalTask.showModal();`
);

fs.writeFileSync(file, code);
console.log('done');
