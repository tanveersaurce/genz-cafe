import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { name: '360', width: 360, height: 800, isMobile: true },
  { name: '768', width: 768, height: 1024, isMobile: false },
  { name: '1280', width: 1280, height: 800, isMobile: false },
];

const targetDirArg = process.argv[2] || 'before';
const OUTPUT_DIR = path.resolve(process.cwd(), `docs/ui-review/${targetDirArg}`);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // Retry
    }
    await sleep(400);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log(`Starting capture into ${OUTPUT_DIR}...`);

  // Check if server is running on 5000, if not start it
  let serverProcess = null;
  try {
    const sRes = await fetch('http://localhost:5000/api/health');
    if (sRes.ok) console.log('Backend server already running on port 5000');
  } catch {
    console.log('Starting backend server on port 5000...');
    serverProcess = spawn('node', ['dist/server.js'], {
      cwd: path.resolve(process.cwd(), 'server'),
      stdio: 'pipe',
      env: process.env,
    });
    serverProcess.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));
    await waitForUrl('http://localhost:5000/api/health');
    console.log('Backend server is ready.');
  }

  // Check if client is running on 5173, if not start it
  let clientProcess = null;
  try {
    const cRes = await fetch('http://localhost:5173/');
    if (cRes.ok) console.log('Client dev server already running on port 5173');
  } catch {
    console.log('Starting client dev server on port 5173...');
    clientProcess = spawn('npx', ['vite', '--port', '5173'], {
      cwd: path.resolve(process.cwd(), 'client'),
      stdio: 'pipe',
      shell: true,
    });
    clientProcess.stdout.on('data', (d) => process.stdout.write(`[CLIENT] ${d}`));
    clientProcess.stderr.on('data', (d) => process.stderr.write(`[CLIENT ERR] ${d}`));
    await waitForUrl('http://localhost:5173/');
    console.log('Client dev server is ready.');
  }

  // Launch Chrome with remote debugging
  console.log('Launching headless Chrome with remote debugging...');
  const chromeProcess = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--remote-allow-origins=*',
      '--user-data-dir=C:\\Users\\lenovo\\.gemini\\antigravity\\scratch\\chrome-audit-profile',
      '--disable-gpu',
      '--no-sandbox',
    ],
    { stdio: 'ignore' }
  );

  await sleep(2000);

  let ws;
  let msgId = 1;

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (event) => {
        const res = JSON.parse(event.data);
        if (res.id === id) {
          ws.removeEventListener('message', handler);
          if (res.error) reject(res.error);
          else resolve(res.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const targets = await listRes.json();
    let pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) {
      const newPageRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
      pageTarget = await newPageRes.json();
    }

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');
    await sendCommand('DOM.enable');

    async function setViewport(w, h, isMobile) {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: isMobile,
      });
    }

    async function capture(pageName, widthName) {
      await sleep(1200); // Allow react rendering & images to settle
      const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(OUTPUT_DIR, `${pageName}_${widthName}.png`);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`Captured: ${pageName}_${widthName}.png`);
    }

    // 1. PUBLIC PAGES
    const publicPages = [
      { name: 'home', path: '/' },
      { name: 'menu', path: '/menu' },
      { name: 'gallery', path: '/gallery' },
      { name: 'contact', path: '/contact' },
      { name: 'reservation', path: '/reservation' },
    ];

    for (const page of publicPages) {
      for (const vp of VIEWPORTS) {
        await setViewport(vp.width, vp.height, vp.isMobile);
        await sendCommand('Page.navigate', { url: `http://localhost:5173${page.path}` });
        await capture(page.name, vp.name);
      }
    }

    // 2. LOG IN TO ACCESS STAFF PAGES
    console.log('Logging in to staff portal via /app/login...');
    await setViewport(1280, 800, false);
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/app/login' });
    await sleep(1500);

    await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const inputs = document.querySelectorAll('input');
          if (inputs.length >= 2) {
            inputs[0].value = 'partner_admin';
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[1].value = 'Partner@1234';
            inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          }
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        })()
      `,
    });

    await sleep(2500);

    // 3. STAFF PAGES
    const staffPages = [
      { name: 'pos_table_map', path: '/app/pos' },
      { name: 'menu_admin', path: '/app/menu' },
      { name: 'kitchen', path: '/app/kitchen' },
      { name: 'reservations_admin', path: '/app/reservations' },
      { name: 'users_admin', path: '/app/users' },
      { name: 'closing', path: '/app/closing' },
    ];

    for (const page of staffPages) {
      for (const vp of VIEWPORTS) {
        await setViewport(vp.width, vp.height, vp.isMobile);
        await sendCommand('Page.navigate', { url: `http://localhost:5173${page.path}` });
        await capture(page.name, vp.name);
      }
    }

    // 4. POS ORDER SCREEN (Table selected or Takeaway order active)
    for (const vp of VIEWPORTS) {
      await setViewport(vp.width, vp.height, vp.isMobile);
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/app/pos' });
      await sleep(1500);

      // Click the first table button to enter order screen
      await sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const tableButtons = document.querySelectorAll('button');
            for (const b of tableButtons) {
              if (b.innerText && b.innerText.includes('#')) {
                b.click();
                break;
              }
            }
          })()
        `,
      });

      await sleep(1000);
      await capture('pos_order_screen', vp.name);
    }

    console.log(`\nAll 36 screenshots captured successfully in ${OUTPUT_DIR}!`);
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
    if (clientProcess) clientProcess.kill();
    if (serverProcess) serverProcess.kill();
  }
}

main().catch(console.error);
