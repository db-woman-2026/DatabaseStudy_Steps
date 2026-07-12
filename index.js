const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-1.sqlite")

fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(databasePath)) {
  fs.rmSync(databasePath)
}

const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")

database.exec(`
  CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const insertMember = database.prepare(`
  INSERT INTO members (name, email)
  VALUES (?, ?)
`)

const members = [
  ["김민지", "minji@example.com"],
  ["이준호", "junho@example.com"],
  ["박서연", "seoyeon@example.com"],
]

for (const member of members) {
  const result = insertMember.run(...member)
  console.log(`member id=${result.lastInsertRowid} 생성`)
}

console.log("\nmembers 테이블 구조")
console.table(database.prepare("PRAGMA table_info(members)").all())

console.log("members 전체 행")
console.table(
  database
    .prepare("SELECT id, name, email, joined_at FROM members ORDER BY id")
    .all(),
)

database.close()
console.log(`SQLite 파일: ${databasePath}`)
