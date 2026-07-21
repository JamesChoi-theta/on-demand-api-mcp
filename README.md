# Theta EdgeCloud On-Demand API MCP Server

Official Model Context Protocol (MCP) server for [Theta EdgeCloud](https://www.thetaedgecloud.com). Access on-demand models and project-scoped GPU Node and billing workflows from Claude Desktop, Claude Code, Cursor, and other MCP-compatible clients.

## Features

- **20+ AI Models** - Image generation, audio transcription, LLMs, and more
- **Simple Integration** - Works with any MCP-compatible client
- **Sync & Async** - Get results immediately or poll for long-running tasks
- **File Uploads** - Upload local files for processing
- **GPU Node Automation** - Discover capacity and manage hosted or community GPU Nodes
- **Billing Visibility** - Read project usage, organization balance, prices, and sanitized top-up history

## Installation

GPU Node and billing tools are currently beta-only. Use the npm `beta` tag until the controller APIs reach general availability.

### For Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "theta-edgecloud": {
      "command": "npx",
      "args": ["-y", "@thetalabs/on-demand-api-mcp@beta"],
      "env": {
        "THETA_API_KEY": "your-api-key-here",
        "THETA_PROJECT_ID": "prj_your-project-id",
        "THETA_CONTROLLER_BASE_URL": "https://controller-beta.thetaedgecloud.com"
      }
    }
  }
}
```

### For Claude Code

```bash
claude mcp add theta-edgecloud \
  -e THETA_API_KEY=your-api-key-here \
  -e THETA_PROJECT_ID=prj_your-project-id \
  -e THETA_CONTROLLER_BASE_URL=https://controller-beta.thetaedgecloud.com \
  -- npx -y @thetalabs/on-demand-api-mcp@beta
```

Replace `your-api-key-here` with your actual API key.

**Verify it's working:**
```bash
claude mcp list
```

You should see `theta-edgecloud` with status `✓ Connected`.

## Getting Your API Key

1. Visit [https://www.thetaedgecloud.com/dashboard/api-keys](https://www.thetaedgecloud.com/dashboard/api-keys)
2. Create a new API key
3. Add it to your MCP configuration

## Available Tools

### `list_services`

Discover available AI models and their capabilities.

```
list_services()
list_services(category="image")
```

### `infer`

Run AI inference on any model.

```
# Transcribe audio
infer(service="whisper", input={"audio_filename": "https://example.com/audio.wav"})

# Generate an image
infer(service="flux-1-schnell", input={"prompt": "A sunset over mountains"})

# Chat with an LLM
infer(service="llama-3-1-8b", input={"messages": [{"role": "user", "content": "Hello!"}]})
```

**Parameters:**
- `service` (required) - Service alias (e.g., "whisper", "flux-1-schnell")
- `input` (required) - Input parameters (varies by service)
- `wait` (optional) - Seconds to wait for result (0-60, default 30)
- `variant` (optional) - Model variant if available (e.g., "turbo")

### `get_request_status`

Check the status of an async inference request.

```
get_request_status(request_id="infer_abc123")
```

### `get_upload_url`

Get a presigned URL to upload a local file.

```
get_upload_url(service="whisper", input_field="audio_filename")
```

### GPU Node and billing tools

Resource discovery and read operations:

```text
list_gpu_resources()
get_gpu_resource(resource_id="community_example")
list_gpu_deployment_templates()
list_gpu_deployments()
get_gpu_deployment(deployment_id="dplb_example")
get_gpu_deployment_events(deployment_id="dplb_example")
get_gpu_deployment_logs(deployment_id="dplb_example")
```

Lifecycle operations require explicit confirmation. Community deployment creation also requires an hourly price ceiling:

```text
create_gpu_deployment(
  deployment_template_id="dplt_example",
  resource_id="community_example",
  container_image="example/gpu:latest",
  ssh_public_key="ssh-ed25519 ...",
  max_price_per_hour_usd=0.25,
  confirm=true
)
stop_gpu_deployment(deployment_id="dplb_example", confirm=true)
start_gpu_deployment(deployment_id="dplb_example", confirm=true)
delete_gpu_deployment(deployment_id="dplb_example", confirm=true)
```

Billing tools are read-only. Usage is project-scoped; balance and sanitized top-up history are organization-scoped:

```text
get_billing_balance()
get_billing_usage(start_date="2026-07-01", end_date="2026-07-21")
get_billing_pricing()
list_billing_top_ups(page=1, number=20)
```

## Example Conversations

**User:** "What AI models are available on Theta EdgeCloud?"

**Claude:** *calls list_services()* "Here are the available models..."

---

**User:** "Transcribe this audio file: https://example.com/meeting.wav"

**Claude:** *calls infer(service="whisper", input={"audio_filename": "..."})* "Here's the transcription..."

---

**User:** "Generate an image of a cyberpunk cityscape"

**Claude:** *calls infer(service="flux-1-schnell", input={"prompt": "cyberpunk cityscape at night, neon lights"})* "Here's your image: [URL]"

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `THETA_API_KEY` | Your Theta EdgeCloud API key | Yes |
| `THETA_API_BASE_URL` | On-demand API base URL (default: https://ondemand.thetaedgecloud.com) | No |
| `THETA_PROJECT_ID` | Project used by GPU Node and billing tools | For resource tools |
| `THETA_CONTROLLER_BASE_URL` | Controller URL; use beta while the v1 APIs are beta-only | For resource tools |

## Development

```bash
# Clone the repo
git clone https://github.com/thetatoken/on-demand-api-mcp
cd on-demand-api-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
THETA_API_KEY=your-key npm start
```

## Publishing

### 1. Publish to npm

```bash
# Login to npm (if not already)
npm login

# Publish the package
npm publish --access public --tag beta
```

The package will be available as `@thetalabs/on-demand-api-mcp` on npm.

### 2. Register with MCP Registry

The [MCP Registry](https://registry.modelcontextprotocol.io) is the official directory for MCP servers. Registering makes the server discoverable by MCP-compatible clients.

```bash
# Clone the registry repo
git clone https://github.com/modelcontextprotocol/registry
cd registry

# Build the publisher tool
make publisher

# Publish your server (requires authentication)
./bin/mcp-publisher --help
```

**Namespace options:**

| Namespace Type | Example | Verification |
|----------------|---------|--------------|
| GitHub-based | `io.github.thetalabs/on-demand-api-mcp` | GitHub OAuth |
| Domain-based | `thetaedgecloud.com/on-demand-api-mcp` | DNS or HTTP challenge |

### 3. Automated Publishing (CI/CD)

For GitHub Actions, use GitHub OIDC authentication:

```yaml
# .github/workflows/publish.yml
name: Publish to MCP Registry
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci && npm run build
      - run: npm publish --access public --tag beta
      # Add MCP registry publishing step here
```

## License

MIT

## Links

- [Theta EdgeCloud](https://www.thetaedgecloud.com)
- [API Documentation](https://docs.thetaedgecloud.com)
- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Registry](https://registry.modelcontextprotocol.io)
