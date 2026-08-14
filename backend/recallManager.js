const fs = require("fs")
const path = require("path")

const memoryManager = require("./memoryManager")
const summaryManager = require("./summaryManager")

function getEventsPath(roomId){

return path.join(
__dirname,
"timeline",
`room_${roomId}`,
"events.json"
)

}

// 简单关键词匹配

function matchMemory(
message,
text,
tags=[]
){


const target =
message.toLowerCase()


const content =
(
text +
" " +
tags.join(" ")
)
.toLowerCase()


let score = 0



// 原文字匹配

for(const word of target){

if(content.includes(word)){

score += 1

}

}



// 标签额外加权

for(const tag of tags){

if(
target.includes(
tag.toLowerCase()
)
){

score += 3

}

}


// 核心记忆额外提高

return score

}



// 读取事件

function loadEvents(roomId){

const eventsPath =
getEventsPath(roomId)


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





function getRecall(
roomId,
memoryPath,
currentMessage=""
){



const memories =
memoryManager.loadMemory(
memoryPath
)




const ranked =

memories
.map(item=>{


return {

...item,

score:
matchMemory(
currentMessage,
item.text,
item.tags || []
)

}


})

.sort((a,b)=>{


if(
b.score !== a.score
){

return b.score-a.score

}


return (
(b.importance + b.score)
-
(a.importance + a.score)
)


})

.filter(item=>{


return (

item.level==="core"

||

item.score>0

||

item.importance>=8

)


})

.slice(0,10)






const memoryText =

ranked
.map(item=>{

return (
`- ${item.text}`
)

})
.join("\n")






const summary =

summaryManager.loadSummary(
roomId
)

const eventsPath =
path.join(
__dirname,
"timeline",
"events.json"
)


let timelineEvents=[]


try{

const data =
JSON.parse(
fs.readFileSync(
eventsPath,
"utf-8"
)
)

timelineEvents =
data.events || []


}catch(e){

timelineEvents=[]

}




const recentEvents =

timelineEvents
.filter(item=>{

return (
matchMemory(
currentMessage,
item.text,
item.tags || []
)>0
)

})
.slice(-5)



const eventText =

recentEvents
.map(item=>{

return (
`- ${item.text}`
)

})
.join("\n")


return {


summary:
summary || "暂无摘要",


memories:
memoryText || "暂无相关记忆",


events:
eventText || "暂无事件"


}



}





module.exports={

getRecall

}