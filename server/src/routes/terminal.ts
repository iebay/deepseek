import { IncomingMessage } from 'http';
import WebSocket from 'ws';

export async function handleTerminalUpgrade(wss: WebSocket.Server, ws: WebSocket, req: IncomingMessage): Promise<void> {
  let ptyProcess: { write: (data: string) => void; resize: (cols: number, rows: number) => void; kill: () => void } | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pty = await import('node-pty').catch(() => null);
    if (!pty) {
      ws.send(JSON.stringify({ type: 'error', message: 'node-pty not available' }));
      ws.close();
      return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    const cwd = req.url ? new URL(req.url, 'http://localhost').searchParams.get('cwd') || process.env.HOME || '/' : process.env.HOME || '/';

    const proc = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
    });

    ptyProcess = {
      write: (data: string) => proc.write(data),
      resize: (cols: number, rows: number) => proc.resize(cols, rows),
      kill: () => proc.kill(),
    };

    proc.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    proc.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit' }));
        ws.close();
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terminal error';
    ws.send(JSON.stringify({ type: 'error', message: msg }));
    ws.close();
    return;
  }

  ws.on('message', (rawMessage: WebSocket.RawData) => {
    if (!ptyProcess) return;
    try {
      const msg = JSON.parse(rawMessage.toString()) as { type: string; data?: string; cols?: number; rows?: number };
      if (msg.type === 'input' && msg.data) {
        ptyProcess.write(msg.data);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        ptyProcess.resize(msg.cols, msg.rows);
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    ptyProcess?.kill();
    ptyProcess = null;
  });

  ws.on('error', () => {
    ptyProcess?.kill();
    ptyProcess = null;
  });
}
