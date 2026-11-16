/**
 * A small Chrome DevTools Protocol driver.
 *
 * The Claude Code MCP client could not connect to the chrome-devtools
 * server in this session (it resolves the server list at session start,
 * and the first connection attempt timed out while `npx` downloaded the
 * package). The server itself is proven to work — the handshake succeeds
 * and it advertises 33 tools.
 *
 * So this drives Chrome over the same protocol the MCP server drives it
 * over: the DevTools WebSocket on the debugging port. It does the same
 * things the MCP tools do — click, type, screenshot, read the console,
 * list the network requests — so that the testing is the testing.
 *
 * The point of the whole exercise is to look at the app as a person
 * looks at it: to click a button and see what happens, to read the text
 * that is on the screen, to notice the error in the console.
 */

const http = require('http');

/**
 * The WebSocket client.
 *
 * `ws` is already in the workspace's package store — it is a dependency of
 * several packages here — so it is loaded from there rather than added to
 * the manifest: this is a test harness, not part of the product.
 */
const WebSocket = require('../node_modules/.pnpm/ws@8.21.3/node_modules/ws');

/**
 * The browser's debugging port.
 */
const PORT = 9222;

/**
 * The list of open tabs.
 */
function listPages() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}/json/list`, (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Opens a tab.
 */
function newPage(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
      { method: 'PUT' },
      (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on('error', reject);
    request.end();
  });
}

/**
 * A connection to one tab.
 */
class Tab {
  constructor(page) {
    this.page = page;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.networkRequests = [];
  }

  async connect() {
    this.socket = new WebSocket(this.page.webSocketDebuggerUrl, {
      maxPayload: 256 * 1024 * 1024,
    });

    await new Promise((resolve, reject) => {
      this.socket.on('open', resolve);
      this.socket.on('error', reject);
    });

    this.socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      /**
       * The events worth keeping — the console and the network are what a
       * person notices as "something went wrong".
       */
      if (message.method === 'Runtime.consoleAPICalled') {
        this.consoleMessages.push({
          type: message.params.type,
          text: (message.params.args || [])
            .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? '')
            .join(' '),
        });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.consoleMessages.push({
          type: 'exception',
          text: details?.exception?.description ?? details?.text ?? 'an exception',
        });
      }
      if (message.method === 'Network.responseReceived') {
        this.networkRequests.push({
          url: message.params.response.url,
          status: message.params.response.status,
        });
      }
      if (message.method === 'Network.loadingFailed') {
        this.networkRequests.push({
          url: '(failed)',
          status: message.params.errorText,
        });
      }

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });

    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Network.enable');

    return this;
  }

  /**
   * Sends a command and waits for its answer.
   */
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * Waits for the page to be quiet — no pending navigation.
   */
  async settle(ms = 1200) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Waits for the page to finish loading.
   *
   * A person does not look at a screen while the spinner is still turning.
   * The wait is for the document to be complete **and** for the network to
   * have gone quiet, so the screenshot is of the finished page and not of
   * a loading state.
   */
  async waitForPage(quietMs = 1200, timeoutMs = 20000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const state = await this.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });

      if (state.result.value === 'complete') {
        /**
         * The network is given a moment to go quiet. The requests that
         * are still in flight are counted.
         */
        const before = this.networkRequests.length;
        await this.settle(quietMs);
        const after = this.networkRequests.length;

        if (after === before) return;
      }

      await this.settle(400);
    }
  }

  /**
   * The text a person sees on the screen.
   */
  async visibleText() {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const parts = [];
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          if (text) parts.push(text);
        }
        return parts.join(' | ');
      })()`,
      returnByValue: true,
    });
    return result.result.value ?? '';
  }

  /**
   * The elements a person can see and click, with where they are.
   */
  async clickableElements() {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => {
        const out = [];
        document.querySelectorAll('a, button, [role="button"], input, select, textarea').forEach((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          if (rect.width === 0 || rect.height === 0) return;
          out.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 80),
            type: el.getAttribute('type') || '',
            name: el.getAttribute('name') || '',
            id: el.id || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        });
        return out;
      })()`,
      returnByValue: true,
    });
    return result.result.value ?? [];
  }

  /**
   * The page's title and URL.
   */
  async location() {
    const result = await this.send('Runtime.evaluate', {
      expression: '({ title: document.title, url: location.href })',
      returnByValue: true,
    });
    return result.result.value;
  }

  /**
   * Clicks at a point, the way a person clicks.
   */
  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.settle();
  }

  /**
   * Types into the focused field, one key at a time.
   */
  async typeText(text) {
    for (const character of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: character });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: character });
    }
    await this.settle(300);
  }

  /**
   * Presses a key.
   */
  async pressKey(key) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : 0,
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : 0,
    });
    await this.settle();
  }

  /**
   * Sets the viewport — the three breakpoints.
   */
  async resize(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await this.settle(600);
  }

  /**
   * Takes a screenshot.
   */
  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    if (result.data) {
      require('fs').writeFileSync(path, Buffer.from(result.data, 'base64'));
      return path;
    }
    return null;
  }

  /**
   * Navigates, and waits for the page to finish loading.
   *
   * The session is waited for as well: a hard reload clears the page, the
   * shell reads the stored session on mount, and until the member's record
   * has arrived the shell shows "Loading session". A person waits for that;
   * a test that reads the page straight away sees a spinner and concludes
   * the screen is broken.
   */
  async navigate(url) {
    this.consoleMessages = [];
    this.networkRequests = [];
    await this.send('Page.navigate', { url });
    await this.waitForPage();
    await this.waitForSession();
    await this.settle(1200);
  }

  /**
   * Waits for the session to resolve.
   *
   * The shell shows "Loading session" until the member's record has arrived.
   * A person waits for that; a test that navigates straight away sees the
   * spinner and concludes the screen is broken.
   */
  async waitForSession(timeoutMs = 15000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const state = await this.send('Runtime.evaluate', {
        expression: `document.body.innerText.includes('Loading session')`,
        returnByValue: true,
      });

      if (!state.result.value) return true;
      await this.settle(700);
    }

    return false;
  }

  /**
   * The console errors seen so far.
   */
  errors() {
    return this.consoleMessages.filter(
      (message) =>
        message.type === 'error' ||
        message.type === 'exception' ||
        message.type === 'assert'
    );
  }

  /**
   * The network failures seen so far.
   */
  failures() {
    return this.networkRequests.filter((request) => request.status >= 400);
  }

  close() {
    if (this.socket) this.socket.close();
  }
}

/**
 * Connects to the tab that is showing a URL, or the first page.
 */
async function connectTo(urlPart) {
  const pages = await listPages();
  const page = pages.find(
    (candidate) => candidate.type === 'page' && candidate.url.includes(urlPart)
  );
  if (!page) throw new Error(`no tab is showing ${urlPart}`);
  const tab = new Tab(page);
  await tab.connect();
  return tab;
}

/**
 * Opens a tab and connects to it.
 */
async function open(url) {
  const page = await newPage(url);
  const tab = new Tab(page);
  await tab.connect();
  await tab.settle(2500);
  return tab;
}

module.exports = { listPages, newPage, connectTo, open, Tab };
