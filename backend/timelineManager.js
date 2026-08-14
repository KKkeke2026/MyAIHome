const fs = require("fs")
const path = require("path")


const timelinePath =
path.join(__dirname,"timeline")


const memoriesPath =
path.join(
timelinePath,
"memories.json"
)


const eventsPath =
path.join(
timelinePath,
"events.json"
)


if(!fs.existsSync(timelinePath)){
fs.mkdirSync(timelinePath)
}


function readJSON(file,defaultData){

if(!fs.existsSync(file)){
return defaultData
}


try{

return JSON.parse(
fs.readFileSync(
file,
"utf-8"
)
)

}catch(e){

return defaultData

}

}



function writeJSON(file,data){

fs.writeFileSync(
file,
JSON.stringify(
data,
null,
2
),
"utf-8"
)

}



//读取长期记忆

function loadMemories(){

return readJSON(
memoriesPath,
{
memories:[]
}
)

}


//保存长期记忆

function saveMemory(memory){

const data =
loadMemories()


data.memories.push(memory)


writeJSON(
memoriesPath,
data
)

}



//读取事件

function loadEvents(){

return readJSON(
eventsPath,
{
events:[]
}
)

}


//保存事件

function saveEvent(event){

const data =
loadEvents()


data.events.push(event)


writeJSON(
eventsPath,
data
)

}



module.exports={

loadMemories,

saveMemory,

loadEvents,

saveEvent

}