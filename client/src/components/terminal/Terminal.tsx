import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const DARK_THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#388bfd',
  selectionBackground: '#388bfd40',
  black: '#0d1117',
  brightBlack: '#6e7681',
  red: '#f85149',
  brightRed: '#ff7b72',
  green: '#3fb950',
  brightGreen: '#56d364',
  yellow: '#d29922',
  brightYellow: '#e3b341',
  blue: '#388bfd',
  brightBlue: '#79c0ff',
  magenta: '#bc8cff',
  brightMagenta: '#d2a8ff',
  cyan: '#39c5cf',
  brightCyan: '#56d4dd',
  white: '#b1bac4',
  brightWhite: '#e6edf3',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#0969da',
  selectionBackground: '#0969da40',
  black: '#24292f',
  brightBlack: '#8b949e',
  red: '#cf222e',
  brightRed: '#a40e26',
  green: '#1a7f37',
  brightGreen: '#116329',
  yellow: '#9a6700',
  brightYellow: '#7d4e00',
  blue: '#0969da',
  brightBlue: '#0550ae',
  magenta: '#8250df',
  brightMagenta: '#6e40c9',
  cyan: '#0550ae',
  brightCyan: '#033d8b',
  white: '#6e7781',
  brightWhite: '#1f2328',
};

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const { toggleTerminal, currentProject, theme } = useAppStore();

  // Update xterm theme when app theme changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    }
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    async function initTerminal() {
      if (!terminalRef.current) return;

      const { Terminal: XTerm } = await import('xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      await import('xterm/css/xterm.css');

      if (!mounted || !terminalRef.current) return;

      const term = new XTerm({
        theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.hostname}:3001`;
      const cwd = currentProject?.path || '';
      const ws = new WebSocket(`${wsHost}/ws/terminal?cwd=${encodeURIComponent(cwd)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data?: string; message?: string };
          if (msg.type === 'data' && msg.data) {
            term.write(msg.data);
          } else if (msg.type === 'error') {
            term.writeln(`\r\n\x1b[31m[Error] ${msg.message || 'Terminal error'}\x1b[0m`);
          }
        } catch {
          term.write(event.data as string);
        }
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[31m[WebSocket connection failed]\x1b[0m');
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[33m[Terminal session ended]\x1b[0m');
      };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      // ResizeObserver for FitAddon
      const observer = new ResizeObserver(() => {
        if (!mounted) return;
        fitAddon.fit();
        const { cols, rows } = term;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
      if (terminalRef.current) observer.observe(terminalRef.current);

      return () => {
        observer.disconnect();
      };
    }

    void initTerminal();

    return () => {
      mounted = false;
      wsRef.current?.close();
      xtermRef.current?.dispose();
    };
  }, [currentProject?.path]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] border-t border-[var(--border-primary)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] shrink-0">
        <span className="text-xs text-[var(--text-secondary)] font-medium">终端</span>
        <button
          onClick={toggleTerminal}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="关闭终端"
        >
          <X size={13} />
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
