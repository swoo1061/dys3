const { app, Tray, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const cron = require('node-cron');
const notifier = require('node-notifier');
const { exec } = require('child_process');
const fs = require('fs');

const store = new Store();
let tray = null;
let serverProcess = null;
let isServerRunning = false;

// 서버 상태 확인 함수
function checkServerStatus() {
  return new Promise((resolve) => {
    exec('netstat -ano | findstr :3000', (error, stdout) => {
      resolve(stdout.includes('LISTENING'));
    });
  });
}

// 경로 정규화 함수
function normalizePath(filePath) {
  return path.normalize(filePath.replace(/\\/g, '/'));
}

// 서버 시작 함수
async function startServer() {
  if (isServerRunning) return;

  const serverPath = store.get('serverPath');
  if (!serverPath) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'DYS3 서버 폴더 선택'
    });

    if (!result.canceled) {
      const normalizedPath = normalizePath(result.filePaths[0]);
      store.set('serverPath', normalizedPath);
      return startServer();
    }
    return;
  }

  try {
    // 백업 폴더 생성
    const backupPath = path.join(serverPath, 'backups');
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath);
    }

    // 서버 시작
    serverProcess = exec('npm run dev', { 
      cwd: serverPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        PORT: '3000'
      }
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(data);
      if (data.includes('ready') || data.includes('started server')) {
        isServerRunning = true;
        updateTrayIcon();
        notifier.notify({
          title: 'DYS3 서버',
          message: '서버가 시작되었습니다.',
          icon: path.join(__dirname, 'assets/icon.png')
        });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data);
      if (data.includes('error')) {
        notifier.notify({
          title: 'DYS3 서버',
          message: '서버 시작 중 오류가 발생했습니다.',
          icon: path.join(__dirname, 'assets/icon.png')
        });
      }
    });

    serverProcess.on('close', (code) => {
      console.log(`서버 프로세스 종료 코드: ${code}`);
      isServerRunning = false;
      updateTrayIcon();
    });

    // 서버 시작 후 5초 후에 상태 확인
    setTimeout(async () => {
      const status = await checkServerStatus();
      if (!status) {
        console.log('서버가 정상적으로 시작되지 않았습니다.');
        notifier.notify({
          title: 'DYS3 서버',
          message: '서버가 정상적으로 시작되지 않았습니다.',
          icon: path.join(__dirname, 'assets/icon.png')
        });
      }
    }, 5000);

  } catch (error) {
    console.error('서버 시작 중 오류:', error);
    notifier.notify({
      title: 'DYS3 서버',
      message: '서버 시작 중 오류가 발생했습니다.',
      icon: path.join(__dirname, 'assets/icon.png')
    });
  }
}

// 서버 중지 함수
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    isServerRunning = false;
    updateTrayIcon();
    notifier.notify({
      title: 'DYS3 서버',
      message: '서버가 중지되었습니다.',
      icon: path.join(__dirname, 'assets/icon.png')
    });
  }
}

// 백업 생성 함수
async function createBackup() {
  const serverPath = store.get('serverPath');
  if (!serverPath) return;

  try {
    const backupPath = path.join(serverPath, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(backupPath, `backup-${timestamp}`);

    fs.mkdirSync(backupFolder);

    // data 폴더 복사
    const dataPath = path.join(serverPath, 'data');
    if (fs.existsSync(dataPath)) {
      fs.cpSync(dataPath, path.join(backupFolder, 'data'), { recursive: true });
    }

    notifier.notify({
      title: 'DYS3 서버',
      message: '백업이 생성되었습니다.',
      icon: path.join(__dirname, 'assets/icon.png')
    });
  } catch (error) {
    console.error('백업 생성 중 오류:', error);
    notifier.notify({
      title: 'DYS3 서버',
      message: '백업 생성 중 오류가 발생했습니다.',
      icon: path.join(__dirname, 'assets/icon.png')
    });
  }
}

// 트레이 아이콘 업데이트
function updateTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (tray) {
    tray.setImage(iconPath);
  }
}

// 트레이 메뉴 생성
function createTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: isServerRunning ? '서버 중지' : '서버 시작',
      click: () => {
        if (isServerRunning) {
          stopServer();
        } else {
          startServer();
        }
      }
    },
    {
      label: '백업 생성',
      click: createBackup
    },
    {
      label: '서버 경로 변경',
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'DYS3 서버 폴더 선택'
        });

        if (!result.canceled) {
          const normalizedPath = normalizePath(result.filePaths[0]);
          store.set('serverPath', normalizedPath);
          if (isServerRunning) {
            stopServer();
            startServer();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        stopServer();
        app.quit();
      }
    }
  ]);
}

// 앱 초기화
app.whenReady().then(() => {
  // 트레이 아이콘 생성
  tray = new Tray(path.join(__dirname, 'assets/icon.png'));
  tray.setToolTip('DYS3 서버 관리자');
  
  // 트레이 메뉴 설정
  tray.setContextMenu(createTrayMenu());
  
  // 클릭 이벤트
  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  // 자동 백업 스케줄 (매일 자정)
  cron.schedule('0 0 * * *', createBackup);

  // 서버 상태 주기적 확인 (1분마다)
  setInterval(async () => {
    const status = await checkServerStatus();
    if (status !== isServerRunning) {
      isServerRunning = status;
      updateTrayIcon();
    }
  }, 60000);

  // 서버 자동 시작
  startServer();
});

// 앱 종료 시 서버 중지
app.on('before-quit', () => {
  stopServer();
}); 