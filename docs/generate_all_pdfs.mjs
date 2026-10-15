import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const files = [
  'HOW_TO_BUILD_A_CONTINUOUS_SCROLL_FILM_WEBSITE',
  'PIVOINE_SCROLL_FILM_MASTERCLASS'
];

for (const f of files) {
  const htmlFile = path.resolve(`${f}.html`);
  const pdfFile = path.resolve(`${f}.pdf`);
  if (fs.existsSync(htmlFile)) {
    console.log(`Generating ${pdfFile}...`);
    execFileSync(browserPath, [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfFile}`,
      htmlFile
    ]);
    const stats = fs.statSync(pdfFile);
    console.log(`✅ ${f}.pdf generated (${(stats.size / 1024).toFixed(1)} KB)`);
  }
}
