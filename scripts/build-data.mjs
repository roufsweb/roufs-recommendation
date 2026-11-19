import fs from 'node:fs';
import path from 'node:path';

const appsDir = path.resolve('apps');
const files = fs.readdirSync(appsDir).filter(f => f.endsWith('.md'));

// Map files to section IDs and names
const sectionMapping = {
  'tube-pip': { section: 'ios', category: 'Streaming & Video', subcategory: '1.1 Ad-Free Video Streaming' },
  'tubemax': { section: 'ios', category: 'Streaming & Video', subcategory: '1.1 Ad-Free Video Streaming' },
  'protube': { section: 'ios', category: 'Streaming & Video', subcategory: '1.1 Ad-Free Video Streaming' },
  'aloha-browser': { section: 'ios', category: 'Browser & Video', subcategory: '1.1 Ad-Free Video Streaming' },
  'lyra': { section: 'ios', category: 'Music & Audio', subcategory: '1.2 Music & Offline Audio' },
  'snapseed': { section: 'ios', category: 'Photo Editing', subcategory: '1.3 Photo & Video Creation' },
  'vllo': { section: 'ios', category: 'Video Editing', subcategory: '1.3 Photo & Video Creation' },
  'ish-shell': { section: 'ios', category: 'Developer & Terminal', subcategory: '1.4 Terminal & Developer Tools' },
  'rootshell': { section: 'ios', category: 'Developer & Terminal', subcategory: '1.4 Terminal & Developer Tools' },
  'potatso': { section: 'ios', category: 'Network & Proxy', subcategory: '1.5 Proxy & Network Utilities' },
  'dnsecure': { section: 'ios', category: 'Network & DNS', subcategory: '1.5 Proxy & Network Utilities' },
  'lap': { section: 'cross-platform', category: 'Photo Management', subcategory: 'Cross-Platform Tools & Utilities' },
  'localsend': { section: 'cross-platform', category: 'File Transfer', subcategory: 'Cross-Platform Tools & Utilities' },
  'twingate': { section: 'networking', category: 'Zero Trust & Remote Access', subcategory: 'Remote Access & Zero Trust' },
  'cloudflare-one': { section: 'networking', category: 'Zero Trust VPN & Edge', subcategory: 'Remote Access & Zero Trust' },
  'aapanel': { section: 'homelab', category: 'Server Control Panel', subcategory: 'Homelab & Server OS' },
  'immortalwrt': { section: 'homelab', category: 'Router Firmware & OS', subcategory: 'Homelab & Server OS' },
  'everythingmoe': { section: 'web-indices', category: 'Media & Anime Directory', subcategory: 'Web Media Indices' }
};

// Setup guides attached directly to their respective app/service popup
const appGuides = {
  'dnsecure': {
    title: 'System-Wide Ad-Free iOS Setup via Encrypted DNS',
    badge: 'Step-by-Step Setup Guide',
    summary: 'Suppress in-app advertisements, telemetry trackers, and web banners across iOS without battery drain using DNS-over-HTTPS (DoH).',
    steps: [
      { step: 1, text: 'Install <strong>DNSecure</strong> from the official Apple App Store.' },
      { step: 2, text: 'Open the app, tap the <strong>+</strong> icon, and select <strong>DNS-over-HTTPS</strong>.' },
      { step: 3, text: 'Enter the official AdGuard DNS endpoint:', code: 'https://dns.adguard-dns.com/dns-query' },
      { step: 4, text: 'Save the configuration and navigate to <strong>iOS Settings &rarr; General &rarr; VPN & Device Management &rarr; DNS</strong>.' },
      { step: 5, text: 'Select <strong>DNSecure</strong> as your active resolver. All queries are now securely filtered at the OS kernel layer.' }
    ]
  },
  'cloudflare-one': {
    title: 'Cloudflare Zero Trust Team Setup for Free Unlimited VPN',
    badge: 'Step-by-Step Setup Guide',
    summary: 'Unlock uncapped WireGuard VPN routing and custom DNS gateway filtering across devices via Cloudflare’s enterprise edge network.',
    steps: [
      { step: 1, text: 'Sign up for a free team account at the <a href="https://one.dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare Zero Trust Dashboard</a>.' },
      { step: 2, text: 'Choose your free team domain name (e.g., <code>yourname.cloudflareaccess.com</code>) under the Free 50-user tier.' },
      { step: 3, text: 'Navigate to <strong>Settings &rarr; WARP Client &rarr; Device enrollment rules</strong> and add your authorized personal email domain.' },
      { step: 4, text: 'Download and launch the <strong>1.1.1.1: Faster Internet</strong> client on your phone or laptop.' },
      { step: 5, text: 'Open <strong>Settings &rarr; Account &rarr; Login with Cloudflare Zero Trust</strong>, enter your team domain, and authenticate via one-time PIN.' },
      { step: 6, text: 'Toggle the connection switch to route all device traffic through Cloudflare’s global Anycast mesh.' }
    ]
  },
  'twingate': {
    title: 'Twingate Homelab Setup (Zero Open Router Ports)',
    badge: 'Step-by-Step Setup Guide',
    summary: 'Securely access internal servers, NAS units, and self-hosted dashboards from anywhere with zero port-forwarding or public IP exposure.',
    steps: [
      { step: 1, text: 'Create a free starter account at <a href="https://www.twingate.com" target="_blank" rel="noopener">Twingate.com</a> (up to 5 users).' },
      { step: 2, text: 'Create a Remote Network named <strong>Home Network</strong> and generate a new <strong>Connector</strong> token.' },
      { step: 3, text: 'Deploy the connector on any always-on home machine (Raspberry Pi, mini PC, NAS) using Docker:', code: `docker run -d --sysctl net.ipv4.ping_group_range="0 2147483647" \\
  --env TENANT_URL="https://yournetwork.twingate.com" \\
  --env ACCESS_TOKEN="your_connector_access_token" \\
  --env REFRESH_TOKEN="your_connector_refresh_token" \\
  --name twingate-connector \\
  --restart unless-stopped \\
  twingate/connector:latest` },
      { step: 4, text: 'Define your internal resources in the dashboard (e.g., <code>192.168.1.100</code> or <code>homelab.local</code>).' },
      { step: 5, text: 'Install the Twingate app on your mobile device or laptop. Authenticate once to access private home resources anywhere seamlessly.' }
    ]
  }
};

const apps = files.map(file => {
  const id = file.replace('.md', '');
  const raw = fs.readFileSync(path.join(appsDir, file), 'utf-8');

  // Title
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : id;

  // Icon URL
  const iconMatch = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  const icon = iconMatch ? iconMatch[1] : '';

  // Metadata
  const catMatch = raw.match(/\*\*Category:\*\*\s*(.+)/i);
  const categoryRaw = catMatch ? catMatch[1].trim() : '';

  const platMatch = raw.match(/\*\*Platforms?:\*\*\s*(.+)/i);
  const platformsRaw = platMatch ? platMatch[1].trim() : '';

  const pricingMatch = raw.match(/\*\*Pricing:\*\*\s*(.+)/i);
  const pricingRaw = pricingMatch ? pricingMatch[1].trim() : 'Free';

  // Extract links
  const linksRawMatch = raw.match(/\*\*(?:Download|Official Resources|Official Portal):\*\*\s*(.+)/i);
  const linksList = [];
  if (linksRawMatch) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(linksRawMatch[1])) !== null) {
      linksList.push({ label: m[1], url: m[2] });
    }
  }

  // Overview
  const overviewMatch = raw.match(/## Overview\s+([\s\S]*?)(?=## Key Features|\n---|$)/i);
  const overview = overviewMatch ? overviewMatch[1].trim() : '';

  // Features
  const featuresMatch = raw.match(/## Key Features\s+([\s\S]*?)(?=\n---|$)/i);
  const features = [];
  if (featuresMatch) {
    const lines = featuresMatch[1].trim().split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const item = trimmed.replace(/^[\*\-]\s+/, '');
        const boldMatch = item.match(/^\*\*([^*]+)\:\*\*\s*(.*)$/);
        if (boldMatch) {
          features.push({ label: boldMatch[1].trim(), text: boldMatch[2].trim() });
        } else {
          features.push({ label: '', text: item });
        }
      }
    }
  }

  // Pricing badge classification
  let pricingType = 'free';
  const pLower = pricingRaw.toLowerCase();
  if (pLower.includes('open source') || pLower.includes('foss') || pLower.includes('gpl') || pLower.includes('mit')) {
    pricingType = 'foss';
  } else if (pLower.includes('freemium') || pLower.includes('starter') || pLower.includes('free core')) {
    pricingType = 'freemium';
  } else if (pLower.includes('100% free') || pLower.includes('free')) {
    pricingType = 'free';
  }

  const secInfo = sectionMapping[id] || { section: 'other', category: categoryRaw, subcategory: 'General' };

  return {
    id,
    title,
    icon,
    section: secInfo.section,
    category: secInfo.category,
    subcategory: secInfo.subcategory,
    platforms: platformsRaw.split(',').map(p => p.trim()).filter(Boolean),
    pricing: pricingRaw,
    pricingType,
    links: linksList,
    overview,
    features,
    guide: appGuides[id] || null
  };
});

const jsContent = `// Auto-generated recommendations data
window.ROUFS_DATA = {
  apps: ${JSON.stringify(apps, null, 2)},
  meta: {
    title: "Rouf's Recommendations",
    domain: "recomendation.roufsweb.com",
    githubRepo: "https://github.com/roufsweb/roufs-recommendation",
    author: "RoufsWeb",
    updatedAt: "${new Date().toISOString().split('T')[0]}"
  }
};
`;

fs.writeFileSync('data.js', jsContent, 'utf-8');
console.log(`Generated data.js successfully with ${apps.length} apps (guides attached to specific popups).`);
