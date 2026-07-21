/**
 * HTTP client for Theta EdgeCloud project automation APIs.
 */

interface ControllerClientConfig {
  apiKey: string;
  projectId: string;
  baseUrl: string;
}

interface ApiResponse<T> {
  status: string;
  body: T;
}

export interface CreateGpuDeploymentInput {
  name?: string;
  display_name?: string;
  deployment_template_id: string;
  resource_id: string;
  region?: string;
  container_image: string;
  ssh_public_key: string;
  ssh_port?: number;
  http_port?: number;
  max_price_per_hour_usd?: number;
}

export class ControllerApiClient {
  private apiKey: string;
  private projectId: string;
  private baseUrl: string;

  constructor(config: ControllerClientConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  private projectPath(suffix: string): string {
    return `/v1/projects/${encodeURIComponent(this.projectId)}/${suffix}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      const envelope = data as { message?: string; error?: string };
      const message = envelope && typeof envelope === 'object'
        ? envelope.message || envelope.error || responseText
        : responseText;
      throw new Error(`Controller API error (${response.status}): ${message || response.statusText}`);
    }

    if (response.status === 204 && !responseText) {
      return null as T;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Controller API returned an invalid response');
    }
    const envelope = data as ApiResponse<T> & { message?: string; error?: string };
    if (envelope.status !== 'success') {
      throw new Error(`Controller API error: ${envelope.message || envelope.error || 'unknown error'}`);
    }
    if (!Object.prototype.hasOwnProperty.call(envelope, 'body')) {
      throw new Error('Controller API returned a success response without a body');
    }
    return envelope.body;
  }

  listGpuResources(): Promise<unknown> {
    return this.request('GET', this.projectPath('gpu-resources'));
  }

  getGpuResource(resourceId: string, region?: string): Promise<unknown> {
    const query = region ? `?region=${encodeURIComponent(region)}` : '';
    return this.request('GET', this.projectPath(`gpu-resources/${encodeURIComponent(resourceId)}${query}`));
  }

  listGpuDeploymentTemplates(): Promise<unknown> {
    return this.request('GET', this.projectPath('gpu-deployment-templates'));
  }

  listGpuDeployments(): Promise<unknown> {
    return this.request('GET', this.projectPath('gpu-deployments'));
  }

  getGpuDeployment(deploymentId: string): Promise<unknown> {
    return this.request('GET', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}`));
  }

  createGpuDeployment(input: CreateGpuDeploymentInput): Promise<unknown> {
    return this.request('POST', this.projectPath('gpu-deployments'), input);
  }

  startGpuDeployment(deploymentId: string): Promise<unknown> {
    return this.request('POST', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}/start`));
  }

  stopGpuDeployment(deploymentId: string): Promise<unknown> {
    return this.request('POST', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}/stop`));
  }

  deleteGpuDeployment(deploymentId: string): Promise<unknown> {
    return this.request('DELETE', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}`));
  }

  getGpuDeploymentEvents(deploymentId: string): Promise<unknown> {
    return this.request('GET', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}/events`));
  }

  getGpuDeploymentLogs(deploymentId: string): Promise<unknown> {
    return this.request('GET', this.projectPath(`gpu-deployments/${encodeURIComponent(deploymentId)}/logs`));
  }

  getBillingBalance(): Promise<unknown> {
    return this.request('GET', this.projectPath('billing/balance'));
  }

  getBillingUsage(startDate?: string, endDate?: string): Promise<unknown> {
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    const queryString = query.toString();
    return this.request('GET', this.projectPath(`billing/usage${queryString ? `?${queryString}` : ''}`));
  }

  listBillingTopUps(page?: number, number?: number): Promise<unknown> {
    const query = new URLSearchParams();
    if (page !== undefined) query.set('page', String(page));
    if (number !== undefined) query.set('number', String(number));
    const queryString = query.toString();
    return this.request('GET', this.projectPath(`billing/top-ups${queryString ? `?${queryString}` : ''}`));
  }

  getBillingPricing(): Promise<unknown> {
    return this.request('GET', this.projectPath('billing/pricing'));
  }
}

let controllerClientInstance: ControllerApiClient | null = null;

export function getControllerClient(): ControllerApiClient {
  if (!controllerClientInstance) {
    const apiKey = process.env.THETA_API_KEY;
    const projectId = process.env.THETA_PROJECT_ID;
    const baseUrl = process.env.THETA_CONTROLLER_BASE_URL;

    if (!apiKey) {
      throw new Error('THETA_API_KEY environment variable is required');
    }
    if (!projectId) {
      throw new Error('THETA_PROJECT_ID is required for GPU and billing tools');
    }
    if (!baseUrl) {
      throw new Error('THETA_CONTROLLER_BASE_URL is required for GPU and billing tools');
    }

    controllerClientInstance = new ControllerApiClient({ apiKey, projectId, baseUrl });
  }
  return controllerClientInstance;
}

export function resetControllerClient(): void {
  controllerClientInstance = null;
}
