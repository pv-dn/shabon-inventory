const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// ライフ伝票と同じ考え方: デスクトップ版は Web 版を表示する箱。
// データはしゃぼん玉専用 Supabase（店舗と共有）。
const WEB_APP_URL = "https://pv-dn.github.io/shabon-inventory/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "しゃぼん玉石けん 在庫管理",
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(WEB_APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
