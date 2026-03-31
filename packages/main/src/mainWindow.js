import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { URL } from 'url';

async function createWindow() {
	const browserWindow = new BrowserWindow({
		show: false,
		backgroundColor: '#090909',
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false,
			webviewTag: false,
			preload: join(app.getAppPath(), 'packages/preload/dist/index.cjs'),
		},
	});
	browserWindow.on('ready-to-show', () => {
		browserWindow?.show();

		if (import.meta.env.DEV) {
			browserWindow?.webContents.openDevTools({
				mode: 'undocked',
			});
		}
	});

	const pageUrl =
		import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
			? import.meta.env.VITE_DEV_SERVER_URL
			: new URL(
					'../renderer/dist/index.html',
					'file://' + __dirname
			  ).toString();

	await browserWindow.loadURL(pageUrl);

	return browserWindow;
}

export async function restoreOrCreateWindow() {
	let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

	if (window === undefined) {
		window = await createWindow();
	}

	if (window.isMinimized()) {
		window.restore();
	}

	window.focus();
}
