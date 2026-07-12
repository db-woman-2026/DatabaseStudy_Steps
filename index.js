const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-2.sqlite")

fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(databasePath)) {
  fs.rmSync(databasePath)
}

const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")

database.exec(`
  CREATE TABLE authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    FOREIGN KEY (author_id) REFERENCES authors(id)
  );

  CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    loaned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    returned_at TEXT,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`)

const insertAuthor = database.prepare("INSERT INTO authors (name) VALUES (?)")
const insertBook = database.prepare(`
  INSERT INTO books (isbn, title, author_id, stock)
  VALUES (?, ?, ?, ?)
`)
const insertMember = database.prepare(`
  INSERT INTO members (name, email)
  VALUES (?, ?)
`)
const insertLoan = database.prepare(`
  INSERT INTO loans (member_id, book_id)
  VALUES (?, ?)
`)

const dataAuthorId = insertAuthor.run("김데이터").lastInsertRowid
const nodeAuthorId = insertAuthor.run("이노드").lastInsertRowid

const databaseBookId = insertBook.run(
  "978-00-0001",
  "데이터를 배우는 시간",
  dataAuthorId,
  3,
).lastInsertRowid
insertBook.run("978-00-0002", "SQL 첫걸음", dataAuthorId, 2)
insertBook.run("978-00-0003", "Node.js 실습 노트", nodeAuthorId, 1)

const memberId = insertMember.run(
  "김민지",
  "minji@example.com",
).lastInsertRowid
insertLoan.run(memberId, databaseBookId)

console.log("도서와 저자 JOIN")
console.table(
  database
    .prepare(`
      SELECT books.id, books.title, authors.name AS author, books.stock
      FROM books
      JOIN authors ON authors.id = books.author_id
      ORDER BY books.id
    `)
    .all(),
)

console.log("현재 대출과 회원 JOIN")
console.table(
  database
    .prepare(`
      SELECT
        loans.id,
        members.name AS member,
        books.title AS book,
        loans.loaned_at
      FROM loans
      JOIN members ON members.id = loans.member_id
      JOIN books ON books.id = loans.book_id
      WHERE loans.returned_at IS NULL
    `)
    .all(),
)

console.log("foreign key 설정")
console.table(database.prepare("PRAGMA foreign_key_list(books)").all())

database.close()
console.log(`SQLite 파일: ${databasePath}`)
