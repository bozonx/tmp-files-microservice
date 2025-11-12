# n8n Node: Bozonx Temporary Files

 Upload a binary file or a file URL to the temporary files microservice and get back a temporary link.

 [n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

 - **[Installation](#installation)**
 - **[How it works](#how-it-works)**
 - **[Credentials](#credentials)**
 - **[Parameters](#parameters)**
 - **[Usage examples](#usage-examples)**
 - **[Continue On Fail](#continue-on-fail)**
 - **[Compatibility](#compatibility)**
 - **[Resources](#resources)**

 ## Installation

 Follow the official guide for installing community nodes: [Community Nodes Installation](https://docs.n8n.io/integrations/community-nodes/installation/).

 Search for and install the package: `n8n-nodes-bozonx-tmp-files-microservice`.

 ## How it works

 The node sends a `POST` request to your API Gateway using the following URL pattern:

 `{{gatewayUrl}}/{{basePath}}/files`

 or for URL uploads:

 `{{gatewayUrl}}/{{basePath}}/files/url`

 - `gatewayUrl` comes from Credentials.
 - `basePath` is a node parameter (default: `tmp-files/api/v1`). Leading and trailing slashes are ignored.
 - Authorization is injected automatically via a Bearer token from Credentials.
 - The node returns the service response as JSON unchanged.

 Endpoints and payloads:

 - Binary upload: `POST /files` with `multipart/form-data` containing fields `file`, `ttlMins`, and optional `metadata`.
 - URL upload: `POST /files/url` with JSON `{ url: string, ttlMins: number, metadata?: string }`.

 ## Credentials

 Uses custom credentials: `Bozonx Microservices API`.

 - **Gateway URL** (required)
   - Example: `https://micros.example.com`
   - Do not include the API path (no `/api/v1` here).
 - **API Token** (required)
   - Used as `Authorization: Bearer <token>`.

 ### Notes

 - The `Gateway URL` must include the protocol (`http://` or `https://`).
 - Do not add a trailing slash to `Gateway URL` (the node will trim it if present).
 - `Base Path` may be provided with or without slashes; the node trims leading/trailing slashes.
 - For URL uploads, `File URL` must be a non-empty absolute URL.
 - `Metadata (JSON)` is sent as a string field; provide a valid JSON string if your backend validates it.

 You can use expressions to pull values from environment variables:

 - Gateway URL: `{{$env.GATEWAY_URL}}`
 - API Token: `{{$env.API_TOKEN}}`

 ## Parameters

 - **Base Path** (string, default: `tmp-files/api/v1`)
   - API base path appended to `Gateway URL`. Leading/trailing slashes are ignored.
 - **Source Type** (options: `Binary`, `URL`, default: `Binary`)
 - **Binary Property** (string, default: `data`)
   - Name of the binary property from the incoming item. Visible only when `Source Type = Binary`.
 - **File URL** (string)
   - Direct URL to the file. Visible only when `Source Type = URL`.
 - **TTL Value** (number, min: `1`, default: `1`)
  - Time to live value before the file is removed by the microservice.
 - **TTL Unit** (options: `Minutes`, `Hours` [default], `Days`)
  - Unit for the TTL value. The node converts this to minutes (`ttlMins`) for the API.
 - **Metadata (JSON)** (string)
   - Optional JSON string to associate with the file.

 ## Usage examples

 - Binary upload

   1. Set `Source Type = Binary`.
   2. Ensure your incoming item has a binary property (default: `data`).
   3. Configure `TTL Value`, `TTL Unit` and optional `Metadata (JSON)`.

 - URL upload

   1. Set `Source Type = URL`.
   2. Provide the `File URL`.
   3. Configure `TTL Value`, `TTL Unit` and optional `Metadata (JSON)`.

 ## Continue On Fail

 When enabled in node Settings, the node does not stop on the first failed item:

 - Failed items are returned with `json.error` and maintain a link to the original via `pairedItem`.
 - Successful items return the microservice JSON response.

 Enable under: Node → Settings → toggle “Continue On Fail”.

 ## Compatibility

 Works with n8n `1.60.0+`. Newer versions of n8n are recommended.

 ## Resources

 - n8n Community Nodes: https://docs.n8n.io/integrations/#community-nodes
