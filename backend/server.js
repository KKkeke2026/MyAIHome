const fs = require("fs")
const path = require("path")

const express = require("express")
const cors = require("cors")

const Anthropic = require("@anthropic-ai/sdk")

const config = require("./config")
const memoryManager = require("./memoryManager")
const summaryManager = require("./summaryManager")
const recallManager = require("./recallManager")
const memoryCleaner = require("./memoryCleaner")
const memoryAdapter = require("./memory/memoryAdapter")
const memoryBrain = require("./memory/memoryBrain")
const {
saveSession,
loadSession
}=require("./sessionManager")

const app = express()

const PORT = 3000


function getTimelinePath(roomId){

return path.join(
__dirname,
"timeline",
`room_${roomId}`
)

}


function getMemoryPath(roomId){

return path.join(
getTimelinePath(roomId),
"memories.json"
)

}


function getEventsPath(roomId){

return path.join(
getTimelinePath(roomId),
"events.json"
)

}
const timelinePath =
path.join(
__dirname,
"timeline"
)
const chatPath =
path.join(__dirname,"chat_archive.json")


const roomsPath =
path.join(__dirname,"rooms.json")

const sessionsPath =
path.join(__dirname,"sessions")

const client = new Anthropic({

  apiKey: config.CHAT_API_KEY,

  baseURL: config.CHAT_BASE_URL

})

function classifyAiError(error, settings = {}) {
  const message = error && error.message ? error.message : ""
  const effectiveApiKey = (settings.apiKey && String(settings.apiKey).trim()) || config.CHAT_API_KEY || ""

  if (!effectiveApiKey) {
    return {
      type: "missing_key",
      label: "未配置 API Key"
    }
  }

  if (
    error && (
      error.status === 401 ||
      error.statusCode === 401 ||
      /invalid|unauthorized|authentication|api key/i.test(message)
    )
  ) {
    return {
      type: "invalid_key",
      label: "Key 无效"
    }
  }

  return {
    type: "request_failed",
    label: "API 请求失败"
  }
}

function buildAiErrorResponse(error, settings = {}) {
  const reason = classifyAiError(error, settings)

  const messageMap = {
    missing_key: "未配置 API Key，请在设置中填写 API Key，或使用后端默认配置。",
    invalid_key: "Key 无效，请检查 API Key 是否正确、未过期，并确认权限足够。",
    request_failed: "API 请求失败，请检查 Base URL、Model 和网络连接。"
  }

  return {
    ...reason,
    message: messageMap[reason.type] || "API 请求失败。"
  }
}

async function testConnectionWithSettings(settings = {}) {
  const provider = settings.provider || "claude"
  const model = settings.model || config.CHAT_MODEL || "claude-sonnet-4-6"
  const baseURL = settings.baseURL || config.CHAT_BASE_URL || undefined
  const apiKey = (settings.apiKey && String(settings.apiKey).trim()) || config.CHAT_API_KEY

  if (!apiKey) {
    throw new Error("未配置 API Key")
  }

  if (provider === "openai-compatible") {
    const OpenAI = require("openai")
    const client = new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true
    })

    await client.models.list()
    return true
  }

  const requestClient = new Anthropic({
    apiKey,
    baseURL: baseURL || undefined
  })

  await requestClient.messages.create({
    model,
    max_tokens: 1,
    messages: [{ role: "user", content: "ping" }]
  })

  return true
}

app.use(cors())


app.use(express.json({

limit:"50mb"

}))

if(!fs.existsSync(sessionsPath)){
  fs.mkdirSync(sessionsPath)
}

if(!fs.existsSync(timelinePath)){
  fs.mkdirSync(timelinePath)
}


function saveChat(role,content){


let data={

messages:[]

}


try{

data=
JSON.parse(
fs.readFileSync(
chatPath,
"utf-8"
)
)

}catch(e){}



data.messages.push({

role,

content,

time:new Date().toLocaleString()

})


fs.writeFileSync(

chatPath,

JSON.stringify(
data,
null,
2
)

)


}

function loadMemoryText(){


const memories =
memoryManager.loadMemory(
memoryPath
)


return memories

.map(item=>{


if(
typeof item!=="object"
){

return ""

}



const text=item.text || ""



return `当前有效记忆：${text}`



})

.filter(Boolean)

.join("\n")


}

function loadEvents(){

try{

const data =
JSON.parse(
fs.readFileSync(
eventsPath,
"utf-8"
)
)

return data.events || []

}catch(e){

return []

}

}





app.get("/",(req,res)=>{

res.send(

"AI Home 后端运行正常 🚀"

)

})
async function askAI({

message,

attachments,

history,

settings,

summary,

memoryPath,

roomId,

brainContext = {}

}){


const recall =
recallManager.getRecall(
roomId,
memoryPath,
message
)

const longTermRecall = await memoryAdapter.recall(message, { memoryPath })
const brainText = brainContext && brainContext.contextText ? brainContext.contextText : ""
const brainMemories = Array.isArray(brainContext && brainContext.memories) ? brainContext.memories : []
const brainIdentity = brainContext && brainContext.identity ? brainContext.identity : {}

const memoryText =

`
聊天摘要：

${recall.summary}


用户身份：

${brainIdentity && Object.keys(brainIdentity).length ? JSON.stringify(brainIdentity, null, 2) : "未设置"}


长期记忆：

${brainText || (longTermRecall && longTermRecall.ok && longTermRecall.text ? longTermRecall.text : recall.memories)}


记忆条目：

${brainMemories.length ? brainMemories.map((item) => `${item && item.category ? `[${item.category}]` : ""} ${item && item.content ? item.content : String(item)}`).join("\n---\n") : "暂无"}


历史事件：

${recall.events}

`

const model =
  settings.model ||
  config.CHAT_MODEL

const baseURL =
  settings.baseURL ||
  config.CHAT_BASE_URL

const apiKey =
  settings.apiKey ||
  config.CHAT_API_KEY

let requestClient = client

if(
  baseURL !== config.CHAT_BASE_URL ||
  apiKey !== config.CHAT_API_KEY
){
  requestClient = new Anthropic({
    apiKey,
    baseURL
  })
}

const result =
await requestClient.messages.create({


model,


max_tokens:1024,


stream:true,


system:
`

${settings.systemPrompt ||
"你是一个AI助手。"}


用户长期记忆：

${memoryText || "暂无"}


回复要求：

- 简短自然
- 不要长篇解释
- 像日常聊天
- 优先结合用户记忆


`,


messages:[


...(history || [])
.slice(-20)
.map(item=>({

role:item.role==="ai" ? "assistant" : item.role,

content:item.attachments?.length
?
[
{
type:"text",
text:item.text
},

...item.attachments.map(file=>{

if(file.type.startsWith("image")){

return {
type:"image",
source:{
type:"base64",
media_type:file.type,
data:file.data
}
}

}


if(file.type==="application/pdf"){

return {
type:"document",
source:{
type:"base64",
media_type:"application/pdf",
data:file.data
}
}

}

return {
type:"text",
text:`文件：${file.name}`
}

})

]
:
item.text || item.content

})),


{
role:"user",

content:[

{
type:"text",
text:message
},

...(attachments || []).map(file=>{

if(file.type.startsWith("image")){

return {
type:"image",
source:{
type:"base64",
media_type:file.type,
data:file.data
}
}

}


if(file.type==="application/pdf"){

return {
type:"document",
source:{
type:"base64",
media_type:"application/pdf",
data:file.data
}
}

}


return {
type:"text",
text:
`用户上传了文件：
文件名：${file.name}
类型：${file.type}`
}

})

]

}


]

})


return result

}

app.post("/api/test-connection", async (req, res) => {
  const settings = req.body.settings || req.body || {}

  try {
    await testConnectionWithSettings(settings)
    return res.json({
      ok: true,
      message: "连接成功：当前 AI 配置可用。"
    })
  } catch (error) {
    const errorInfo = buildAiErrorResponse(error, settings)
    console.log("连接测试失败:", errorInfo.label, error && error.message)

    return res.status(400).json({
      ok: false,
      type: errorInfo.type,
      label: errorInfo.label,
      message: errorInfo.message
    })
  }
})

app.post("/chat",async(req,res)=>{

const message=req.body.message

const history=req.body.history || []

const settings=req.body.settings || {}

const attachments=req.body.attachments || []


const roomId =
req.body.roomId ||
req.body.settings?.roomId ||
1

const roomTimelinePath =
getTimelinePath(roomId)


const memoryPath =
getMemoryPath(roomId)


const eventsPath =
getEventsPath(roomId)



if(!fs.existsSync(roomTimelinePath)){

fs.mkdirSync(
roomTimelinePath,
{
recursive:true
}
)

}


if(!fs.existsSync(memoryPath)){

fs.writeFileSync(
memoryPath,
JSON.stringify(
{
memories:[]
},
null,
2
),
"utf-8"
)

}


if(!fs.existsSync(eventsPath)){

fs.writeFileSync(
eventsPath,
JSON.stringify(
{
events:[]
},
null,
2
),
"utf-8"
)

}


// 定期清理记忆

memoryCleaner.cleanMemory(
memoryPath
)

console.log(
"当前附件数量:",
attachments.length
)

console.log(
"当前附件:",
attachments.map(a=>({
name:a.name,
type:a.type
}))
)

const chatSummary =
summaryManager.loadSummary(roomId)
const sessionHistory = loadSession(roomId)

const loggedSettings = {
  ...settings,
  apiKey: settings.apiKey ? "[redacted]" : ""
}

console.log(
  "房间ID:",
  roomId,
  "settings:",
  loggedSettings
)

console.log(
"收到消息:",
message
)



res.setHeader(
"Content-Type",
"text/event-stream"
)

res.setHeader(
"Cache-Control",
"no-cache"
)

res.setHeader(
"Connection",
"keep-alive"
)



let fullReply=""



try{


const brainContext = await memoryBrain.beforeChat(message, {
  roomId,
  memoryPath,
  history,
  settings,
})

const stream = await askAI({
  message,
  attachments,
  history,
  settings,
  summary: chatSummary,
  memoryPath,
  roomId,
  brainContext,
})

for await (const event of stream) {



if(
event.type==="content_block_delta"
){


const text =
event.delta.text || ""


if(text){


fullReply += text.replace(/<thinking>[\s\S]*?<\/thinking>/g,"")



res.write(

`data: ${JSON.stringify({

text

})}\n\n`

)


}


}


}



res.write(

`data: ${JSON.stringify({

done:true

})}\n\n`

)



}catch(error){


const aiError = buildAiErrorResponse(error, settings)

console.log(
"聊天失败:",
aiError.label,
error.message
)

fullReply = aiError.message

res.write(

`data: ${JSON.stringify({

text: aiError.message,

done:true

})}\n\n`

)


}



saveChat(

"user",

message

)



saveChat(

"assistant",

fullReply

)

setImmediate(() => {
  memoryBrain.afterChat(message, fullReply, {
    roomId,
    memoryPath,
    history,
    settings,
  })
})

const session = loadSession(roomId)
console.log(
"保存附件:",
attachments
)

session.push(

{
role:"user",
text:message,
attachments:attachments
},

{
role:"ai",
text:fullReply
}

)


saveSession(
roomId,
session
)
if(session.length > 5){

console.log("开始生成摘要", session.length)

await summaryManager.createSummary(
roomId,
session
)

}
console.log("保存session:", roomId, session)
// TODO: 后续合并到 OB Memory 主流程
// 当前保留，避免影响已有记忆数据
// 记忆提取（异步，不阻塞聊天响应）

res.end()



})

app.get("/session/:id",(req,res)=>{

const messages =
loadSession(req.params.id)


res.json(messages)

})


// 删除房间session
app.delete("/session/:id",(req,res)=>{

console.log(
"删除session:",
req.params.id
)


const id=req.params.id


const sessionFile =
path.join(
sessionsPath,
`${id}.json`
)


if(fs.existsSync(sessionFile)){

fs.unlinkSync(sessionFile)

console.log(
"session已删除"
)

}


res.json({
success:true
})

})



app.post("/session/:id",(req,res)=>{


saveSession(

req.params.id,

req.body.messages || []

)


res.json({

success:true

})


})

app.get("/memory",(req,res)=>{


let data={
memories:[]
}


try{


data=
JSON.parse(
fs.readFileSync(
memoryPath,
"utf-8"
)
)


}catch(e){}



res.json(
data.memories
)


})



app.delete("/session/:id",(req,res)=>{

const id=req.params.id


const sessionFile =
path.join(
sessionsPath,
`${id}.json`
)


if(fs.existsSync(sessionFile)){

fs.unlinkSync(sessionFile)

}

res.json({
success:true
})

})

app.delete(
"/memory/:index",
(req,res)=>{


let data={
memories:[]
}


try{


data=
JSON.parse(
fs.readFileSync(
memoryPath,
"utf-8"
)
)


}catch(e){}



const index =
Number(req.params.index)



data.memories.splice(
index,
1
)



fs.writeFileSync(

memoryPath,

JSON.stringify(
data,
null,
2
)

)



res.json({

success:true

})


})







app.get(
"/chat-history",
(req,res)=>{


let data={
messages:[]
}



try{


data=
JSON.parse(
fs.readFileSync(
chatPath,
"utf-8"
)
)



}catch(e){}



res.json(
data.messages
)



})






app.listen(PORT,()=>{


console.log(

`服务器启动：http://localhost:${PORT}`

)


})