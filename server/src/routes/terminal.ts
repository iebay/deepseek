import type { Server } from 'http';

export function setupTerminalWebSocket(server: Server): void {
  // Dynamically import ws and node-pty to allow graceful degradation
  Promise.all([
    import('ws').catch(() => null),
    import('node-pty').catch(() => null),
  ]).then(([wsModule, ptyModule]) => {
    if (!wsModule || !ptyModule) {
      console.warn('[terminal] WebSocket terminal unavailable: missing ws or node-pty dependency');
      return;
    }

    const { WebSocketServer } = wsModule;
    const pty = ptyModule;

    const wss = new WebSocketServer({ server, path: '/ws/terminal' });

    wss.on('connection', (ws) => {
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      let ptyProcess: ReturnType<typeof pty.spawn> | null = null;

      try {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: process.env.HOME || process.cwd(),
        });

        ptyProcess.onData((data: string) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(data);
          }
        });

        ws.on('message', (msg: Buffer | string) => {
          if (!ptyProcess) return;
          const text = msg.toString();
          try {
            const parsed = JSON.parse(text);
            if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
              ptyProcess.resize(parsed.cols, parsed.rows);
              return;
            }
          } catch {
            // not JSON, treat as raw input
          }
          ptyProcess.write(text);
        });

        ws.on('close', () => {
          ptyProcess?.kill();
          ptyProcess = null;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ws.send(`\r\n\x1b[31m终端启动失败: ${msg}\x1b[0m\r\n`);
        ws.close();
      }
    });

    console.log('[terminal] WebSocket terminal ready at /ws/terminal');
  }).catch((err) => {
    console.warn('[terminal] Failed to set up WebSocket terminal:', err);
  });
}
