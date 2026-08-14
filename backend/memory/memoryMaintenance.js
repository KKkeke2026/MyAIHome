const ombreClient = require("./ombreClient")

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function similarity(a, b) {
  const left = normalizeText(a).toLowerCase()
  const right = normalizeText(b).toLowerCase()
  if (!left || !right) return 0
  if (left === right) return 1
  const aWords = new Set(left.split(/\s+/))
  const bWords = new Set(right.split(/\s+/))
  const intersection = [...aWords].filter((word) => bWords.has(word)).length
  const union = new Set([...aWords, ...bWords]).size
  return union ? intersection / union : 0
}

function scoreMemoryDecay(memory, now = Date.now()) {
  const raw = memory || {}
  const importance = Number(raw.importance || 0)
  const lastAccess = raw.lastAccess ? new Date(raw.lastAccess).getTime() : now
  const ageDays = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24))
  const decay = Math.max(0, 1 - ageDays / 180)
  const weighted = Math.max(0, importance * decay)
  return {
    ...raw,
    importance: weighted,
    decayed: weighted < 1.5,
  }
}

async function cleanup() {
  try {
    const breath = await ombreClient.breath()
    if (!breath || !breath.ok || !breath.contextText) {
      return {
        ok: true,
        removed: 0,
        reason: "no active memory pool entries to clean",
      }
    }

    const raw = breath.contextText || ""
    const lines = raw.split(/\n---\n|\n-\-\-\n/)
      .map((item) => normalizeText(item))
      .filter(Boolean)

    const testMemories = lines.filter((item) => /test|eval|temporary|debug|smoke/i.test(item))
    const duplicates = []
    for (let i = 0; i < lines.length; i += 1) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (similarity(lines[i], lines[j]) >= 0.7) {
          duplicates.push({ left: lines[i], right: lines[j] })
        }
      }
    }

    let removed = 0
    for (const item of testMemories) {
      const match = item.match(/\[bucket_id:([A-Za-z0-9]+)\]/)
      if (match && match[1]) {
        const resp = await ombreClient.trace(match[1], { action: "delete" })
        if (resp && resp.ok) {
          removed += 1
        }
      }
    }

    return {
      ok: true,
      removed,
      candidates: testMemories.length + duplicates.length,
      duplicates,
    }
  } catch (error) {
    return {
      ok: false,
      removed: 0,
      error: error && error.message ? error.message : String(error),
    }
  }
}

async function syncIdentity(identityText) {
  const text = normalizeText(identityText)
  if (!text) {
    return {
      ok: false,
      saved: false,
      reason: "missing identity text",
    }
  }

  try {
    const result = await ombreClient.I(text)
    return {
      ok: !!(result && result.ok),
      saved: !!(result && result.ok),
      result,
    }
  } catch (error) {
    return {
      ok: false,
      saved: false,
      error: error && error.message ? error.message : String(error),
    }
  }
}

async function updateImportance(memory, metrics = {}) {
  const safeMetrics = metrics || {}
  const recalled = Number(safeMetrics.recalled || 0)
  const recentUsage = Number(safeMetrics.recentUsage || 0)
  const repeatedMentions = Number(safeMetrics.repeatedMentions || 0)
  const base = Number(memory && memory.importance ? memory.importance : 0)
  const updated = base + recalled * 0.4 + recentUsage * 0.3 + repeatedMentions * 0.5

  return {
    ...memory,
    importance: Math.max(0, updated),
    lastAccess: safeMetrics.lastAccess || memory.lastAccess || new Date().toISOString(),
  }
}

async function forgetting(memories = [], now = Date.now()) {
  return (Array.isArray(memories) ? memories : []).map((memory) => {
    const scored = scoreMemoryDecay(memory, now)
    return {
      ...memory,
      importance: scored.importance,
      decayed: scored.decayed,
    }
  })
}

module.exports = {
  cleanup,
  syncIdentity,
  updateImportance,
  forgetting,
  similarity,
}
