import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const possibleBrowsers = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
];

let browserPath = null;
for (const p of possibleBrowsers) {
  if (fs.existsSync(p)) {
    browserPath = p;
    break;
  }
}

if (!browserPath) {
  console.error('No Chrome or Edge browser executable found on system paths.');
  process.exit(1);
}

console.log('Found browser:', browserPath);

const htmlFile = path.resolve('HOW_TO_BUILD_A_CONTINUOUS_SCROLL_FILM_WEBSITE.html');
const pdfFile = path.resolve('HOW_TO_BUILD_A_CONTINUOUS_SCROLL_FILM_WEBSITE.pdf');

console.log('Converting HTML to PDF...');
try {
  execFileSync(browserPath, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfFile}`,
    htmlFile
  ], { stdio: 'inherit' });

  if (fs.existsSync(pdfFile)) {
    const stats = fs.statSync(pdfFile);
    console.log(`\n🎉 PDF GENERATED SUCCESSFULLY!`);
    console.log(`File: ${pdfFile}`);
    console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
  }
} catch (err) {
  console.error('Error executing browser headless print:', err);
}
