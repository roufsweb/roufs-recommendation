import fs from 'node:fs';

const content = fs.readFileSync('data.js', 'utf8');
const regex = /"icon":\s*"([^"]+)"/g;
const icons = [];
let match;
while ((match = regex.exec(content)) !== null) {
  icons.push(match[1]);
}

console.log(`Checking ${icons.length} app icon URLs...`);

for (const url of icons) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.status !== 200) {
      console.log(`❌ BROKEN (${res.status}): ${url}`);
    } else {
      console.log(`✅ OK (200): ${url.substring(0, 70)}...`);
    }
  } catch (err) {
    console.log(`❌ FAILED TO FETCH: ${url} (${err.message})`);
  }
}
