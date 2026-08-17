export async function getMemory() {
  const response = await fetch("/api/memory");

  if (!response.ok) {
    throw new Error("获取记忆失败");
  }

  return await response.json();
}

export async function getSession() {
  const response = await fetch("/api/session");

  if (!response.ok) {
    throw new Error("获取聊天记录失败");
  }

  return await response.json();
}
