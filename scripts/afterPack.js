const { flipFuses, FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName || process.platform;
  let electronBinaryPath;

  if (platform === 'darwin') {
    // macOS: binary is inside the .app bundle
    electronBinaryPath = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      'Contents', 'MacOS', context.packager.appInfo.productFilename
    );
  } else {
    const ext = platform === 'win32' ? '.exe' : '';
    electronBinaryPath = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}${ext}`
    );
  }

  console.log(`[Fuses] Flipping fuses on: ${electronBinaryPath}`);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,

    // Disable ELECTRON_RUN_AS_NODE — prevents using the app binary as a plain Node.js runtime
    [FuseV1Options.RunAsNode]: false,

    // Disable NODE_OPTIONS env var — prevents injecting debug flags or custom modules
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,

    // Disable --inspect / --inspect-brk CLI args — prevents remote debugging in production
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Enable ASAR integrity validation — app refuses to start if asar is tampered
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,

    // Only load app from asar — prevents sideloading loose JS files
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  console.log('[Fuses] All fuses flipped successfully');
};
