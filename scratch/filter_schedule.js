import fs from 'fs';
import path from 'path';

const file = path.resolve('src/renderer.js');
let code = fs.readFileSync(file, 'utf-8');

// Inside renderSchedule, there's: appData.tasks.forEach(task => {
// We want to add: if (task.completed) return;
code = code.replace(
  "appData.tasks.forEach(task => {",
  "appData.tasks.forEach(task => {\n      if (task.completed) return;"
);

fs.writeFileSync(file, code);
console.log('done');
