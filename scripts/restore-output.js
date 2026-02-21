const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const current = pkg.build?.directories?.output;

if (current && current !== 'release') {
  pkg.build.directories.output = 'release';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[Build] Restored output dir from "${current}" back to "release"`);
}
