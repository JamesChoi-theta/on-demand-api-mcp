/**
 * GPU deployment and billing tools backed by project-scoped API keys.
 */

import { CreateGpuDeploymentInput, getControllerClient } from '../api/controller-client.js';

const deploymentIdProperty = {
  deployment_id: {
    type: 'string',
    description: 'Stable GPU deployment ID returned by list_gpu_deployments.',
  },
};

const confirmationProperty = {
  confirm: {
    type: 'boolean',
    description: 'Must be true after the user confirms the target and action.',
  },
};

export const resourceToolDefinitions = [
  {
    name: 'list_gpu_resources',
    description: 'List currently available hosted and community GPU capacity and hourly prices where available.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_gpu_resource',
    description: 'Get details for one hosted or community GPU resource.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        resource_id: { type: 'string', description: 'Resource ID from list_gpu_resources.' },
        region: { type: 'string', description: 'Required when a hosted resource ID exists in multiple regions.' },
      },
      required: ['resource_id'],
    },
  },
  {
    name: 'list_gpu_deployment_templates',
    description: 'List GPU Node templates and allowed container images for deployment creation.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'list_gpu_deployments',
    description: 'List running and stopped GPU Node deployments in the configured project.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_gpu_deployment',
    description: 'Get status and safe details for one GPU Node deployment.',
    inputSchema: { type: 'object' as const, properties: deploymentIdProperty, required: ['deployment_id'] },
  },
  {
    name: 'create_gpu_deployment',
    description: 'Create a hosted or community GPU Node. This starts billable capacity and requires explicit confirmation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', pattern: '^[A-Za-z0-9]{1,20}$', description: 'Optional 1-20 character alphanumeric deployment name.' },
        display_name: { type: 'string', maxLength: 100, description: 'Optional human-readable display name.' },
        deployment_template_id: { type: 'string', description: 'Template ID from list_gpu_deployment_templates.' },
        resource_id: { type: 'string', description: 'Hosted or community resource ID from list_gpu_resources.' },
        region: { type: 'string', description: 'Required when the resource ID is available in multiple regions.' },
        container_image: { type: 'string', description: 'Allowed image from the selected GPU Node template.' },
        ssh_public_key: { type: 'string', description: 'SSH public key installed on the GPU Node.' },
        ssh_port: { type: 'integer', minimum: 1, maximum: 65535, description: 'SSH port, default 22.' },
        http_port: { type: 'integer', minimum: 0, maximum: 65535, description: 'Optional HTTP service port.' },
        max_price_per_hour_usd: { type: 'number', exclusiveMinimum: 0, description: 'Required price ceiling for a community GPU.' },
        ...confirmationProperty,
      },
      required: ['deployment_template_id', 'resource_id', 'container_image', 'ssh_public_key', 'confirm'],
    },
  },
  {
    name: 'start_gpu_deployment',
    description: 'Start a stopped GPU Node. This resumes billing and requires explicit confirmation.',
    inputSchema: {
      type: 'object' as const,
      properties: { ...deploymentIdProperty, ...confirmationProperty },
      required: ['deployment_id', 'confirm'],
    },
  },
  {
    name: 'stop_gpu_deployment',
    description: 'Stop a running GPU Node while retaining its restartable configuration. Requires explicit confirmation.',
    inputSchema: {
      type: 'object' as const,
      properties: { ...deploymentIdProperty, ...confirmationProperty },
      required: ['deployment_id', 'confirm'],
    },
  },
  {
    name: 'delete_gpu_deployment',
    description: 'Permanently delete a GPU Node deployment and its restartable configuration. Requires explicit confirmation.',
    inputSchema: {
      type: 'object' as const,
      properties: { ...deploymentIdProperty, ...confirmationProperty },
      required: ['deployment_id', 'confirm'],
    },
  },
  {
    name: 'get_gpu_deployment_events',
    description: 'Get recent Kubernetes events for a running GPU Node deployment.',
    inputSchema: { type: 'object' as const, properties: deploymentIdProperty, required: ['deployment_id'] },
  },
  {
    name: 'get_gpu_deployment_logs',
    description: 'Get logs for a running GPU Node deployment.',
    inputSchema: { type: 'object' as const, properties: deploymentIdProperty, required: ['deployment_id'] },
  },
  {
    name: 'get_billing_balance',
    description: 'Get the current organization credit balance associated with the configured project.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_billing_usage',
    description: 'Get project-scoped usage totals and daily category breakdown for up to 366 days.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'Inclusive YYYY-MM-DD start date.' },
        end_date: { type: 'string', description: 'Inclusive YYYY-MM-DD end date.' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'list_billing_top_ups',
    description: 'List sanitized organization-level credit top-up records.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'integer', minimum: 1, description: 'One-based page number.' },
        number: { type: 'integer', minimum: 1, maximum: 100, description: 'Records per page, maximum 100.' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_billing_pricing',
    description: 'Get chatbot, storage, and on-demand inference pricing. GPU prices are returned by list_gpu_resources.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
];

const resourceToolNames = new Set(resourceToolDefinitions.map((definition) => definition.name));

export interface ResourceToolInput {
  deployment_id?: string;
  resource_id?: string;
  region?: string;
  confirm?: boolean;
  start_date?: string;
  end_date?: string;
  page?: number;
  number?: number;
  name?: string;
  display_name?: string;
  deployment_template_id?: string;
  container_image?: string;
  ssh_public_key?: string;
  ssh_port?: number;
  http_port?: number;
  max_price_per_hour_usd?: number;
}

function requireValue(value: string | undefined, fieldName: string): string {
  if (!value) throw new Error(`${fieldName} is required`);
  return value;
}

function requireConfirmation(input: ResourceToolInput, action: string): void {
  if (input.confirm !== true) {
    throw new Error(`Set confirm=true only after the user confirms the ${action} action and target.`);
  }
}

function formatResult(result: unknown): string {
  const text = JSON.stringify(result ?? null, null, 2);
  const maximumLength = 50000;
  if (text.length <= maximumLength) return text;
  return `${text.slice(0, maximumLength)}\n... response truncated by the MCP server`;
}

export async function callResourceTool(name: string, input: ResourceToolInput): Promise<string> {
  if (!resourceToolNames.has(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const client = getControllerClient();
  let result: unknown;

  switch (name) {
    case 'list_gpu_resources':
      result = await client.listGpuResources();
      break;
    case 'get_gpu_resource':
      result = await client.getGpuResource(requireValue(input.resource_id, 'resource_id'), input.region);
      break;
    case 'list_gpu_deployment_templates':
      result = await client.listGpuDeploymentTemplates();
      break;
    case 'list_gpu_deployments':
      result = await client.listGpuDeployments();
      break;
    case 'get_gpu_deployment':
      result = await client.getGpuDeployment(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'create_gpu_deployment': {
      requireConfirmation(input, 'create');
      const request: CreateGpuDeploymentInput = {
        name: input.name,
        display_name: input.display_name,
        deployment_template_id: requireValue(input.deployment_template_id, 'deployment_template_id'),
        resource_id: requireValue(input.resource_id, 'resource_id'),
        region: input.region,
        container_image: requireValue(input.container_image, 'container_image'),
        ssh_public_key: requireValue(input.ssh_public_key, 'ssh_public_key'),
        ssh_port: input.ssh_port,
        http_port: input.http_port,
        max_price_per_hour_usd: input.max_price_per_hour_usd,
      };
      result = await client.createGpuDeployment(request);
      break;
    }
    case 'start_gpu_deployment':
      requireConfirmation(input, 'start');
      result = await client.startGpuDeployment(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'stop_gpu_deployment':
      requireConfirmation(input, 'stop');
      result = await client.stopGpuDeployment(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'delete_gpu_deployment':
      requireConfirmation(input, 'delete');
      result = await client.deleteGpuDeployment(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'get_gpu_deployment_events':
      result = await client.getGpuDeploymentEvents(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'get_gpu_deployment_logs':
      result = await client.getGpuDeploymentLogs(requireValue(input.deployment_id, 'deployment_id'));
      break;
    case 'get_billing_balance':
      result = await client.getBillingBalance();
      break;
    case 'get_billing_usage':
      result = await client.getBillingUsage(input.start_date, input.end_date);
      break;
    case 'list_billing_top_ups':
      result = await client.listBillingTopUps(input.page, input.number);
      break;
    case 'get_billing_pricing':
      result = await client.getBillingPricing();
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return formatResult(result);
}
