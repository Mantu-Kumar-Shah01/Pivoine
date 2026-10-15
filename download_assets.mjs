import fs from 'fs';
import path from 'path';

const outDir = path.resolve('pivoine/frames');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const pad = (n) => String(n).padStart(4, '0');
const totalFrames = 120; // 120 frames gives an ultra smooth fluid scroll showcase

async function downloadFrame(i) {
  const file = `f_${pad(i)}.webp`;
  const filePath = path.join(outDir, file);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) return;

  const url = `frames/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  } catch (err) {
    console.error(`Error downloading ${file}:`, err.message);
  }
}

async function run() {
  console.log(`Downloading ${totalFrames} frames...`);
  const concurrency = 15;
  for (let i = 1; i <= totalFrames; i += concurrency) {
    const batch = [];
    for (let j = i; j < i + concurrency && j <= totalFrames; j++) {
      batch.push(downloadFrame(j));
    }
    await Promise.all(batch);
    process.stdout.write(`\rProgress: ${Math.min(i + concurrency - 1, totalFrames)}/${totalFrames}`);
  }
  console.log('\nDone downloading frames!');
}

run();
