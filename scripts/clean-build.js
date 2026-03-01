const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';
const pkg = require('../package.json');
const releaseDir = path.join(__dirname, '..', pkg.build?.directories?.output || 'release');

// Kill any stale Flip Browser / Electron processes holding file locks
if (isWin) {
  const killTargets = ['Flip Browser.exe'];
  for (const target of killTargets) {
    try { execSync(`taskkill /F /IM "${target}" 2>nul`, { stdio: 'ignore' }); } catch {}
  }
  // Also kill any process whose path contains our release folder
  try {
    const ps = `Get-Process | Where-Object { $_.Path -like '*${releaseDir.replace(/\\/g, '\\\\')}*' } | Stop-Process -Force 2>$null`;
    execSync(`powershell -Command "${ps}"`, { stdio: 'ignore' });
  } catch {}
  // Wait for handles to release
  execSync('ping -n 3 127.0.0.1 >nul', { stdio: 'ignore' });
} else {
  // macOS/Linux — kill stale Electron processes
  try { execSync("pkill -f 'Flip Browser' 2>/dev/null", { stdio: 'ignore' }); } catch {}
  try { execSync("pkill -f 'electron' 2>/dev/null", { stdio: 'ignore' }); } catch {}
  // Brief wait for handles to release
  execSync('sleep 2', { stdio: 'ignore' });
}

// Try to clean the release folder
if (fs.existsSync(releaseDir)) {
  try {
    fs.rmSync(releaseDir, { recursive: true, force: true });
    console.log('[Build] Cleaned release folder');
  } catch (e) {
    if (isWin) {
      // If still locked, try the nuclear option — open cmd to force-delete
      try {
        execSync(`cmd /c "rmdir /s /q "${releaseDir}""`, { stdio: 'ignore' });
        if (!fs.existsSync(releaseDir)) {
          console.log('[Build] Cleaned release folder (cmd)');
        } else {
          throw new Error('still exists');
        }
      } catch (e2) {
        // Last resort: modify output dir to avoid the lock
        const altDir = releaseDir + '-' + Date.now();
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        pkgData.build.directories.output = path.basename(altDir);
        fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n');
        // Auto-restore on unexpected exit so package.json isn't left dirty
        process.on('exit', () => {
          try {
            const cur = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (cur.build?.directories?.output !== 'release') {
              cur.build.directories.output = 'release';
              fs.writeFileSync(pkgPath, JSON.stringify(cur, null, 2) + '\n');
            }
          } catch {}
        });
        console.log(`[Build] Release folder locked — redirecting build to ${path.basename(altDir)}`);
        console.log('[Build] A reboot will clear the stale lock. Run "npm run build" again after to use the normal folder.');
      }
    } else {
      // macOS/Linux — try rm -rf
      try { execSync(`rm -rf "${releaseDir}"`, { stdio: 'ignore' }); } catch {}
      console.log('[Build] Cleaned release folder (rm -rf)');
    }
  }
} else {
  console.log('[Build] Release folder clean');
}
