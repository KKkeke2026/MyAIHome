import { useState } from "react";
import { sendMessage } from "../api/client";


function ChatWindow() {

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);


  async function handleSend(){

    if(!input.trim()) return;


    const userMessage = {
      role:"user",
      content:input
    };


    setMessages(prev=>[
      ...prev,
      userMessage
    ]);


    setInput("");
    setLoading(true);


    try{

      const result = await sendMessage({
        message:input
      });


      setMessages(prev=>[
        ...prev,
        {
          role:"assistant",
          content:
          result.message ||
          result.content ||
          "没有返回内容"
        }
      ]);


    }catch(error){

      setMessages(prev=>[
        ...prev,
        {
          role:"assistant",
          content:"连接失败"
        }
      ]);

    }


    setLoading(false);

  }



  return (

    <div className="chat-window">


      <div className="messages">

        {
          messages.map((msg,index)=>(

            <div
              key={index}
              className={msg.role}
            >

              {msg.content}

            </div>

          ))
        }

        {
          loading &&
          <div>
            AI正在思考...
          </div>
        }

      </div>



      <div className="chat-input">

        <input

          value={input}

          onChange={
            e=>setInput(e.target.value)
          }

          onKeyDown={
            e=>{
              if(e.key==="Enter"){
                handleSend();
              }
            }
          }

          placeholder="输入消息..."

        />


        <button onClick={handleSend}>
          发送
        </button>


      </div>


    </div>

  );

}


export default ChatWindow;
