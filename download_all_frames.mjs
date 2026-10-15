import fs from 'fs';
import path from 'path';

const outDir = path.resolve('pivoine/frames');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const pad = (n) => String(n).padStart(4, '0');
const totalFrames = 718; // The FULL 718-frame reel

async function downloadFrame(i) {
  const file = `f_${pad(i)}.webp`;
  const filePath = path.join(outDir, file);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 2000) return;

  const url = `frames/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  } catch (err) {
    // Retry once
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      }
    } catch (_) {}
  }
}

async function run() {
  console.log(`Downloading all ${totalFrames} frames of the complete film...`);
  const concurrency = 25;
  for (let i = 1; i <= totalFrames; i += concurrency) {
    const batch = [];
    for (let j = i; j < i + concurrency && j <= totalFrames; j++) {
      batch.push(downloadFrame(j));
    }
    await Promise.all(batch);
    process.stdout.write(`\rDownloaded frames: ${Math.min(i + concurrency - 1, totalFrames)}/${totalFrames}`);
  }
  console.log('\n✅ All 718 frames downloaded successfully!');
}

run();
