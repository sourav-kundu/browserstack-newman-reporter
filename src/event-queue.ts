import { CollectorEvent } from './types';
import { HttpClient } from './http-client';
import { debug } from './helpers/logger';

const BATCH_SIZE = 1000;
const BATCH_INTERVAL = 2000;
const MAX_WAIT_FOR_PENDING = 60000;
const POLL_INTERVAL = 100;

export class EventQueue {
  private queue: CollectorEvent[] = [];
  private jwt: string;
  private httpClient: HttpClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingUploads = 0;

  constructor(jwt: string, httpClient: HttpClient) {
    this.jwt = jwt;
    this.httpClient = httpClient;
    this.startPolling();
  }

  enqueue(event: CollectorEvent): void {
    this.queue.push(event);

    if (this.queue.length >= BATCH_SIZE) {
      const batch = this.queue.splice(0, BATCH_SIZE);
      this.sendBatch(batch);
    }
  }

  async shutdown(): Promise<void> {
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Drain remaining queue
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, BATCH_SIZE);
      await this.sendBatchSync(batch);
    }

    // Wait for in-flight requests
    await this.waitForPending();
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      if (this.queue.length > 0) {
        const batch = this.queue.splice(0, BATCH_SIZE);
        this.sendBatch(batch);
      }
    }, BATCH_INTERVAL);
  }

  private sendBatch(batch: CollectorEvent[]): void {
    this.pendingUploads++;
    this.httpClient.sendEvents(batch, this.jwt).finally(() => {
      this.pendingUploads = Math.max(0, this.pendingUploads - 1);
    });
  }

  private async sendBatchSync(batch: CollectorEvent[]): Promise<void> {
    this.pendingUploads++;
    try {
      await this.httpClient.sendEvents(batch, this.jwt);
    } finally {
      this.pendingUploads = Math.max(0, this.pendingUploads - 1);
    }
  }

  private async waitForPending(): Promise<void> {
    if (this.pendingUploads <= 0) return;

    debug(`Waiting for ${this.pendingUploads} pending uploads to complete...`);
    let waited = 0;
    while (this.pendingUploads > 0 && waited < MAX_WAIT_FOR_PENDING) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      waited += POLL_INTERVAL;
    }

    if (this.pendingUploads > 0) {
      debug(`Timed out waiting for pending uploads. ${this.pendingUploads} still remaining.`);
    }
  }
}
