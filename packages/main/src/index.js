import { app } from 'electron';
import './security-restrictions';
import { restoreOrCreateWindow } from '/@/mainWindow';

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
	app.quit();
	process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

app.disableHardwareAcceleration();

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', restoreOrCreateWindow);

const { Notification, ipcMain } = require('electron');
ipcMain.on('notification', (event, args) => {
	let notification = new Notification({ title: args.title, body: args.body });
	notification.show();
});
app.whenReady()
	.then(restoreOrCreateWindow)
	.catch((e) => console.error('Failed create window:', e));
if (import.meta.env.PROD) {
	app.whenReady()
		.then(() => import('electron-updater'))
		.then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
		.catch((e) => console.error('Failed check updates:', e));
}
