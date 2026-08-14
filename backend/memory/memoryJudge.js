function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function splitFacts(text) {
  const cleaned = normalizeText(text)
  if (!cleaned) return []

  const candidates = cleaned
    .split(/[。.!?\n]+|\s*;\s*|\s*，\s*|\s*\|\s*/)
    .map((part) => normalizeText(part))
    .filter((part) => part.length >= 8)

  return [...new Set(candidates)]
}

function hasLongTermSignals(text) {
  const lower = text.toLowerCase()
  const markers = [
    "记住",
    "我喜欢",
    "我讨厌",
    "我不喜欢",
    "我叫",
    "我是谁",
    "身份",
    "名字",
    "长期偏好",
    "项目",
    "计划",
    "目标",
    "未来",
    "爱好",
    "习惯",
    "希望",
    "要求",
    "重要关系",
    "家人",
    "朋友",
    "伴侣",
    "工作流",
    "愿望",
    "偏好",
    "目标是",
    "想要",
    "需要",
    "正在做",
    "接入",
    "部署",
    "控制机器人",
    "未来想",
  ]

  return markers.some((marker) => lower.includes(marker.toLowerCase()))
}

function judgeMemory(message, reply, context = {}) {
  const text = normalizeText(`${message || ""}\n${reply || ""}`)
  if (!text) {
    return {
      level: "low",
      reason: "empty",
      shouldStore: false,
      confidence: 0,
      facts: [],
    }
  }

  const lower = text.toLowerCase()
  const facts = splitFacts(text)

  const highSignals = [
    /我叫|我是|我的名字|身份|个人信息|住在|家人|朋友|伴侣|家属|儿子|女儿|父母|妻子|丈夫/,
    /长期偏好|长期目标|项目规划|未来想|计划|目标|愿望|偏好|重要关系|我喜欢|我讨厌|我不喜欢|爱好|习惯|命名|记住/,
    /正在做.*(项目|开发|部署|接入|集成|机器人|mcp|claude|vps|docker|代码)/i,
    /我想.*(控制|做|开发|学习|实现|管理)/i,
  ]

  const mediumSignals = [
    /现在|正在|最近|持续|一直|经常|今天|这几天|当前|本周|后续|接下来/,
    /关注|在做|在研究|在计划|在学习|在部署|在接入/,
  ]

  const lowSignals = [
    /今天午饭|吃了|喝了|看了|去了|坐车|天气|电影|游戏/,
    /普通聊天|随便说|hello|hi|ok|谢谢|很好/,
  ]

  let level = "low"
  let reasons = []

  if (highSignals.some((pattern) => pattern.test(text))) {
    level = "high"
    reasons.push("high-value personal context")
  } else if (lowSignals.some((pattern) => pattern.test(text))) {
    level = "low"
    reasons.push("daily-life conversational content")
  } else if (mediumSignals.some((pattern) => pattern.test(text)) && hasLongTermSignals(text)) {
    level = "medium"
    reasons.push("ongoing personal attention")
  } else if (hasLongTermSignals(text)) {
    level = "high"
    reasons.push("explicit personal preference or identity")
  } else if (mediumSignals.some((pattern) => pattern.test(text))) {
    level = "medium"
    reasons.push("recent focus with durable relevance")
  }

  const shouldStore = level === "high" || level === "medium"

  return {
    level,
    reasons,
    shouldStore,
    confidence: level === "high" ? 0.9 : level === "medium" ? 0.6 : 0.1,
    facts,
    text,
  }
}

function shouldUseGrow(message, reply, judgment) {
  const text = normalizeText(`${message || ""}\n${reply || ""}`)
  if (!text) return false

  const facts = splitFacts(text)
  const factCount = facts.length
  const lengthThreshold = 120

  const multiFact = factCount >= 2 || /(?:\n|;|，|。)/.test(text)

  const longEnough = text.length >= lengthThreshold
  const shouldGrowCandidate = judgment && (judgment.level === "high" || judgment.level === "medium") && (longEnough || multiFact)

  return !!shouldGrowCandidate
}

function buildGrowItems(message, reply) {
  const text = normalizeText(`${message || ""}\n${reply || ""}`)
  const facts = splitFacts(text)
  if (facts.length > 0) {
    return facts.map((item) => ({
      title: "long-term memory",
      content: item,
    }))
  }

  return [{
    title: "long-term memory",
    content: text,
  }]
}

module.exports = {
  normalizeText,
  splitFacts,
  hasLongTermSignals,
  judgeMemory,
  shouldUseGrow,
  buildGrowItems,
}
