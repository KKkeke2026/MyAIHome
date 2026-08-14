const fs = require("fs")
const path = require("path")
const ombreClient = require("./ombreClient")

const IDENTITY_PATH = path.join(__dirname, "identity.json")

function normalizeObject(value) {
  if (!value || typeof value !== "object") {
    return {}
  }

  return value
}

function readIdentityFile() {
  try {
    if (!fs.existsSync(IDENTITY_PATH)) {
      return {
        aiIdentity: "",
        userProfile: {},
        goals: [],
        projects: [],
        interactionHabits: [],
        updatedAt: null,
      }
    }

    const raw = fs.readFileSync(IDENTITY_PATH, "utf-8")
    return normalizeObject(JSON.parse(raw))
  } catch (error) {
    return {
      aiIdentity: "",
      userProfile: {},
      goals: [],
      projects: [],
      interactionHabits: [],
      updatedAt: null,
    }
  }
}

function writeIdentityFile(data) {
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(data, null, 2), "utf-8")
}

async function getIdentity() {
  const existing = readIdentityFile()

  try {
    const enabled = !!(process.env.OMBRE_ENABLED === "true" || process.env.OMBRE_MCP_URL)
    if (!enabled) {
      return existing
    }

    const result = await ombreClient.breathSearch("我是谁", { max_results: 3 })
    if (result && result.ok && result.contextText) {
      const identityHint = String(result.contextText || "").trim()
      if (identityHint) {
        existing.identityHint = identityHint
      }
    }
  } catch (error) {
    // no-op: identity is kept in the local JSON cache
  }

  return existing
}

async function updateIdentity(data = {}) {
  const current = readIdentityFile()
  const next = {
    aiIdentity: data.aiIdentity || current.aiIdentity || "",
    userProfile: {
      ...(current.userProfile || {}),
      ...(data.userProfile || {}),
    },
    goals: Array.isArray(data.goals) ? data.goals : (current.goals || []),
    projects: Array.isArray(data.projects) ? data.projects : (current.projects || []),
    interactionHabits: Array.isArray(data.interactionHabits) ? data.interactionHabits : (current.interactionHabits || []),
    updatedAt: new Date().toISOString(),
  }

  writeIdentityFile(next)

  try {
    const enabled = !!(process.env.OMBRE_ENABLED === "true" || process.env.OMBRE_MCP_URL)
    if (!enabled) {
      return { ok: true, identity: next }
    }

    const summaryText = [
      next.aiIdentity,
      Object.entries(next.userProfile || {}).map(([key, value]) => `${key}:${value}`).join("; "),
      next.goals.join("; "),
      next.projects.join("; "),
      next.interactionHabits.join("; "),
    ].filter(Boolean).join("\n")

    if (!summaryText.trim()) {
      return { ok: true, identity: next }
    }

    const result = await ombreClient.I(summaryText)
    return {
      ok: !!(result && result.ok),
      identity: next,
      result,
    }
  } catch (error) {
    return {
      ok: true,
      identity: next,
      warning: error && error.message ? error.message : String(error),
    }
  }
}

module.exports = {
  getIdentity,
  updateIdentity,
}
