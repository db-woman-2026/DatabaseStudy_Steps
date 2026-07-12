const assert = require("node:assert/strict")
const test = require("node:test")
const {
  createBookDocument,
  createReviewDocument,
  escapeRegex,
  parseCategories,
  parseScore,
  parseStock,
} = require("../lib/bookInput")

test("parseStock은 0 이상의 정수를 반환한다", () => {
  assert.equal(parseStock("3"), 3)
  assert.equal(parseStock(0), 0)
})

test("escapeRegex는 검색어의 정규식 기호를 일반 문자로 바꾼다", () => {
  assert.equal(escapeRegex("Node.js (기초)"), "Node\\.js \\(기초\\)")
})

test("parseStock은 음수와 소수를 거부한다", () => {
  assert.throws(() => parseStock("-1"), /0 이상의 정수/)
  assert.throws(() => parseStock("1.5"), /0 이상의 정수/)
})

test("parseCategories는 공백과 중복을 정리한다", () => {
  assert.deepEqual(parseCategories(" Database, beginner, database "), [
    "database",
    "beginner",
  ])
})

test("createBookDocument는 CLI 값을 중첩 문서로 바꾼다", () => {
  const book = createBookDocument([
    "978-test",
    "테스트 도서",
    "테스트 저자",
    "2",
    "database,mongodb",
  ])

  assert.equal(book.isbn, "978-test")
  assert.equal(book.author.name, "테스트 저자")
  assert.equal(book.inventory.stock, 2)
  assert.deepEqual(book.categories, ["database", "mongodb"])
})

test("parseScore는 1부터 5 사이 정수만 허용한다", () => {
  assert.equal(parseScore("5"), 5)
  assert.throws(() => parseScore("0"), /1부터 5/)
  assert.throws(() => parseScore("6"), /1부터 5/)
})

test("createReviewDocument는 리뷰 입력을 중첩 문서로 바꾼다", () => {
  const review = createReviewDocument(["민지", "4", "도움이 됐어요."])

  assert.equal(review.reviewer, "민지")
  assert.equal(review.score, 4)
  assert.equal(review.comment, "도움이 됐어요.")
  assert.ok(review.createdAt instanceof Date)
})
