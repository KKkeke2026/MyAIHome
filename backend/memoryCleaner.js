const fs = require("fs")


// 临时记忆保存时间
const TEMP_EXPIRE_DAYS = 30


function cleanMemory(memoryPath){


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


}catch(e){

return

}



const now =
Date.now()



const before =
data.memories.length



data.memories =
data.memories.filter(item=>{


// 没有时间的不删除

if(!item.createdAt){

return true

}


// 只清理 temporary

if(
item.level !== "temporary"
){

return true

}



const created =
new Date(
item.createdAt
)
.getTime()



const days =

(
now - created
)
/
(
1000 *
60 *
60 *
24
)



if(days > TEMP_EXPIRE_DAYS){


console.log(
"🧹 删除过期临时记忆:",
item.text
)


return false

}



return true


})



const after =
data.memories.length



if(before !== after){


fs.writeFileSync(

memoryPath,

JSON.stringify(
data,
null,
2
),

"utf-8"

)


console.log(
`🧹 清理完成 ${before} -> ${after}`
)


}


}



module.exports={

cleanMemory

}