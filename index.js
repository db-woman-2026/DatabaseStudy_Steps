const { createBookDocument } = require("./lib/bookInput")
const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

function showHelp() {
  console.log(`
MongoDB CRUD 기초

사용법:
  npm start -- seed
  npm start -- list [category]
  npm start -- get <isbn>
  npm start -- add <isbn> <title> <author> <stock> [categories]

예시:
  npm start -- list database
  npm start -- get 978-00-0001
  npm start -- add 978-00-0099 "새 도서" "학생 저자" 3 "database,mongodb"
`)
}

async function prepareCollection(database) {
  const books = database.collection("books_course")
  await books.createIndex({ isbn: 1 }, { unique: true })
  await books.createIndex({ categories: 1 })
  return books
}

async function seedBooks(books) {
  await books.deleteMany({})
  const result = await books.insertMany(sampleBooks)
  console.log(`샘플 도서 ${result.insertedCount}권 생성`)
}

async function listBooks(books, category) {
  const normalizedCategory = String(category ?? "").trim().toLowerCase()
  const filter = normalizedCategory ? { categories: normalizedCategory } : {}
  const rows = await books
    .find(filter, {
      projection: {
        _id: 0,
        isbn: 1,
        title: 1,
        "author.name": 1,
        categories: 1,
        "inventory.stock": 1,
      },
    })
    .sort({ title: 1 })
    .toArray()

  console.log(`조회 결과: ${rows.length}권`)
  console.log(JSON.stringify(rows, null, 2))
}

async function getBook(books, isbn) {
  if (!isbn) {
    throw new Error("조회할 isbn을 입력하세요.")
  }

  const book = await books.findOne({ isbn }, { projection: { _id: 0 } })

  if (!book) {
    console.log("도서를 찾지 못했습니다.")
    return
  }

  console.log(JSON.stringify(book, null, 2))
}

async function addBook(books, args) {
  const book = createBookDocument(args)
  const result = await books.insertOne(book)
  console.log(`도서 생성 완료: ${book.isbn}, id=${result.insertedId}`)
  await getBook(books, book.isbn)
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2)

  if (command === "help") {
    showHelp()
    return
  }

  await withDatabase(async (database, databaseName) => {
    const books = await prepareCollection(database)
    console.log(`database: ${databaseName}`)

    if (command === "seed") {
      await seedBooks(books)
    } else if (command === "list") {
      await listBooks(books, args[0])
    } else if (command === "get") {
      await getBook(books, args[0])
    } else if (command === "add") {
      await addBook(books, args)
    } else {
      showHelp()
      throw new Error(`알 수 없는 command: ${command}`)
    }
  })
}

main().catch((error) => {
  console.error("MongoDB CRUD 실습 실패")
  console.error(error.message)
  process.exitCode = 1
})
