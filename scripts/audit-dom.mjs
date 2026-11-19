import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// MIME types
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer(port = 4173) {
  const rootDir = process.cwd();
  const server = http.createServer((req, res) => {
    let filePath = path.join(rootDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runSession(viewName, width, height, screenshotName) {
  console.log(`\n======================================================`);
  console.log(`🔍 DOM Audit Session: ${viewName} (${width}x${height})`);
  console.log(`======================================================`);

  const url = `http://127.0.0.1:4173/`;
  const screenshotPath = path.resolve(screenshotName);

  // Take screenshot with headless Chrome
  const args = [
    '--headless=new',
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${screenshotPath}`,
    '--dump-dom',
    url
  ];

  try {
    const { stdout } = await execFileAsync(chromePath, args, { maxBuffer: 10 * 1024 * 1024 });
    console.log(`📸 Captured screenshot to: ${screenshotPath}`);

    // Parse dumped DOM
    const cardMatches = (stdout.match(/class=["'][^"']*app-card[^"']*["']/g) || []).length;
    const guideMatches = (stdout.match(/class=["'][^"']*guide-card[^"']*["']/g) || []).length;
    const categoryTabs = (stdout.match(/class=["'][^"']*category-pill[^"']*["']/g) || []).length;
    const hasSearch = stdout.includes('id="search-input"');
    const hasGuides = stdout.includes('id="guides"');
    const hasModal = stdout.includes('id="modal-backdrop"');
    const resultsCount = stdout.match(/Showing \d+ of \d+ recommendations/);

    console.log(`\n📊 DOM Metric Checks:`);
    console.log(`- App Cards Rendered in DOM: ${cardMatches}`);
    console.log(`- Guide Cards Rendered in DOM: ${guideMatches}`);
    console.log(`- Category Tabs Count: ${categoryTabs}`);
    console.log(`- Search Input Present: ${hasSearch}`);
    console.log(`- Technical Guides Present: ${hasGuides}`);
    console.log(`- Modal / Drawer Structure Present: ${hasModal}`);
    console.log(`- Results Status: ${resultsCount ? resultsCount[0] : 'Not matched'}`);

    // Check for common responsive/DOM issues
    const issues = [];
    if (cardMatches === 0) issues.push('No app cards rendered in DOM');
    if (guideMatches === 0) issues.push('No guide cards rendered in DOM');
    if (!hasSearch) issues.push('Search input missing');

    return {
      viewName,
      width,
      height,
      cardMatches,
      guideMatches,
      issues,
      screenshotPath
    };
  } catch (err) {
    console.error(`Error in session ${viewName}:`, err.message);
    return { viewName, error: err.message };
  }
}

async function main() {
  const server = await startServer(4173);
  console.log('Local test server started at http://127.0.0.1:4173');

  try {
    // Session 1: Mobile Viewport (iPhone 13/14/15 size: 390x844)
    const mobileReport = await runSession('Mobile View', 390, 844, 'screenshot-mobile.png');

    // Session 2: Desktop Viewport (Standard 1440x900)
    const desktopReport = await runSession('Desktop View', 1440, 900, 'screenshot-desktop.png');

    console.log(`\n======================================================`);
    console.log(`📋 Audit Summary:`);
    console.log(`Mobile: ${mobileReport.cardMatches} cards, ${mobileReport.issues?.length || 0} issues`);
    console.log(`Desktop: ${desktopReport.cardMatches} cards, ${desktopReport.issues?.length || 0} issues`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
  }
}

main().catch(console.error);
