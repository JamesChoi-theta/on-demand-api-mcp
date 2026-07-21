'use strict';

const assert = require('assert');

const {
  ControllerApiClient,
  resetControllerClient,
} = require('../dist/api/controller-client.js');
const { callResourceTool } = require('../dist/tools/resource-management.js');

const originalFetch = global.fetch;

async function run() {
  const requests = [];
  global.fetch = async function(url, options) {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ status: 'success', body: { ok: true } }),
    };
  };

  const client = new ControllerApiClient({
    apiKey: 'test-key',
    projectId: 'prj_test',
    baseUrl: 'https://controller.example.com/',
  });
  await client.listGpuResources();
  assert.strictEqual(requests[0].url, 'https://controller.example.com/v1/projects/prj_test/gpu-resources');
  assert.strictEqual(requests[0].options.headers['x-api-key'], 'test-key');
  assert.ok(!requests[0].options.headers.Authorization);

  await client.createGpuDeployment({
    deployment_template_id: 'dplt_gpu',
    resource_id: 'community_node/1',
    container_image: 'example/gpu:latest',
    ssh_public_key: 'ssh-ed25519 test-key',
  });
  assert.strictEqual(requests[1].options.method, 'POST');
  assert.strictEqual(JSON.parse(requests[1].options.body).resource_id, 'community_node/1');

  await client.startGpuDeployment('dplb/a');
  assert.ok(requests[2].url.endsWith('/gpu-deployments/dplb%2Fa/start'));

  process.env.THETA_API_KEY = 'test-key';
  process.env.THETA_PROJECT_ID = 'prj_test';
  process.env.THETA_CONTROLLER_BASE_URL = 'https://controller.example.com';
  resetControllerClient();
  await assert.rejects(
    () => callResourceTool('unknown_tool', {}),
    /Unknown tool: unknown_tool/,
  );
  await assert.rejects(
    () => callResourceTool('delete_gpu_deployment', { deployment_id: 'dplb_test', confirm: false }),
    /confirm=true/,
  );

  global.fetch = async function() {
    return {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => JSON.stringify({ message: 'not authorized' }),
    };
  };
  await assert.rejects(() => client.getBillingBalance(), /Controller API error \(403\): not authorized/);

  global.fetch = async function() {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ status: 'error', message: 'upstream error' }),
    };
  };
  await assert.rejects(() => client.getBillingBalance(), /Controller API error: upstream error/);

  global.fetch = async function() {
    return {
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    };
  };
  assert.strictEqual(await client.deleteGpuDeployment('dplb_test'), null);

  console.log('controller client tests passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    resetControllerClient();
  });
