const fs = require("fs")
const path = require("path")

const express = require("express")
const Anthropic = require("@anthropic-ai/sdk")

const config = require("./config")
const memoryManager = require("./memoryManager")
const memoryCleaner = require("./memoryCleaner")
const summaryManager = require("./summaryManager")
const memoryAdapter = require("./memory/memoryAdapter")
const memoryBrain = require("./memory/memoryBrain")

const {
  saveSession,
  loadSession,
  deleteSession,
} = require("./sessionManager")

const app = express()

// =====================================================
// MyAIHome V1
// 单用户 / 单房间
// =====================================================

const PORT = process.env.PORT || 3000

// 只有一个房间。
// 外部完全不需要传 roomId。
const ROOM_ID = "main"

// =====================================================
// 路径
// =====================================================

const timelinePath = path.join(
  __dirname,
  "timeline"
)

const roomPath = path.join(
  timelinePath,
  `room_${ROOM_ID}`
)

const memoryPath = path.join(
  roomPath,
  "memories.json"
)

const eventsPath = path.join(
  roomPath,
  "events.json"
)

const summaryPath = path.join(
  roomPath,
  "summaries"
)

const chatPath = path.join(
  __dirname,
  "chat_archive.json"
)

const frontendDist = path.join(
  __dirname,
  "..",
  "frontend",
  "dist"
)

// =====================================================
// 初始化目录和文件
// =====================================================

function ensureStorage() {
  fs.mkdirSync(roomPath, {
    recursive: true,
  })

  fs.mkdirSync(summaryPath, {
    recursive: true,
  })

  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(
      memoryPath,
      JSON.stringify(
        {
          memories: [],
        },
        null,
        2
      ),
      "utf-8"
    )
  }

  if (!fs.existsSync(eventsPath)) {
    fs.writeFileSync(
      eventsPath,
      JSON.stringify(
        {
          events: [],
        },
        null,
        2
      ),
      "utf-8"
    )
  }

  if (!fs.existsSync(chatPath)) {
    fs.writeFileSync(
      chatPath,
      JSON.stringify(
        {
          messages: [],
        },
        null,
        2
      ),
      "utf-8"
    )
  }
}

ensureStorage()

// =====================================================
// Claude Client
// =====================================================

const client = new Anthropic({
  apiKey: config.CHAT_API_KEY,
  baseURL: config.CHAT_BASE_URL || undefined,
})

// =====================================================
// Express
// =====================================================

app.use(
  express.json({
    limit: "20mb",
  })
)

// =====================================================
// AI 错误处理
// =====================================================

function classifyAiError(error, settings = {}) {
  const message =
    error && error.message
      ? error.message
      : ""

  const apiKey =
    (settings.apiKey &&
      String(settings.apiKey).trim()) ||
    config.CHAT_API_KEY ||
    ""

  if (!apiKey) {
    return {
      type: "missing_key",
      label: "未配置 API Key",
    }
  }

  if (
    error &&
    (
      error.status === 401 ||
      error.statusCode === 401 ||
      /invalid|unauthorized|authentication|api key/i.test(
        message
      )
    )
  ) {
    return {
      type: "invalid_key",
      label: "Key 无效",
    }
  }

  return {
    type: "request_failed",
    label: "API 请求失败",
  }
}

function buildAiErrorResponse(
  error,
  settings = {}
) {
  const reason =
    classifyAiError(
      error,
      settings
    )

  const messageMap = {
    missing_key:
      "未配置 API Key，请检查 .env。",
    invalid_key:
      "API Key 无效，请检查 API Key。",
    request_failed:
      "API 请求失败，请检查 Model、Base URL 和网络连接。",
  }

  return {
    ...reason,
    message:
      messageMap[reason.type] ||
      "API 请求失败。",
  }
}

// =====================================================
// 文本处理
// =====================================================

function cleanText(text) {
  return String(text || "")
    .replace(
      /<thinking>[\s\S]*?<\/thinking>/g,
      ""
    )
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .slice(-20)
    .map((item) => {
      const role =
        item.role === "ai"
          ? "assistant"
          : item.role

      if (
        role !== "user" &&
        role !== "assistant"
      ) {
        return null
      }

      return {
        role,
        content:
          item.text ||
          item.content ||
          "",
      }
    })
    .filter(Boolean)
}

// =====================================================
// 本地 Memory
// =====================================================

function loadLocalMemories() {
  try {
    return memoryManager.loadMemory(
      memoryPath
    )
  } catch (error) {
    console.error(
      "读取 Memory 失败:",
      error.message
    )

    return []
  }
}

function buildLocalMemoryText() {
  const memories =
    loadLocalMemories()

  if (!memories.length) {
    return "暂无本地长期记忆"
  }

  return memories
    .slice(-20)
    .map((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return ""
      }

      return `- ${item.text || ""}`
    })
    .filter(Boolean)
    .join("\n")
}

// =====================================================
// Events
// =====================================================

function loadEvents() {
  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          eventsPath,
          "utf-8"
        )
      )

    return Array.isArray(
      data.events
    )
      ? data.events
      : []
  } catch {
    return []
  }
}

function buildEventsText() {
  const events =
    loadEvents()

  if (!events.length) {
    return "暂无历史事件"
  }

  return events
    .slice(-10)
    .map(
      (item) =>
        `- ${item.text || ""}`
    )
    .filter(
      (item) => item !== "- "
    )
    .join("\n")
}

// =====================================================
// Chat Archive
// =====================================================

function saveChat(
  role,
  content
) {
  try {
    let data = {
      messages: [],
    }

    try {
      data =
        JSON.parse(
          fs.readFileSync(
            chatPath,
            "utf-8"
          )
        )
    } catch {}

    if (
      !Array.isArray(
        data.messages
      )
    ) {
      data.messages = []
    }

    data.messages.push({
      role,
      content,
      time:
        new Date().toISOString(),
    })

    // 防止文件无限膨胀
    data.messages =
      data.messages.slice(-500)

    fs.writeFileSync(
      chatPath,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf-8"
    )
  } catch (error) {
    console.error(
      "保存 chat archive 失败:",
      error.message
    )
  }
}

// =====================================================
// Claude 请求
// =====================================================

async function askAI({
  message,
  attachments,
  history,
  settings,
  summary,
  brainContext,
}) {
  const model =
    settings.model ||
    config.CHAT_MODEL

  const baseURL =
    settings.baseURL ||
    config.CHAT_BASE_URL ||
    undefined

  const apiKey =
    settings.apiKey ||
    config.CHAT_API_KEY

  if (!apiKey) {
    throw new Error(
      "未配置 API Key"
    )
  }

  let requestClient = client

  if (
    apiKey !==
      config.CHAT_API_KEY ||
    baseURL !==
      config.CHAT_BASE_URL
  ) {
    requestClient =
      new Anthropic({
        apiKey,
        baseURL,
      })
  }

  const localMemoryText =
    buildLocalMemoryText()

  const brainText =
    brainContext &&
    brainContext.contextText
      ? brainContext.contextText
      : ""

  const brainMemories =
    brainContext &&
    Array.isArray(
      brainContext.memories
    )
      ? brainContext.memories
      : []

  const identity =
    brainContext &&
    brainContext.identity
      ? brainContext.identity
      : {}

  const systemPrompt =
    settings.systemPrompt ||
    "你是一个温柔、自然、可靠的 AI 助手。"

  const memoryText = `
聊天摘要：
${summary || "暂无摘要"}

用户身份：
${
  Object.keys(identity).length
    ? JSON.stringify(
        identity,
        null,
        2
      )
    : "未设置"
}

本地长期记忆：
${localMemoryText}

AI Memory：
${brainText || "暂无"}

Memory 条目：
${
  brainMemories.length
    ? brainMemories
        .map(
          (item) =>
            `- ${
              item.content ||
              ""
            }`
        )
        .join("\n")
    : "暂无"
}

历史事件：
${buildEventsText()}
`

  const messages =
    normalizeHistory(
      history
    )

  const userContent = [
    {
      type: "text",
      text: message,
    },
  ]

  for (
    const file of attachments || []
  ) {
    if (
      !file ||
      !file.type
    ) {
      continue
    }

    if (
      file.type.startsWith(
        "image/"
      )
    ) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type:
            file.type,
          data: file.data,
        },
      })

      continue
    }

    if (
      file.type ===
      "application/pdf"
    ) {
      userContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type:
            "application/pdf",
          data: file.data,
        },
      })

      continue
    }

    userContent.push({
      type: "text",
      text:
        `用户上传了文件：${file.name || "未命名文件"}`,
    })
  }

  messages.push({
    role: "user",
    content: userContent,
  })

  return requestClient.messages.create(
    {
      model,
      max_tokens: 1024,
      stream: true,

      system: `
${systemPrompt}

${memoryText}

回复要求：

- 简短自然
- 不要长篇解释
- 像日常聊天
- 如果用户问到以前聊过的事情，可以结合长期记忆
- 不要假装记得不存在的信息
`,
      messages,
    }
  )
}

// =====================================================
// API：健康检查
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "MyAIHome",
      mode: "single-user",
    })
  }
)

// =====================================================
// API：测试 Claude
// =====================================================

app.post(
  "/api/test-connection",
  async (req, res) => {
    const settings =
      req.body.settings ||
      req.body ||
      {}

    const model =
      settings.model ||
      config.CHAT_MODEL

    const baseURL =
      settings.baseURL ||
      config.CHAT_BASE_URL ||
      undefined

    const apiKey =
      settings.apiKey ||
      config.CHAT_API_KEY

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        type: "missing_key",
        message:
          "没有配置 API Key。",
      })
    }

    try {
      const testClient =
        new Anthropic({
          apiKey,
          baseURL,
        })

      await testClient.messages.create(
        {
          model,
          max_tokens: 1,
          messages: [
            {
              role: "user",
              content: "ping",
            },
          ],
        }
      )

      return res.json({
        ok: true,
        message:
          "Claude 连接成功。",
      })
    } catch (error) {
      const info =
        buildAiErrorResponse(
          error,
          settings
        )

      console.error(
        "Claude 测试失败:",
        error.message
      )

      return res.status(400).json({
        ok: false,
        ...info,
      })
    }
  }
)

// =====================================================
// API：聊天
// =====================================================

app.post(
  "/api/chat",
  async (req, res) => {
    const message =
      String(
        req.body.message || ""
      ).trim()

    const attachments =
      Array.isArray(
        req.body.attachments
      )
        ? req.body.attachments
        : []

    const settings =
      req.body.settings || {}

    if (!message) {
      return res.status(400).json({
        error:
          "消息不能为空",
      })
    }

    // 永远只有 main
    const roomId =
      ROOM_ID

    const storedSession =
      loadSession(roomId)

    const incomingHistory =
      Array.isArray(
        req.body.history
      )
        ? req.body.history
        : []

    const history =
      incomingHistory.length
        ? incomingHistory
        : storedSession

    // 清理旧 Memory
    try {
      memoryCleaner.cleanMemory(
        memoryPath
      )
    } catch (error) {
      console.error(
        "Memory 清理失败:",
        error.message
      )
    }

    const summary =
      summaryManager.loadSummary(
        roomId
      )

    // SSE
    res.setHeader(
      "Content-Type",
      "text/event-stream"
    )

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    )

    res.setHeader(
      "Connection",
      "keep-alive"
    )

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    )

    if (
      typeof res.flushHeaders ===
      "function"
    ) {
      res.flushHeaders()
    }

    let fullReply = ""

    let aiSucceeded = false

    try {
      // =============================================
      // Memory：聊天前
      // =============================================

      const brainContext =
        await memoryBrain.beforeChat(
          message,
          {
            roomId,
            memoryPath,
            history,
            settings,
          }
        )

      // =============================================
      // Claude
      // =============================================

      const stream =
        await askAI({
          message,
          attachments,
          history,
          settings,
          summary,
          brainContext,
        })

      for await (
        const event of stream
      ) {
        if (
          event.type !==
          "content_block_delta"
        ) {
          continue
        }

        const rawText =
          event.delta &&
          event.delta.text
            ? event.delta.text
            : ""

        if (!rawText) {
          continue
        }

        const text =
          cleanText(rawText)

        if (!text) {
          continue
        }

        fullReply += text

        res.write(
          `data: ${JSON.stringify({
            text,
          })}\n\n`
        )
      }

      aiSucceeded = true

      res.write(
        `data: ${JSON.stringify({
          done: true,
        })}\n\n`
      )
    } catch (error) {
      const aiError =
        buildAiErrorResponse(
          error,
          settings
        )

      console.error(
        "聊天失败:",
        error.message
      )

      fullReply =
        aiError.message

      res.write(
        `data: ${JSON.stringify({
          text:
            aiError.message,
          done: true,
          error: true,
          type:
            aiError.type,
        })}\n\n`
      )
    }

    // =============================================
    // 只有真正成功的 AI 回复才进入 Memory
    // =============================================

    if (aiSucceeded) {
      saveChat(
        "user",
        message
      )

      saveChat(
        "assistant",
        fullReply
      )

      setImmediate(
        async () => {
          try {
            await memoryBrain.afterChat(
              message,
              fullReply,
              {
                roomId,
                memoryPath,
                history,
                settings,
              }
            )
          } catch (error) {
            console.error(
              "Memory 写入失败:",
              error.message
            )
          }
        }
      )
    }

    // =============================================
    // 保存 Session
    // =============================================

    if (aiSucceeded) {
      const session =
        loadSession(roomId)

      session.push(
        {
          role: "user",
          text: message,
          attachments,
        },
        {
          role: "ai",
          text: fullReply,
        }
      )

      // 只保留最近 100 条
      const trimmedSession =
        session.slice(-100)

      saveSession(
        roomId,
        trimmedSession
      )

      // 每超过 20 条尝试生成摘要
      if (
        trimmedSession.length >=
          20 &&
        trimmedSession.length %
          10 ===
          0
      ) {
        setImmediate(
          async () => {
            try {
              await summaryManager.createSummary(
                roomId,
                trimmedSession
              )
            } catch (error) {
              console.error(
                "生成摘要失败:",
                error.message
              )
            }
          }
        )
      }
    }

    res.end()
  }
)

// =====================================================
// API：读取 Session
// =====================================================

app.get(
  "/api/session",
  (req, res) => {
    try {
      return res.json(
        loadSession(
          ROOM_ID
        )
      )
    } catch (error) {
      console.error(
        "读取 Session 失败:",
        error.message
      )

      return res.status(500).json({
        error:
          "读取 Session 失败",
      })
    }
  }
)

// =====================================================
// API：清空 Session
// =====================================================

app.delete(
  "/api/session",
  (req, res) => {
    try {
      deleteSession(
        ROOM_ID
      )

      return res.json({
        success: true,
      })
    } catch (error) {
      console.error(
        "删除 Session 失败:",
        error.message
      )

      return res.status(500).json({
        error:
          "删除 Session 失败",
      })
    }
  }
)

// =====================================================
// API：保存 Session
// =====================================================

app.post(
  "/api/session",
  (req, res) => {
    try {
      const messages =
        Array.isArray(
          req.body.messages
        )
          ? req.body.messages
          : []

      saveSession(
        ROOM_ID,
        messages.slice(-100)
      )

      return res.json({
        success: true,
      })
    } catch (error) {
      console.error(
        "保存 Session 失败:",
        error.message
      )

      return res.status(500).json({
        error:
          "保存 Session 失败",
      })
    }
  }
)

// =====================================================
// API：读取 Memory
// =====================================================

app.get(
  "/api/memory",
  (req, res) => {
    try {
      const memories =
        loadLocalMemories()

      return res.json(
        memories
      )
    } catch (error) {
      console.error(
        "读取 Memory 失败:",
        error.message
      )

      return res.status(500).json({
        error:
          "读取 Memory 失败",
      })
    }
  }
)

// =====================================================
// API：删除某一条 Memory
// =====================================================

app.delete(
  "/api/memory/:index",
  (req, res) => {
    const index =
      Number(
        req.params.index
      )

    try {
      const memories =
        loadLocalMemories()

      if (
        !Number.isInteger(
          index
        ) ||
        index < 0 ||
        index >=
          memories.length
      ) {
        return res.status(400).json({
          error:
            "Memory index 无效",
        })
      }

      memories.splice(
        index,
        1
      )

      fs.writeFileSync(
        memoryPath,
        JSON.stringify(
          {
            memories,
          },
          null,
          2
        ),
        "utf-8"
      )

      return res.json({
        success: true,
      })
    } catch (error) {
      console.error(
        "删除 Memory 失败:",
        error.message
      )

      return res.status(500).json({
        error:
          "删除 Memory 失败",
      })
    }
  }
)

// =====================================================
// 静态前端
// =====================================================

if (
  fs.existsSync(
    frontendDist
  )
) {
  app.use(
    express.static(
      frontendDist
    )
  )

  // React SPA fallback
  app.get(
    /^(?!\/api).*/,
    (req, res) => {
      res.sendFile(
        path.join(
          frontendDist,
          "index.html"
        )
      )
    }
  )
} else {
  app.get(
    "/",
    (req, res) => {
      res.send(
        "MyAIHome 后端运行正常，但 frontend/dist 不存在。"
      )
    }
  )
}

// =====================================================
// 启动
// =====================================================

app.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log("")
    console.log(
      "================================="
    )
    console.log(
      " MyAIHome 已启动"
    )
    console.log(
      " 模式：单用户"
    )
    console.log(
      " Room：main"
    )
    console.log(
      ` Port：${PORT}`
    )
    console.log(
      "================================="
    )
    console.log("")
  }
)
