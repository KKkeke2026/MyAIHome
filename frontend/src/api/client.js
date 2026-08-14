const API_BASE = "http://localhost:3000";

export async function sendMessage(data) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("请求失败");
  }

  return await response.json();
}


export async function getRooms() {
  const response = await fetch(`${API_BASE}/api/rooms`);

  if (!response.ok) {
    throw new Error("获取房间失败");
  }

  return await response.json();
}


export async function getMemory() {
  const response = await fetch(`${API_BASE}/api/memory`);

  if (!response.ok) {
    throw new Error("获取记忆失败");
  }

  return await response.json();
}