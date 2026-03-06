import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('xterm').Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const { toggleTerminal, currentProject } = useAppStore();

  useEffect(() => {
    let mounted = true;

    async function initTerminal() {
      if (!terminalRef.current) return;

      const { Terminal: XTerm } = await import('xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      await import('xterm/css/xterm.css');

      if (!mounted || !terminalRef.current) return;

      const term = new XTerm({
        theme: {
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
        },
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
    <div className="flex flex-col h-full bg-[#0d1117] border-t border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <span className="text-xs text-[#8b949e] font-medium">终端</span>
        <button
          onClick={toggleTerminal}
          className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="关闭终端"
        >
          <X size={13} />
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
