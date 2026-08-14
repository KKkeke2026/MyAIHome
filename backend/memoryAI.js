const config = require("./config")

async function callModel(
  url,
  key,
  model,
  text
){

  console.log(
    "调用记忆模型:",
    model
  )


  const response = await fetch(
    `${url}/v1/chat/completions`,
    {

      method:"POST",

      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${key}`
      },


      body:JSON.stringify({

        model,

        temperature:0,

        max_tokens:200,


        messages:[
          {
            role:"system",
            content:
`
你是AI长期记忆管理器。

你的任务：
判断用户输入是否值得长期保存。

只保存：

1. 核心记忆 core：
- 用户身份信息
- 长期偏好
- 长期项目
- 长期目标
- 用户明确要求记住的事情

2. 普通记忆 normal：
- 使用习惯
- 喜好变化
- 经常性行为

3. 临时记忆 temporary：
- 短期计划
- 最近状态

事件类历史必须归类为 event。


不要保存：

- 普通聊天
- 情绪
- 玩笑
- 角色扮演内容
- 一次性对话


没有长期价值：

只输出：

NONE


有价值：

只输出JSON：

{
"text":"简短记忆",
"type":"preference/goal/habit/general/milestone",
"level":"core/normal/temporary",
"importance":1-10,
"tags":["中文标签"]
}


level规则：

core:
永久长期信息：

- 用户身份
- 长期目标
- 长期项目
- 明确要求记住的事情


normal:
稳定但可能变化：

- 喜好
- 使用习惯
- 兴趣


temporary:
短期：

- 最近事件
- 临时计划
- 一次性安排


判断：

用户说：
"我是程序员"

输出：

{
"level":"core"
}


用户说：
"我喜欢猫咪"

输出：

{
"level":"normal"
}


用户说：
"我今天去买奶茶"

输出：

{
"level":"temporary"
}

tags规则：

根据内容生成1-5个中文标签。

例如：

用户正在开发AI Home项目

{
"text":"用户正在开发AI Home项目",
"type":"goal",
"importance":8,
"tags":["项目","编程","AI"]
}


用户喜欢猫咪

{
"text":"用户喜欢猫咪",
"type":"preference",
"importance":6,
"tags":["宠物","喜好"]
}
用户完成AI Home Timeline架构迁移

{
"text":"用户完成AI Home Timeline架构迁移",
"type":"project",
"importance":8,
"tags":["项目","开发","AI Home"]
}


用户经历Claude账号封禁事件

{
"text":"用户经历Claude账号封禁事件",
"type":"event",
"importance":7,
"tags":["Claude","事件","账号"]
}

禁止：
Markdown
解释
多余文字
`
          },

          {
            role:"user",
            content:text
          }

        ]

      })

    }
  )



  const data =
    await response.json()



  console.log(
    "记忆模型返回:",
    data
  )



  if(data.error){

    throw new Error(
      data.error.message
    )

  }



  let result =
    data.choices?.[0]
    ?.message
    ?.content
    ?.trim()



  if(!result){

    return "NONE"

  }



  return result

}





async function memoryAI(text){


  console.log(
    "🧠 发送给辅助模型:",
    text
  )



  // 主记忆模型

  try{


    console.log(
      "🧠 使用主记忆模型"
    )


    return await callModel(

      config.MEMORY_BASE_URL,

      config.MEMORY_API_KEY,

      config.MEMORY_MODEL,

      text

    )


  }catch(error){


    console.log(
      "主记忆模型失败:",
      error.message
    )

  }




  //备用模型

  if(
    !config.MEMORY_BACKUP_MODEL
  ){

    return "NONE"

  }



  try{


    console.log(
      "🔄 使用备用记忆模型"
    )


    return await callModel(

      config.MEMORY_BACKUP_BASE_URL,

      config.MEMORY_BACKUP_API_KEY,

      config.MEMORY_BACKUP_MODEL,

      text

    )


  }catch(error){


    console.log(
      "备用记忆模型失败:",
      error.message
    )


    return "NONE"

  }


}



module.exports=memoryAI