const config = require("../config")
const memoryManager = require("../memoryManager")
const ombreClient = require("./ombreClient")

function asBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return ["1", "true", "yes", "on"].includes(normalized)
  }
  return false
}

function isOmbreEnabled() {
  const enabled = asBoolean(config.OMBRE_ENABLED)
  const hasUrl = !!String(config.OMBRE_MCP_URL || "").trim()
  const hasToken = !!String(config.OMBRE_MCP_TOKEN || "").trim()

  return enabled && hasUrl && hasToken
}

function fallbackRecall(memoryPath, query) {
  if (!memoryPath) {
    return {
      ok: false,
      source: "memoryManager",
      error: "Missing memoryPath for fallback recall",
      matches: [],
      text: "",
    }
  }

  try {
    const memories = memoryManager.loadMemory(memoryPath) || []
    const safeQuery = String(query || "").toLowerCase()
    const matches = memories
      .filter((item) => {
        if (!item || typeof item !== "object") return false
        const text = String(item.text || "").toLowerCase()
        return !safeQuery || text.includes(safeQuery)
      })
      .slice(0, 5)

    return {
      ok: true,
      source: "memoryManager",
      isFallback: true,
      query,
      matches,
      text: matches.map((item) => item.text).join("\n---\n"),
      raw: matches,
    }
  } catch (error) {
    return {
      ok: false,
      source: "memoryManager",
      error: error && error.message ? error.message : "Fallback recall failed",
      matches: [],
      text: "",
    }
  }
}

function fallbackRemember(content, metadata = {}, memoryPath) {
  if (!memoryPath) {
    return {
      ok: false,
      source: "memoryManager",
      error: "Missing memoryPath for fallback remember",
    }
  }

  const text = String(content || "").trim()
  if (!text) {
    return {
      ok: false,
      source: "memoryManager",
      error: "Missing memory content",
    }
  }

  const memoryObject = {
    text,
    type: metadata.type || "general",
    level: metadata.level || "normal",
    importance: Number.isFinite(metadata.importance) ? Number(metadata.importance) : 3,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    memoryManager.saveMemory(memoryPath, memoryObject)
    return {
      ok: true,
      source: "memoryManager",
      isFallback: true,
      data: memoryObject,
    }
  } catch (error) {
    return {
      ok: false,
      source: "memoryManager",
      error: error && error.message ? error.message : "Fallback remember failed",
    }
  }
}

async function recall(query, options = {}) {
  const safeQuery = String(query || "").trim()
  if (!safeQuery) {
    return {
      ok: false,
      error: "Missing recall query",
      matches: [],
      text: "",
    }
  }

  if (!isOmbreEnabled()) {
    return fallbackRecall(options.memoryPath, safeQuery)
  }

  try {
    const result = await ombreClient.recall(safeQuery)
    if (result && result.ok) {
      return {
        ...result,
        source: "ombre",
      }
    }

    return fallbackRecall(options.memoryPath, safeQuery)
  } catch (error) {
    return fallbackRecall(options.memoryPath, safeQuery)
  }
}

async function remember(content, metadata = {}) {
  const text = String(content || "").trim()
  if (!text) {
    return {
      ok: false,
      error: "Missing memory content",
    }
  }

  const memoryPath = metadata.memoryPath
  const payload = {
    title: metadata.title || "MyAIHome memory",
    tags: Array.isArray(metadata.tags) ? metadata.tags.join(",") : String(metadata.tags || ""),
    importance: Number.isFinite(metadata.importance) ? Number(metadata.importance) : 3,
    pinned: !!metadata.pinned,
    feel: !!metadata.feel,
    valence: metadata.valence != null ? Number(metadata.valence) : -1,
    arousal: metadata.arousal != null ? Number(metadata.arousal) : -1,
    source_bucket: metadata.source_bucket || "",
    why_remembered: metadata.why_remembered || "",
    meaning: metadata.meaning || "",
    test_data: !!metadata.test_data,
  }

  if (!isOmbreEnabled()) {
    return fallbackRemember(text, metadata, memoryPath)
  }

  try {
    const result = await ombreClient.remember(text, payload)
    if (result && result.ok) {
      return {
        ...result,
        source: "ombre",
      }
    }

    return fallbackRemember(text, metadata, memoryPath)
  } catch (error) {
    return fallbackRemember(text, metadata, memoryPath)
  }
}

module.exports = {
  isOmbreEnabled,
  remember,
  recall,
}
