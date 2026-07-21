#!/usr/bin/env node
/**
 * Theta EdgeCloud On-Demand API MCP Server
 *
 * This MCP server provides tools to interact with Theta EdgeCloud's
 * On-Demand Model APIs directly from Claude Desktop, Claude Code,
 * and other MCP-compatible clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { listServicesToolDefinition, listServices } from './tools/list-services.js';
import { inferToolDefinition, infer } from './tools/infer.js';
import { getRequestStatusToolDefinition, getRequestStatus } from './tools/get-request-status.js';
import { getUploadUrlToolDefinition, getUploadUrl } from './tools/get-upload-url.js';
import {
  callResourceTool,
  resourceToolDefinitions,
  type ResourceToolInput,
} from './tools/resource-management.js';

// Create the MCP server
const server = new Server(
  {
    name: 'theta-edgecloud-on-demand-api',
    version: '0.2.0-beta.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      listServicesToolDefinition,
      inferToolDefinition,
      getRequestStatusToolDefinition,
      getUploadUrlToolDefinition,
      ...resourceToolDefinitions,
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_services':
        result = await listServices(args as { category?: string });
        break;

      case 'infer':
        result = await infer(args as {
          service: string;
          input: Record<string, unknown>;
          wait?: number;
          prediction?: string;
          variant?: string;
        });
        break;

      case 'get_request_status':
        result = await getRequestStatus(args as { request_id: string });
        break;

      case 'get_upload_url':
        result = await getUploadUrl(args as {
          service: string;
          input_field: string;
        });
        break;

      default:
        result = await callResourceTool(name, (args || {}) as ResourceToolInput);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Main function
async function main() {
  // Check for API key
  if (!process.env.THETA_API_KEY) {
    console.error('Error: THETA_API_KEY environment variable is required');
    console.error('');
    console.error('Get your API key from: https://www.thetaedgecloud.com/dashboard/api-keys');
    console.error('');
    console.error('Then set it in your MCP config:');
    console.error(JSON.stringify({
      mcpServers: {
        'theta-edgecloud': {
          command: 'npx',
          args: ['@thetalabs/on-demand-api-mcp'],
          env: {
            THETA_API_KEY: 'your-api-key-here',
          },
        },
      },
    }, null, 2));
    process.exit(1);
  }

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Theta EdgeCloud On-Demand API MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
