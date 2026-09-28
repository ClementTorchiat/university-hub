import { app, BrowserWindow, Tray, Menu, nativeImage, screen, Notification } from 'electron';
import path from 'node:path';
import { ipcMain } from 'electron';
import { DataStore } from './dataStore.js';
import { fetchADESchedule } from './icalParser.js';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray = null;
let trayWindow = null;
let mainWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset', // Mac-specific native feel
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Set dock icon explicitly on macOS if the file exists
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(path.join(__dirname, '../../assets/icon.png'));
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize Data Store
  const store = new DataStore({
    configName: 'user-preferences',
    defaults: {
      schedule: [],
      tasks: [],
      notes: '',
      links: []
    }
  });

  ipcMain.handle('get-data', (event, key) => {
    return key ? store.get(key) : store.getAll();
  });

  ipcMain.handle('set-data', (event, key, val) => {
    store.set(key, val);
    return true;
  });

  ipcMain.handle('sync-ade', async (event, url) => {
    if (!url) {
      url = store.get('adeUrl');
    } else {
      store.set('adeUrl', url);
    }

    if (!url) return null; // No URL provided or stored

    const schedule = await fetchADESchedule(url);
    if (schedule) {
      store.set('schedule', schedule);
    }
    return schedule; // Return to UI
  });

  // Background Tasks
  const notifiedEvents = new Set();

  setInterval(() => {
    const now = new Date();
    const schedule = store.get('schedule') || [];
    const tasks = store.get('tasks') || [];

    // a. Upcoming class (15 mins)
    for (const cls of schedule) {
      const clsTime = new Date(cls.startTime).getTime();
      const diffMins = Math.floor((clsTime - now.getTime()) / 60000);

      if (diffMins === 15 || diffMins === 14) { // small margin for exact minute
        const id = cls.title + cls.startTime;
        if (!notifiedEvents.has(id)) {
          new Notification({
            title: 'Cours dans 15 minutes',
            body: `${cls.title} en salle ${cls.room || 'Inconnue'}`
          }).show();
          notifiedEvents.add(id);
        }
      }
    }

    // b. Homework reminder (8 PM)
    if (now.getHours() === 20 && now.getMinutes() === 0) {
      const id = 'homework-' + now.toDateString();
      if (!notifiedEvents.has(id)) {
        // Check for tasks due tomorrow
        const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
        const pendingTasks = tasks.filter(t => !t.completed && t.date === tomorrowStr);

        if (pendingTasks.length > 0) {
          new Notification({
            title: 'Devoirs pour demain',
            body: `Vous avez ${pendingTasks.length} tâche(s) non complétée(s) pour demain !`
          }).show();
        }
        notifiedEvents.add(id);
      }
    }
  }, 60000); // Check every minute

  // Background Sync (Every hour)
  setInterval(async () => {
    const url = store.get('adeUrl');
    if (url) {
      try {
        const newSchedule = await fetchADESchedule(url);
        if (newSchedule) {
          store.set('schedule', newSchedule);
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('schedule-updated');
          });
        }
      } catch (err) {
        console.error("Background sync failed:", err);
      }
    }
  }, 3600000); // 1 hour

  createWindow();
  createTray();

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    }
  });
});

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets/tray-iconTemplate.png')
    : path.join(__dirname, '../../assets/tray-iconTemplate.png');
  let icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 16, height: 16 });
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('University Hub');

  trayWindow = new BrowserWindow({
    width: 300,
    height: 200,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    trayWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?tray=true`);
  } else {
    trayWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { query: { tray: 'true' } });
  }

  // Hide the window when it loses focus
  trayWindow.on('blur', () => {
    if (!trayWindow.webContents.isDevToolsOpened()) {
      trayWindow.hide();
    }
  });

  tray.on('click', (event, bounds) => {
    toggleTrayWindow(bounds);
  });
}

function toggleTrayWindow(bounds) {
  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    // Position the window below the tray icon
    const { x, y } = bounds;
    const { width, height } = trayWindow.getBounds();
    // Assuming macOS menu bar is at top
    trayWindow.setBounds({
      x: Math.floor(x - (width / 2) + (bounds.width / 2)),
      y: y + bounds.height,
      width,
      height
    });
    trayWindow.show();
    trayWindow.focus();
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
