import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { BuildStartPayload, BuildStartResponse, BuildStopPayload, CollectorEvent } from './types';
import { debug, error as logError } from './helpers/logger';

const PROD_URL = 'https://collector-observability.browserstack.com';
const STAGING_URL = 'https://collector-observability-devtestops.bsstag.com';
const PREPROD_URL = 'https://collector-observability-preprod.bsstag.com';

function getBaseUrl(): string {
  const env = (process.env.BROWSERSTACK_ENV ?? 'prod').toLowerCase();
  if (env === 'staging' || env === 'stag') return STAGING_URL;
  if (env === 'preprod' || env === 'pre-prod') return PREPROD_URL;
  return PROD_URL;
}

export class HttpClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getBaseUrl();

    const httpAgent = new http.Agent({
      keepAlive: true,
      timeout: 60000,
      maxSockets: 2,
      maxTotalSockets: 2,
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      timeout: 60000,
      maxSockets: 2,
      maxTotalSockets: 2,
    });

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000,
      httpAgent,
      httpsAgent,
    });
  }

  async startBuild(payload: BuildStartPayload, userName: string, accessKey: string): Promise<BuildStartResponse> {
    debug(`Starting build at ${this.baseUrl}/api/v1/builds`);

    const response = await this.client.post<BuildStartResponse>('/api/v1/builds', payload, {
      auth: {
        username: userName,
        password: accessKey,
      },
      headers: {
        'Content-Type': 'application/json',
        'X-BSTACK-TESTOPS': 'true',
      },
    });

    debug(`Build created: ${response.data.build_hashed_id}`);
    return response.data;
  }

  async sendEvents(events: CollectorEvent[], jwt: string): Promise<void> {
    if (events.length === 0) return;

    debug(`Sending batch of ${events.length} events`);

    try {
      await this.client.post('/api/v1/batch', events, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'X-BSTACK-TESTOPS': 'true',
        },
      });
      debug(`Batch of ${events.length} events sent successfully`);
    } catch (e) {
      logError(`Failed to send batch: ${e}`);
    }
  }

  async stopBuild(buildHashedId: string, jwt: string, payload: BuildStopPayload): Promise<void> {
    debug(`Stopping build ${buildHashedId}`);

    try {
      await this.client.put(`/api/v1/builds/${buildHashedId}/stop`, payload, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'X-BSTACK-TESTOPS': 'true',
        },
      });
      debug('Build stopped successfully');
    } catch (e) {
      logError(`Failed to stop build: ${e}`);
    }
  }
}
