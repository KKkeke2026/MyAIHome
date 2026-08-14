const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const DEFAULT_MCP_URL = process.env.OMBRE_MCP_URL || "http://127.0.0.1:18001/mcp";
const DEFAULT_MCP_TOKEN = process.env.OMBRE_MCP_TOKEN || "";

function safeString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseSsePayload(raw) {
  if (!raw || !raw.trim()) {
    return [];
  }

  const events = [];
  const lines = raw.split(/\r?\n/);
  let buffer = [];

  const flush = () => {
    if (!buffer.length) {
      return;
    }

    const text = buffer
      .map((line) => line.replace(/^data:\s?/, "").trim())
      .filter(Boolean)
      .join("\n");

    if (text) {
      events.push(text);
    }
    buffer = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }

    if (line.startsWith("data:")) {
      buffer.push(line);
    } else if (line.startsWith("event:")) {
      continue;
    } else if (line.startsWith(":")) {
      continue;
    } else if (buffer.length) {
      buffer.push(line);
    }
  }

  flush();
  return events;
}

function parseMcpJson(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    throw new Error("Empty response body");
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    return JSON.parse(text);
  }

  const ssePayloads = parseSsePayload(text);
  if (ssePayloads.length > 0) {
    for (const entry of ssePayloads) {
      try {
        return JSON.parse(entry);
      } catch (error) {
        // keep scanning next SSE payload
      }
    }
  }

  throw new Error(`Unable to parse MCP response: ${text.slice(0, 200)}`);
}

function extractResultText(result) {
  if (!result || typeof result !== "object") {
    return "";
  }

  if (Array.isArray(result.content)) {
    const textParts = result.content
      .map((item) => {
        if (item && typeof item === "object") {
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.type === "string" && item.type === "text") {
            return safeString(item.text || "");
          }
        }
        return "";
      })
      .filter(Boolean);

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  if (result.structuredContent && typeof result.structuredContent === "object") {
    const structuredResult = result.structuredContent.result;
    if (typeof structuredResult === "string") {
      return structuredResult;
    }
  }

  return "";
}

function parseToolResult(result) {
  const fallbackText = extractResultText(result);
  return {
    text: fallbackText,
    raw: result || null,
  };
}

function sanitizeToolArgs(toolName, args = {}) {
  const source = args && typeof args === "object" ? args : {};

  if (toolName === "hold") {
    const sanitized = {};
    if (source.content !== undefined && source.content !== null) {
      sanitized.content = String(source.content);
    }
    if (source.title !== undefined && source.title !== null && String(source.title).trim()) {
      sanitized.title = String(source.title);
    }
    if (source.tags !== undefined && source.tags !== null && String(source.tags).trim()) {
      sanitized.tags = String(source.tags);
    }
    if (source.importance !== undefined && source.importance !== null && Number.isFinite(Number(source.importance))) {
      sanitized.importance = Number(source.importance);
    }
    return sanitized;
  }

  if (toolName === "grow") {
    const sanitized = {};
    if (source.content !== undefined && source.content !== null) {
      sanitized.content = String(source.content);
    }

    const items = Array.isArray(source.items) ? source.items : [];
    sanitized.items = items
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const content = item.content !== undefined && item.content !== null ? String(item.content) : "";
        const title = item.title !== undefined && item.title !== null ? String(item.title) : "";
        if (!content && !title) {
          return null;
        }
        return { content, title };
      })
      .filter(Boolean);

    return sanitized;
  }

  if (toolName === "I") {
    const sanitized = {};
    if (source.content !== undefined && source.content !== null) {
      sanitized.content = String(source.content);
    }
    return sanitized;
  }

  return source;
}

class OmbreClient {
  constructor(options = {}) {
    this.url = options.url || DEFAULT_MCP_URL;
    this.token = options.token ?? DEFAULT_MCP_TOKEN;
    this.timeoutMs = options.timeoutMs || 30000;
    this.sessionId = options.sessionId || null;
    this.initialized = false;
    this.initPromise = null;
    this.serverInfo = null;
  }

  redactHeaders(headers = {}) {
    const redacted = { ...headers };
    if (redacted.Authorization) {
      redacted.Authorization = "Bearer [exists]";
    }
    if (redacted["Ombre-MCP-Token"]) {
      redacted["Ombre-MCP-Token"] = "[exists]";
    }
    return redacted;
  }

  buildHeaders() {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };

    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers["Ombre-MCP-Token"] = this.token;
    }

    return headers;
  }

  async initialize() {
    if (this.initialized) {
      return { ok: true, sessionId: this.sessionId, serverInfo: this.serverInfo };
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const initResponse = await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "MyAIHome-OmbreClient",
          version: "1.0.0",
        },
      });

      if (!initResponse.ok) {
        throw new Error(initResponse.error || "MCP initialize failed");
      }

      this.serverInfo = initResponse.data && initResponse.data.result ? initResponse.data.result.serverInfo || null : null;
      this.initialized = true;
      return {
        ok: true,
        sessionId: this.sessionId,
        serverInfo: this.serverInfo,
      };
    })().catch((error) => {
      this.initPromise = null;
      throw error;
    });

    return this.initPromise;
  }

  async request(method, params = {}) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `req-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      params,
    });

    const headers = this.buildHeaders();
    console.log("[OmbreClient.request]", {
      url: this.url,
      httpMethod: "POST",
      headers: this.redactHeaders(headers),
      body: payload,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: payload,
        signal: controller.signal,
      });

      const raw = await response.text();
      console.log("[OmbreClient.response]", {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: raw ? raw.slice(0, 500) : "[empty]",
      });

      if (response.status >= 400) {
        return {
          ok: false,
          status: response.status,
          error: raw || "Ombre MCP request failed",
        };
      }

      if (!raw || !raw.trim()) {
        return {
          ok: false,
          status: response.status,
          error: "Invalid JSON response from Ombre MCP: Empty response body",
        };
      }

      try {
        const data = parseMcpJson(raw);

        if (data && data.error) {
          return {
            ok: false,
            status: response.status,
            error: data.error.message || JSON.stringify(data.error),
            raw: data,
          };
        }

        return {
          ok: true,
          status: response.status,
          data,
        };
      } catch (error) {
        return {
          ok: false,
          status: response.status,
          error: `Invalid JSON response from Ombre MCP: ${raw || error.message}`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: error && error.message ? error.message : "Unknown Ombre MCP error",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async callTool(name, argumentsObject = {}) {
    await this.initialize();

    const safeArguments = sanitizeToolArgs(name, argumentsObject);
    const requestResult = await this.request("tools/call", {
      name,
      arguments: safeArguments,
    });

    if (!requestResult.ok) {
      return {
        ok: false,
        error: requestResult.error,
        status: requestResult.status,
        raw: requestResult,
      };
    }

    const payload = requestResult.data && requestResult.data.result ? requestResult.data.result : {};
    const parsed = parseToolResult(payload);

    if (payload && payload.isError) {
      return {
        ok: false,
        error: parsed.text || "Ombre tool execution failed",
        raw: payload,
      };
    }

    return {
      ok: true,
      result: parsed.text,
      structured: payload && payload.structuredContent ? payload.structuredContent : {},
      raw: payload,
    };
  }

  async remember(content, metadata = {}) {
    await this.initialize();

    const text = safeString(content).trim();
    if (!text) {
      return {
        ok: false,
        error: "Missing memory content",
      };
    }

    const payload = {
      content: text,
      title: safeString(metadata.title || ""),
      tags: safeString(metadata.tags || ""),
      importance: Number.isFinite(metadata.importance) ? Number(metadata.importance) : 5,
      pinned: !!metadata.pinned,
      feel: !!metadata.feel,
      valence: metadata.valence != null ? Number(metadata.valence) : -1,
      arousal: metadata.arousal != null ? Number(metadata.arousal) : -1,
      source_bucket: safeString(metadata.source_bucket || ""),
      why_remembered: safeString(metadata.why_remembered || ""),
      meaning: safeString(metadata.meaning || ""),
      test_data: !!metadata.test_data,
    };

    const toolResult = await this.callTool("hold", sanitizeToolArgs("hold", payload));

    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to store memory via Ombre",
        fallback: "memory not stored",
      };
    }

    const bucketIdMatch = String(toolResult.result || "").match(/新建→([A-Za-z0-9]+)/);

    return {
      ok: true,
      bucketId: bucketIdMatch ? bucketIdMatch[1] : null,
      text: toolResult.result,
      raw: toolResult.raw,
    };
  }

  async hold(content, metadata = {}) {
    return this.remember(content, metadata);
  }

  async breath() {
    await this.initialize();
    const toolResult = await this.callTool("breath", {});
    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to fetch active Ombre memories",
        memories: [],
        contextText: "",
      };
    }

    const text = String(toolResult.result || "").trim();
    const memories = text ? [text] : [];
    return {
      ok: true,
      text,
      memories,
      contextText: text,
      raw: toolResult.raw,
    };
  }

  async breathSearch(query, options = {}) {
    await this.initialize();
    const text = safeString(query).trim();
    if (!text) {
      return {
        ok: false,
        error: "Missing recall query",
        memories: [],
        contextText: "",
      };
    }

    const payload = {
      query: text,
      max_results: Number.isFinite(options.max_results) ? Number(options.max_results) : 5,
    };

    if (options.domain) {
      payload.domain = String(options.domain);
    }

    const toolResult = await this.callTool("breath_search", payload);
    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to recall memory via Ombre",
        memories: [],
        contextText: "",
      };
    }

    const resultText = String(toolResult.result || "").trim();
    const memories = resultText ? [resultText] : [];
    return {
      ok: true,
      query: text,
      text: resultText,
      memories,
      contextText: resultText,
      raw: toolResult.raw,
    };
  }

  async grow(content, items = [], metadata = {}) {
    await this.initialize();
    const text = safeString(content).trim();
    if (!text) {
      return {
        ok: false,
        error: "Missing grow content",
      };
    }

    const itemList = Array.isArray(items) && items.length > 0
      ? items
      : [{ title: safeString(metadata.title || "Long-form memory"), content: text }];

    const toolArgs = sanitizeToolArgs("grow", {
      content: text,
      items: itemList,
    });

    const toolResult = await this.callTool("grow", toolArgs);

    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to grow memory via Ombre",
      };
    }

    return {
      ok: true,
      text: String(toolResult.result || ""),
      raw: toolResult.raw,
    };
  }

  async trace(bucketId, fields = {}) {
    await this.initialize();
    if (!bucketId) {
      return {
        ok: false,
        error: "Missing bucketId for trace",
      };
    }

    const toolResult = await this.callTool("trace", {
      bucket_id: String(bucketId),
      ...fields,
    });

    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to trace memory via Ombre",
      };
    }

    return {
      ok: true,
      text: String(toolResult.result || ""),
      raw: toolResult.raw,
    };
  }

  async I(content, options = {}) {
    await this.initialize();
    const text = safeString(content).trim();
    if (!text) {
      return {
        ok: false,
        error: "Missing identity content",
      };
    }

    const toolArgs = sanitizeToolArgs("I", {
      content: text,
      ...options,
    });

    const toolResult = await this.callTool("I", toolArgs);

    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to save identity via Ombre",
      };
    }

    return {
      ok: true,
      text: String(toolResult.result || ""),
      raw: toolResult.raw,
    };
  }

  async recall(query) {
    await this.initialize();

    const text = safeString(query).trim();
    if (!text) {
      return {
        ok: false,
        error: "Missing recall query",
      };
    }

    const toolResult = await this.callTool("breath_search", {
      query: text,
      max_results: 5,
    });

    if (!toolResult.ok) {
      return {
        ok: false,
        error: toolResult.error || "Failed to recall memory via Ombre",
        fallback: [],
      };
    }

    const resultText = String(toolResult.result || "");
    const bucketIdMatch = resultText.match(/\[bucket_id:([A-Za-z0-9]+)\]/);

    return {
      ok: true,
      query: text,
      bucketId: bucketIdMatch ? bucketIdMatch[1] : null,
      text: resultText,
      matches: resultText ? [resultText] : [],
      raw: toolResult.raw,
    };
  }
}

module.exports = new OmbreClient();
module.exports.OmbreClient = OmbreClient;
