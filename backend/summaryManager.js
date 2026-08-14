const fs = require("fs")
const path = require("path")

const config = require("./config")


const timelinePath =
path.join(
__dirname,
"timeline"
)


function getSummaryPath(roomId){

return path.join(
timelinePath,
`room_${roomId}`,
"summaries"
)

}

function getSummaryFile(roomId){

const dir =
getSummaryPath(roomId)


return path.join(
dir,
"summary.json"
)

}

// 读取摘要

function loadSummary(id){

const file =
getSummaryFile(id)



if(!fs.existsSync(file)){

return ""

}



try{

const data =
JSON.parse(
fs.readFileSync(
file,
"utf-8"
)
)


return data.summary || ""


}catch(e){

return ""

}

}







// 调用AI总结

async function callSummaryAI(text,oldSummary){


const response =
await fetch(

`${config.MEMORY_BASE_URL}/v1/chat/completions`,

{

method:"POST",

headers:{

"Content-Type":"application/json",

"Authorization":
`Bearer ${config.MEMORY_API_KEY}`
},


body:JSON.stringify({

model:
config.MEMORY_MODEL,

temperature:0.2,


max_tokens:500,


messages:[

{

role:"system",

content:
`
你是长期聊天摘要管理器。

你的任务：
把聊天记录整理成未来AI需要知道的信息。

保留：

- 用户长期偏好
- 用户重要背景
- 用户长期目标
- 用户正在进行的项目
- 用户和AI之间的重要约定


删除：

- 普通闲聊
- 一次性事件
- 角色扮演过程
- AI回复原文
- thinking内容


输出规则：

只输出摘要。
100-300字中文。
不要输出用户：
不要输出AI：
不要解释。
`

},


{

role:"user",

content:

`
旧摘要：

${oldSummary || "无"}


新的聊天：

${text}

请合并成新的长期摘要。
`

}

]

})

}

)



const data =
await response.json()



if(data.error){

throw new Error(
data.error.message
)

}



return (

data.choices?.[0]
?.message
?.content
?.trim()

||

""

)


}









// 创建摘要

async function createSummary(id,messages){



// 保留最近20条

const oldMessages =
messages.slice(
0,
-20
)



if(oldMessages.length===0){

return

}





const text =
oldMessages
.map(item=>{


return (

item.role==="user"

?

"用户："+item.text

:

"AI："+item.text

)


})
.join("\n")





const oldSummary =
loadSummary(id)




let summary



try{


summary =
await callSummaryAI(
text,
oldSummary
)


}catch(e){


console.log(
"摘要生成失败:",
e.message
)


return


}






if(!summary){

return

}






const file =
getSummaryFile(id)



fs.writeFileSync(

file,

JSON.stringify(

{
summary,
updatedAt:
new Date().toISOString()

},

null,
2

),

"utf-8"

)

console.log(
"摘要写入文件:",
file
)

console.log(
"✅ AI摘要更新:",
id
)



}





module.exports={

loadSummary,

createSummary

}