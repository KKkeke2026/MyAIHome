import {
  Sparkles,
  Home,
  Heart,
  Brain,
  CalendarDays,
  CloudRain
} from "lucide-react"

import Card from "../components/ui/Card"
import { userConfig } from "../config/userConfig"


function getDays(){

  const start = new Date(
    userConfig.relationshipStartDate
  )

  const now = new Date()

  const diff =
    now - start

  return Math.floor(
    diff / (1000 * 60 * 60 * 24)
  )

}


export default function Room(){

  return (

    <section className="screen room-screen">


      {/* AI和用户 */}

      <Card className="identity-card">

        <div className="avatar-pair">

  <div className="avatar-circle ai-avatar">

    {
      userConfig.aiAvatar
      ?
      <img src={userConfig.aiAvatar}/>
      :
      "AI"
    }

  </div>

<div className="heart-between">
♡
</div>

  <div className="avatar-circle user-avatar">

    {
      userConfig.userAvatar
      ?
      <img src={userConfig.userAvatar}/>
      :
      "你"
    }

  </div>


</div>

<div className="relationship-start">

始于 {userConfig.relationshipStartDate}

</div>



        <h2>

          {userConfig.userName}

          {" & "}

          {userConfig.aiName}

        </h2>



        <div className="days">

          {getDays()}

          <span>
            天
          </span>

        </div>


      </Card>





      {/* 天气 */}

<Card className="weather-card">

  <div className="weather-card-top">
    <div className="weather-icon-wrap">
      <CloudRain size={26} strokeWidth={1.8} />
    </div>

    <div className="weather-info">
      <div className="weather-location">
        广州 · 中国
      </div>

      <div className="weather-row">
        <span className="weather-text">
          小雨
        </span>

        <span className="weather-temp">
          26°C
        </span>
      </div>
    </div>
  </div>

  <div className="weather-date">
    7月15日 星期三
  </div>

</Card>






      {/* AI醒来 */}

      <Card>

        <div className="card-title">

          <Sparkles size={18}/>

          AI今天醒来的一句话

        </div>


        <p>

        “早安，今天也想陪你慢慢开始。”

        </p>


      </Card>






      {/* 状态 */}

      <div className="status-grid">


        <Card>

          <Home size={18}/>


          <p>
          房间状态
          </p>


          <strong>
          陪伴中
          </strong>


        </Card>




        <Card>

          <Heart size={18}/>


          <p>
          今日心情
          </p>


          <strong>
          平静
          </strong>


        </Card>


      </div>







      {/* OB记忆入口 */}

      <Card>


        <div className="card-title">

          <Brain size={18}/>

          AI记忆


        </div>


        <p>
          喜欢小猫
        </p>


        <p>
          喜欢雨天
        </p>


        <p>
          正在制作AI小屋
        </p>



      </Card>








      {/* 日期 */}

      <Card>


        <div className="card-title">


          <CalendarDays size={18}/>

          重要日期


        </div>


        <p>
          纪念日
        </p>


        <p>
          生日
        </p>


      </Card>



    </section>

  )

}