import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function Terminal() {
  const { toggleTerminal } = useAppStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);

  const connect = useCallback(() => {
    if (!terminalRef.current) return;

    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal: XTerm }, { FitAddon }]) => {
      if (!terminalRef.current) return;

      // Clean up previous instance
      xtermRef.current?.dispose();
      wsRef.current?.close();

      const term = new XTerm({
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#e6edf3',
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
          brightWhite: '#f0f6fc',
        },
        fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001/ws/terminal`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln('\x1b[32m已连接到终端\x1b[0m');
        fitAddon.fit();
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (e) => {
        term.write(e.data);
      };

      ws.onerror = () => {
        term.writeln('\x1b[31m终端连接失败，请确保后端服务正在运行\x1b[0m');
      };

      ws.onclose = () => {
        term.writeln('\x1b[33m终端连接已断开\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      });

      if (terminalRef.current.parentElement) {
        resizeObserver.observe(terminalRef.current.parentElement);
      }

      return () => resizeObserver.disconnect();
    }).catch((err) => {
      console.error('Failed to load terminal dependencies:', err);
      if (terminalRef.current) {
        terminalRef.current.innerHTML =
          '<div style="padding:16px;color:#f85149;font-size:13px;">终端依赖加载失败，请安装 @xterm/xterm 和 @xterm/addon-fit</div>';
      }
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      xtermRef.current?.dispose();
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-t border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-xs text-[#8b949e] font-medium">终端</span>
        <button
          onClick={toggleTerminal}
          className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="关闭终端"
        >
          <X size={13} />
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden p-1" />
    </div>
  );
}
