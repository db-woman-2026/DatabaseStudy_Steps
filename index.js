const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-3.sqlite")

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
    published_year INTEGER NOT NULL,
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

  INSERT INTO authors (name) VALUES ('김데이터'), ('이노드');
  INSERT INTO books (isbn, title, author_id, published_year, stock) VALUES
    ('978-00-0001', '데이터를 배우는 시간', 1, 2025, 3),
    ('978-00-0002', 'SQL 첫걸음', 1, 2024, 2),
    ('978-00-0003', 'Node.js 실습 노트', 2, 2023, 1),
    ('978-00-0004', '웹 개발자를 위한 데이터', 1, 2026, 4);
  INSERT INTO members (name, email) VALUES
    ('김민지', 'minji@example.com'),
    ('이준호', 'junho@example.com');
  INSERT INTO loans (member_id, book_id, returned_at) VALUES
    (1, 2, NULL),
    (2, 3, '2026-07-01 10:00:00');
`)

console.log("재고가 2권 이상인 도서")
console.table(
  database
    .prepare(`
      SELECT title, published_year, stock
      FROM books
      WHERE stock >= ?
      ORDER BY published_year DESC, title ASC
    `)
    .all(2),
)

console.log("저자별 도서 수와 총 재고")
console.table(
  database
    .prepare(`
      SELECT
        authors.name AS author,
        COUNT(books.id) AS book_count,
        SUM(books.stock) AS total_stock
      FROM authors
      LEFT JOIN books ON books.author_id = authors.id
      GROUP BY authors.id, authors.name
      ORDER BY book_count DESC
    `)
    .all(),
)

const updateEmail = database.prepare(`
  UPDATE members
  SET email = ?
  WHERE id = ?
`)
const emailResult = updateEmail.run("minji.new@example.com", 1)
console.log(`회원 email 수정: ${emailResult.changes}건`)

const deleteReturnedLoans = database.prepare(`
  DELETE FROM loans
  WHERE returned_at IS NOT NULL
`)
const deleteResult = deleteReturnedLoans.run()
console.log(`반납 완료 기록 정리: ${deleteResult.changes}건`)

function checkoutBook(memberId, bookId) {
  database.exec("BEGIN")

  try {
    const stockResult = database
      .prepare(`
        UPDATE books
        SET stock = stock - 1
        WHERE id = ? AND stock > 0
      `)
      .run(bookId)

    if (stockResult.changes !== 1) {
      throw new Error("대출 가능한 재고가 없습니다.")
    }

    database
      .prepare("INSERT INTO loans (member_id, book_id) VALUES (?, ?)")
      .run(memberId, bookId)

    database.exec("COMMIT")
    console.log(`대출 완료: member=${memberId}, book=${bookId}`)
  } catch (error) {
    database.exec("ROLLBACK")
    console.log(`대출 취소: ${error.message}`)
  }
}

checkoutBook(2, 1)

console.log("변경 후 현재 대출")
console.table(
  database
    .prepare(`
      SELECT members.name AS member, books.title AS book, loans.loaned_at
      FROM loans
      JOIN members ON members.id = loans.member_id
      JOIN books ON books.id = loans.book_id
      WHERE loans.returned_at IS NULL
      ORDER BY loans.id
    `)
    .all(),
)

database.close()
console.log(`SQLite 파일: ${databasePath}`)
