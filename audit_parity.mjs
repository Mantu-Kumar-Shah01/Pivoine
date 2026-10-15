import fs from 'fs';
import path from 'path';

async function verify() {
  const frames = fs.readdirSync('pivoine/frames').filter(f => f.endsWith('.webp'));
  const catalog = fs.readdirSync('pivoine/catalog').filter(f => f.endsWith('.webp'));
  
  console.log('=== PIVOINE PARITY AUDIT ===');
  console.log(`1. Total Film Frames: ${frames.length} / 718 (Target: 718) -> ${frames.length === 718 ? '✅ EXACT' : '⚠️ PARTIAL'}`);
  console.log(`2. Total Catalog Assets: ${catalog.length} / 4 -> ${catalog.length === 4 ? '✅ EXACT' : '⚠️ PARTIAL'}`);
  
  // Test local server
  try {
    const res = await fetch('http://localhost:3000');
    console.log(`3. Local Server HTTP Status: ${res.status} -> ${res.status === 200 ? '✅ HEALTHY' : '❌ ERROR'}`);
  } catch (err) {
    console.log(`3. Local Server Error: ${err.message}`);
  }

  try {
    const f1 = await fetch('http://localhost:3000/frames/f_0001.webp');
    const f718 = await fetch('http://localhost:3000/frames/f_0718.webp');
    console.log(`4. Frame 1 & 718 Delivery: ${f1.status === 200 && f718.status === 200 ? '✅ 100% SERVED' : '❌ ERROR'}`);
  } catch (err) {
    console.log(`4. Frame Delivery Error: ${err.message}`);
  }

  const hasLenis = fs.existsSync('pivoine/lenis.min.js');
  const hasFmap = fs.existsSync('pivoine/framemap.js');
  const hasCss = fs.existsSync('pivoine/style.css');
  const hasEngine = fs.existsSync('pivoine/film-engine.js');

  console.log(`5. Core Dependencies:
   - Lenis Scroll Engine: ${hasLenis ? '✅ PRESENT' : '❌ MISSING'}
   - Framemap Calibration: ${hasFmap ? '✅ PRESENT' : '❌ MISSING'}
   - APCA Styling & Mask Reveals: ${hasCss ? '✅ PRESENT' : '❌ MISSING'}
   - Multi-worker Canvas Engine: ${hasEngine ? '✅ PRESENT' : '❌ MISSING'}
  `);
}

verify();
