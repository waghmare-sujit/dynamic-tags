#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const files = [
  'package.json',
  'manifest.json',
  'versions.json'
];

const currentVersion = '1.7.1';
const newVersion = '1.7.1.1';

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    new RegExp(`"version"\\s*:\\s*"${currentVersion.replace(/\./g, '\\.')}"`, 'g'),
    `"version": "${newVersion}"`
  );

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✓ Bumped ${file}`);
  } else {
    console.log(`⚠ No version found in ${file}`);
  }
}

console.log(`\nVersion bumped: ${currentVersion} → ${newVersion}`);
