import { useEffect, useRef, useState } from "react";

function ChatWindow() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch("/api/session");

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setMessages(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {
      console.error("加载聊天记录失败", error);
    }
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || loading) {
      return;
    }

    setInput("");

    const userMessage = {
      role: "user",
      text,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("聊天请求失败");
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let assistantText = "";

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "",
        },
      ]);

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        const chunk =
          decoder.decode(value);

        const lines =
          chunk.split("\n");

        for (const line of lines) {

          if (!line.startsWith("data:")) {
            continue;
          }

          const raw =
            line.replace("data:", "").trim();

          if (!raw) {
            continue;
          }

          try {
            const data =
              JSON.parse(raw);

            if (data.text) {
              assistantText += data.text;

              setMessages((prev) => {
                const next = [...prev];

                const last =
                  next[next.length - 1];

                if (
                  last &&
                  last.role === "ai"
                ) {
                  next[next.length - 1] = {
                    ...last,
                    text: assistantText,
                  };
                }

                return next;
              });
            }

          } catch {
            // 忽略无法解析的 SSE 数据
          }
        }
      }

    } catch (error) {

      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "连接失败，请检查后端。",
        },
      ]);

    }

    setLoading(false);
  }

  return (
    <section className="screen chat-screen">

      <div className="bubble-stack">

        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user"
                ? "bubble user"
                : "bubble ai"
            }
          >
            {msg.text || msg.content}
          </div>
        ))}

        {loading && (
          <div className="bubble ai">
            AI 正在思考...
          </div>
        )}

        <div ref={messagesEndRef} />

      </div>

      <div className="composer">

        <input
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入消息..."
        />

        <button
          type="button"
          className="send-button"
          onClick={handleSend}
          disabled={loading}
        >
          ➤
        </button>

      </div>

    </section>
  );
}

export default ChatWindow;
