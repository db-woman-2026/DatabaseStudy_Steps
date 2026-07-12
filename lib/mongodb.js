const fs = require("fs")
const path = require("path")
const { MongoClient } = require("mongodb")

const envPath = path.join(__dirname, "..", ".env")

if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017"
const databaseName = process.env.MONGODB_DB || "database_study_course"

if (!databaseName.startsWith("database_study_")) {
  throw new Error(
    "안전을 위해 MONGODB_DB는 database_study_로 시작해야 합니다.",
  )
}

async function withDatabase(work) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
  })

  try {
    await client.connect()
    return await work(client.db(databaseName), databaseName)
  } finally {
    await client.close()
  }
}

module.exports = {
  withDatabase,
}
