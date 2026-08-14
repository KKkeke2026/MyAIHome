const fs = require("fs")
const path = require("path")


const sessionsPath =
path.join(__dirname,"sessions")



if(!fs.existsSync(sessionsPath)){

fs.mkdirSync(
sessionsPath,
{
recursive:true
}
)

}





function getSessionFile(id){

return path.join(
sessionsPath,
`${id}.json`
)

}





// 读取聊天记录

function loadSession(id){

const file =
getSessionFile(id)



if(!fs.existsSync(file)){

return []

}



try{


const data =
JSON.parse(
fs.readFileSync(
file,
"utf-8"
)
)



return data.messages || []



}catch(e){


console.log(
"读取session失败:",
e.message
)


return []


}


}






// 保存聊天记录

function saveSession(id,messages){


if(
!messages ||
!Array.isArray(messages)
){

return false

}



const file =
getSessionFile(id)



fs.writeFileSync(

file,

JSON.stringify(
{
messages
},
null,
2
),

"utf-8"

)



console.log(
"保存session:",
id,
"数量:",
messages.length
)



return true


}






// 删除session

function deleteSession(id){


const file =
getSessionFile(id)



if(fs.existsSync(file)){

fs.unlinkSync(file)

}


}






module.exports={

saveSession,

loadSession,

deleteSession

}