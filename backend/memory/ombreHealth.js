const ombreClient = require("./ombreClient")

async function checkConnection() {
  try {
    const init = await ombreClient.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "MyAIHome-OmbreHealth",
        version: "1.0.0",
      },
    })

    const toolsResponse = await ombreClient.request("tools/list", {})
    const toolNames = toolsResponse && toolsResponse.ok && toolsResponse.data && Array.isArray(toolsResponse.data.result && toolsResponse.data.result.tools)
      ? toolsResponse.data.result.tools.map((tool) => tool && tool.name ? tool.name : String(tool))
      : []

    return {
      ok: !!(init && init.ok && toolsResponse && toolsResponse.ok),
      endpoint: ombreClient.url,
      authenticated: !!(ombreClient.token && ombreClient.token.trim()),
      tools: toolNames,
      initialized: !!(init && init.ok),
      init,
      toolsResult: toolsResponse,
    }
  } catch (error) {
    return {
      ok: false,
      endpoint: ombreClient.url,
      authenticated: !!(ombreClient.token && ombreClient.token.trim()),
      tools: [],
      error: error && error.message ? error.message : String(error),
    }
  }
}

module.exports = {
  checkConnection,
}
