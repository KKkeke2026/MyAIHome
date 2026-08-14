const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.resolve(__dirname, "..", ".env") })
dotenv.config({ path: path.resolve(__dirname, ".env") })

module.exports = {
  CHAT_API_KEY: process.env.CHAT_API_KEY,
  CHAT_BASE_URL: process.env.CHAT_BASE_URL,
  CHAT_MODEL: process.env.CHAT_MODEL,
  MEMORY_API_KEY: process.env.MEMORY_API_KEY,
  MEMORY_BASE_URL: process.env.MEMORY_BASE_URL,
  MEMORY_MODEL: process.env.MEMORY_MODEL,
  MEMORY_BACKUP_API_KEY: process.env.MEMORY_BACKUP_API_KEY,
  MEMORY_BACKUP_BASE_URL: process.env.MEMORY_BACKUP_BASE_URL,
  MEMORY_BACKUP_MODEL: process.env.MEMORY_BACKUP_MODEL,
  OMBRE_MCP_URL: process.env.OMBRE_MCP_URL,
  OMBRE_MCP_TOKEN: process.env.OMBRE_MCP_TOKEN,
  OMBRE_ENABLED: process.env.OMBRE_ENABLED,
}
