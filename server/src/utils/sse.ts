import type { Response } from 'express';

/**
 * SSE 写入工具类
 * 封装 SSE 响应头设置、事件发送、心跳保活及流结束逻辑
 */
export class SSEWriter {
  private res: Response;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(res: Response) {
    this.res = res;
    // 设置 SSE 必要响应头（CORS 由 Express 中间件统一处理，此处不重复设置）
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
  }

  /** 发送一条 SSE 数据事件 */
  send(data: Record<string, unknown>): void {
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * 启动心跳定时器，每隔 intervalMs 毫秒发送一次心跳事件
   * 防止代理 / CDN / Nginx 因长时间无数据而断开 SSE 连接
   */
  startHeartbeat(intervalMs = 15_000): void {
    if (this.heartbeatTimer !== null) return; // 避免重复启动
    this.heartbeatTimer = setInterval(() => {
      this.res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, intervalMs);
  }

  /** 停止心跳定时器 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** 正常结束 SSE 流 */
  done(): void {
    this.stopHeartbeat();
    this.res.write('data: [DONE]\n\n');
    this.res.end();
  }

  /** 以错误方式结束 SSE 流 */
  error(msg: string): void {
    this.stopHeartbeat();
    this.res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    this.res.end();
  }
}
