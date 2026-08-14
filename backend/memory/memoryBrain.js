const memoryAdapter = require("./memoryAdapter")
const ombreClient = require("./ombreClient")
const memoryJudge = require("./memoryJudge")
const identityManager = require("./identityManager")

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function classifyMemoryText(text) {
  const lower = normalizeText(text).toLowerCase()
  if (!lower) return "experience"
  if (/我是谁|身份|我的名字|我是|我叫|用户信息|个人信息/.test(lower)) return "identity"
  if (/我喜欢|我讨厌|我不喜欢|爱好|偏好|习惯|喜欢猫|喜欢狗/.test(lower)) return "preference"
  if (/项目|开发|接入|部署|机器人|mcp|claude|vps|myaihome|目标|计划|未来想/.test(lower)) return "project"
  if (/家人|朋友|伴侣|关系/.test(lower)) return "relationship"
  if (/目标|愿望|计划/.test(lower)) return "goal"
  return "experience"
}

function priorityWeight(category) {
  const order = {
    identity: 5,
    preference: 4,
    project: 3,
    relationship: 2,
    goal: 2,
    experience: 1,
  }
  return order[category] || 0
}

function dedupeAndRank(memories, limit = 5) {
  const normalized = (Array.isArray(memories) ? memories : [])
    .map((item) => {
      const raw = typeof item === "string" ? item : (item && item.content ? item.content : String(item || ""))
      const text = normalizeText(raw)

      if (!text) {
        return null
      }

      const weightMatch = text.match(/\[权重:(\d+(?:\.\d+)?)\]/i)
      const importance = weightMatch ? Number(weightMatch[1]) : 0
      const category = classifyMemoryText(text)

      return {
        content: text,
        importance,
        category,
        source: "ombre",
      }
    })
    .filter(Boolean)

  const seen = new Set()
  const unique = []

  for (const entry of normalized) {
    const key = entry.content.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
  }

  unique.sort((a, b) => {
    const priorityDiff = priorityWeight(b.category) - priorityWeight(a.category)
    if (priorityDiff !== 0) return priorityDiff
    return (b.importance || 0) - (a.importance || 0)
  })

  return unique.slice(0, limit)
}

function compactMemoryText(memories) {
  return (Array.isArray(memories) ? memories : []).map((point) => ({
    content: normalizeText(point && point.content ? point.content : point),
    importance: point && point.importance != null ? point.importance : "",
    source: "ombre",
  })).filter((point) => point.content)
}

function filterOutLowPriorityEntries(memories) {
  return (Array.isArray(memories) ? memories : [])
    .filter((entry) => {
      const text = normalizeText(typeof entry === "string" ? entry : (entry && entry.content ? entry.content : String(entry || "")))
      if (!text) return false
      if (/test|eval|temporary|debug|smoke|abc|retry probe/i.test(text)) return false
      if (/\b(hello|hi|ok|谢谢|晚安|你好)\b/i.test(text)) return false
      return true
    })
}

function normalizeMemoryItem(item, category = "experience") {
  const content = normalizeText(typeof item === "string" ? item : (item && item.content ? item.content : String(item || "")))
  if (!content) return null

  const importanceMatch = content.match(/\[权重:(\d+(?:\.\d+)?)\]/i)
  const importance = importanceMatch ? Number(importanceMatch[1]) : 0

  return {
    content,
    importance,
    category,
    createdAt: new Date().toISOString(),
    lastAccess: new Date().toISOString(),
    source: "MyAIHome",
  }
}

async function beforeChat(message, context = {}) {
  const text = normalizeText(message)
  if (!text) {
    return { memories: [], contextText: "" }
  }

  try {
    const identity = await identityManager.getIdentity()
    const enabled = !!(process.env.OMBRE_ENABLED === "true" || process.env.OMBRE_MCP_URL)
    if (!enabled) {
      return { memories: [], identity: identity || {}, contextText: "" }
    }

    let candidateMemories = []

    const breathResult = await ombreClient.breath()
    if (breathResult && breathResult.ok && breathResult.contextText) {
      candidateMemories = filterOutLowPriorityEntries(breathResult.memories || [])
    }

    if (!candidateMemories.length) {
      const searchResult = await ombreClient.breathSearch(text, { max_results: 5 })
      if (searchResult && searchResult.ok) {
        candidateMemories = filterOutLowPriorityEntries(searchResult.memories || [])
      }
    }

    const deduped = dedupeAndRank(candidateMemories, 5)
    const filtered = deduped
      .map((item) => normalizeMemoryItem(item, item && item.category ? item.category : "experience"))
      .filter(Boolean)

    return {
      memories: filtered.map((item) => ({
        content: item.content,
        importance: item.importance,
        source: item.source,
        category: item.category,
      })),
      identity: identity || {},
      contextText: filtered.map((item) => item.content).join("\n---\n"),
    }
  } catch (error) {
    const identity = await identityManager.getIdentity().catch(() => ({}))
    return { memories: [], identity: identity || {}, contextText: "" }
  }
}

async function afterChat(message, reply, context = {}) {
  const combined = `${normalizeText(message)}\n${normalizeText(reply)}`.trim()
  if (!combined) {
    return { ok: true, saved: false }
  }

  const judgment = memoryJudge.judgeMemory(message, reply, context)
  if (!judgment.shouldStore) {
    return { ok: true, saved: false, reason: "low-value chat", level: judgment.level }
  }

  try {
    const text = normalizeText(`${message}\n${reply}`)
    const memoryPath = context && context.memoryPath ? context.memoryPath : undefined
    const category = judgment.level === "high" && /我(喜欢|讨厌|不喜欢|叫|是谁)|身份|名字|爱好|习惯|偏好/.test(text)
      ? "preference"
      : judgment.level === "high" && /项目|目标|计划|正在做|未来想|接入|部署|控制/.test(text)
        ? "project"
        : judgment.level === "high" && /家人|朋友|伴侣|关系/.test(text)
          ? "relationship"
          : judgment.level === "high" && /目标|愿望|计划/.test(text)
            ? "goal"
            : judgment.level === "high"
              ? "identity"
              : "experience"

    const metadata = {
      importance: judgment.level === "high" ? 8 : 6,
      category,
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString(),
      source: "MyAIHome",
    }

    const breath = await ombreClient.breath()
    const strongMemories = breath && breath.ok ? (breath.memories || []) : []
    const duplicate = strongMemories.some((entry) => {
      const existingText = normalizeText(typeof entry === "string" ? entry : (entry && entry.content ? entry.content : String(entry || "")))
      if (!existingText || !text) return false
      const base = existingText.toLowerCase()
      const current = text.toLowerCase()
      const overlap = base.includes(current) || current.includes(base)
      return overlap || (base.length > 8 && current.length > 8 && (base.split(/\s+/).filter(Boolean).length / current.split(/\s+/).filter(Boolean).length) > 0.8)
    })

    if (duplicate) {
      return {
        ok: true,
        saved: false,
        duplicate: true,
        reason: "duplicate memory detected",
        level: judgment.level,
        category,
      }
    }

    const shouldGrow = memoryJudge.shouldUseGrow(message, reply, judgment)

    if (shouldGrow) {
      const items = memoryJudge.buildGrowItems(message, reply)
      const result = await ombreClient.grow(text, items.map((item) => ({
        ...item,
        category,
        metadata,
      })), {
        title: "MyAIHome long-form memory",
        tags: ["chat", judgment.level, category],
        importance: metadata.importance,
      })
      return {
        ok: true,
        saved: !!(result && result.ok),
        mode: "grow",
        level: judgment.level,
        category,
        result,
      }
    }

    const result = await memoryAdapter.remember(text, {
      memoryPath,
      title: "MyAIHome long-term memory",
      tags: ["chat", judgment.level, category],
      importance: metadata.importance,
      source_bucket: "chat",
      why_remembered: judgment.reasons.join(", ") || "long-term memory candidate",
      meaning: judgment.level,
      test_data: false,
      category,
      createdAt: metadata.createdAt,
      lastAccess: metadata.lastAccess,
      source: "MyAIHome",
    })

    return {
      ok: true,
      saved: !!(result && result.ok),
      mode: "hold",
      level: judgment.level,
      category,
      result,
    }
  } catch (error) {
    return {
      ok: false,
      saved: false,
      level: judgment.level,
      error: error && error.message ? error.message : String(error),
    }
  }
}

module.exports = {
  beforeChat,
  afterChat,
}
