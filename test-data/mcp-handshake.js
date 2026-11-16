/**
 * A manual MCP handshake with the chrome-devtools server.
 *
 * The Claude Code MCP client could not connect to it — a 30-second
 * timeout. This asks the server directly whether it speaks MCP, and what
 * it offers, so that the failure can be told apart from "the server is
 * broken".
 *
 * The MCP stdio protocol is a JSON-RPC message per line, with the
 * `Content-Length` header framing optional in practice for the newline
 * form used by most servers.
 */

const { spawn } = require('child_process');

const SERVER =
  'C:/Users/hp/AppData/Roaming/npm/node_modules/chrome-devtools-mcp/out/Default/gen/src/bin/chrome-devtools-mcp.js';

const child = spawn('node', [SERVER], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const seen = new Set();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');

  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      console.log('[not json]', line.slice(0, 160));
      continue;
    }

    const id = message.id;
    if (id !== undefined && seen.has(id)) continue;
    if (id !== undefined) seen.add(id);

    if (message.id === 1 && message.result) {
      console.log('HANDSHAKE OK');
      console.log('server:', JSON.stringify(message.result.serverInfo));
      console.log('protocol:', JSON.stringify(message.result.protocolVersion));
      const toolCount = (message.result.capabilities?.tools || []).length;
      console.log('tools advertised:', toolCount);

      /**
       * The tools list is what the client needs to actually call
       * anything.
       */
      child.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n'
      );
      continue;
    }

    if (message.id === 2 && message.result) {
      const names = (message.result.tools || []).map((tool) => tool.name);
      console.log('tool count:', names.length);
      console.log('tools:', names.join(', '));
      child.kill();
      process.exit(0);
    }

    if (message.error) {
      console.log('ERROR', JSON.stringify(message.error));
    }
  }
});

child.stderr.on('data', (chunk) => {
  console.log('[stderr]', chunk.toString('utf8').slice(0, 400));
});

child.on('exit', (code) => {
  console.log('[server exited]', code);
});

/**
 * The initialise request. The client tells the server which protocol
 * version it speaks and what it can do; the server answers with the same
 * information and the tools it offers.
 */
setTimeout(() => {
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'handshake-test', version: '1.0.0' },
      },
    }) + '\n'
  );
}, 500);

/**
 * The server is asked to start after the handshake.
 */
setTimeout(() => {
  child.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n'
  );
}, 1500);

setTimeout(() => {
  console.log('[no response within 20s]');
  child.kill();
  process.exit(1);
}, 20000);
