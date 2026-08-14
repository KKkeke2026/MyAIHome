const fs = require("fs")


// 标准化文字

function normalize(text){

return String(text || "")
.replace(/用户|现在|我|很|特别|比较|的/g,"")
.replace(/[，。！？,.!?]/g,"")
.trim()

}



// 判断是否否定旧记忆

function isNegative(text){

return (
text.includes("不喜欢") ||
text.includes("不再喜欢") ||
text.includes("讨厌") ||
text.includes("不要") ||
text.includes("不想")
)

}



// 获取否定目标

function getNegativeTarget(text){

const words=[
"不再喜欢",
"不喜欢",
"讨厌",
"不要",
"不想"
]


for(const word of words){

if(text.includes(word)){

return text
.split(word)[1]
.replace(/[了啦呀]/g,"")
.trim()

}

}


return ""

}




// 读取记忆

function loadMemory(memoryPath){

try{

const data =
JSON.parse(
fs.readFileSync(
memoryPath,
"utf-8"
)
)


return data.memories || []


}catch(e){

return []

}

}





// 保存记忆

function saveMemory(memoryPath,memoryObject){


let data={
memories:[]
}



try{

data =
JSON.parse(
fs.readFileSync(
memoryPath,
"utf-8"
)
)


}catch(e){}





const newText =
memoryObject.text || ""




// 提取偏好

function extractPreference(text){

const patterns=[

"喜欢",
"不喜欢",
"讨厌",
"改成",
"换成",
"现在喜欢"

]


for(const p of patterns){

if(text.includes(p)){

return text
.split(p)
.pop()
.trim()

}

}


return ""

}





// 删除否定记忆

if(isNegative(newText)){


const target =
normalize(
getNegativeTarget(newText)
)



data.memories =
data.memories.filter(item=>{


if(
typeof item !== "object"
){

return true

}


return !normalize(item.text)
.includes(target)


})


}





// 查找同类记忆

const index =
data.memories.findIndex(item=>{


return (

item.type === memoryObject.type

&&

normalize(item.text)
.includes(
normalize(memoryObject.text)
)

)


})





// preference覆盖

if(
memoryObject.type==="preference"
){


const newPreference =
normalize(
extractPreference(newText)
)



if(newPreference){


data.memories =
data.memories.filter(item=>{


if(
item.type!=="preference"
){

return true

}



const oldPreference =
normalize(item.text)



if(
newText.includes("喜欢")
&&
oldPreference.includes("喜欢")
){


console.log(
"🗑️ 删除旧偏好:",
item.text
)


return false


}


return true


})


}

}




const now =
new Date().toISOString()





const newMemory={

id:
Date.now().toString(),


text:
memoryObject.text,


type:
memoryObject.type || "general",


level:
memoryObject.level || "normal",


tags:
Array.isArray(memoryObject.tags)
?
memoryObject.tags
:
[],


importance:
memoryObject.importance || 3,


createdAt:
now,


updatedAt:
now

}







if(index !== -1){


data.memories[index]={

...data.memories[index],

...newMemory,

id:
data.memories[index].id,

createdAt:
data.memories[index].createdAt,

updatedAt:
now

}


console.log(
"♻️ 更新记忆:",
data.memories[index]
)



}else{


data.memories.push(
newMemory
)


console.log(
"✅ 新增记忆:",
newMemory
)


}






fs.writeFileSync(

memoryPath,

JSON.stringify(
data,
null,
2
),

"utf-8"

)



return true

}





module.exports={

loadMemory,

saveMemory

}