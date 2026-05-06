import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle2' });
    
    console.log('Entering credentials...');
    await page.type('input[type="email"]', 'superadmin@glamirk.com');
    await page.type('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for dashboard...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    const pages = ['/admin', '/admin/cms', '/admin/admins', '/admin/tickets', '/admin/users'];
    for (const p of pages) {
      console.log(`Taking screenshot of ${p}...`);
      await page.goto(`http://localhost:5173${p}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000)); // Wait for content
      const filename = `screenshot_${p.replace(/\//g, '_') || 'dashboard'}.png`;
      await page.screenshot({ path: path.join(process.cwd(), filename) });
      console.log(`Saved ${filename}`);
    }

  } catch (err) {
    console.error('Puppeteer Error:', err);
  } finally {
    await browser.close();
  }
})();
