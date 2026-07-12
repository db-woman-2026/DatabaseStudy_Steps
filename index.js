const {
  createBookDocument,
  escapeRegex,
  parseStock,
} = require("./lib/bookInput")
const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

function showHelp() {
  console.log(`
MongoDB CRUD 응용

기준 데이터:
  npm start -- seed

생성·조회:
  npm start -- list [category]
  npm start -- get <isbn>
  npm start -- add <isbn> <title> <author> <stock> [categories]

조건 검색·수정·삭제:
  npm start -- search <keyword> [minStock]
  npm start -- update-stock <isbn> <stock>
  npm start -- add-category <isbn> <category>
  npm start -- remove <isbn> confirm
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
  const filter = category ? { categories: category.toLowerCase() } : {}
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
    return null
  }

  console.log(JSON.stringify(book, null, 2))
  return book
}

async function addBook(books, args) {
  const book = createBookDocument(args)
  const result = await books.insertOne(book)
  console.log(`도서 생성 완료: ${book.isbn}, id=${result.insertedId}`)
  await getBook(books, book.isbn)
}

async function searchBooks(books, keywordValue, minStockValue) {
  const keyword = String(keywordValue ?? "").trim()

  if (!keyword) {
    throw new Error("검색어를 입력하세요.")
  }

  const pattern = new RegExp(escapeRegex(keyword), "i")
  const filter = {
    $or: [
      { title: pattern },
      { "author.name": pattern },
      { categories: pattern },
    ],
  }

  if (minStockValue !== undefined) {
    filter["inventory.stock"] = { $gte: parseStock(minStockValue) }
  }

  const rows = await books
    .find(filter, { projection: { _id: 0, isbn: 1, title: 1, inventory: 1 } })
    .sort({ "inventory.stock": -1 })
    .toArray()

  console.log(`검색 결과: ${rows.length}권`)
  console.table(rows)
}

async function updateStock(books, isbn, stockValue) {
  const stock = parseStock(stockValue)
  const target = await books.findOne(
    { isbn },
    { projection: { _id: 0, isbn: 1, title: 1, inventory: 1 } },
  )

  if (!target) {
    console.log("수정할 도서를 찾지 못했습니다.")
    return
  }

  console.log("수정 전", target)
  const result = await books.updateOne(
    { isbn },
    { $set: { "inventory.stock": stock, updatedAt: new Date() } },
  )
  console.log(`수정 결과: matched=${result.matchedCount}, changed=${result.modifiedCount}`)
  await getBook(books, isbn)
}

async function addCategory(books, isbn, categoryValue) {
  const category = String(categoryValue ?? "").trim().toLowerCase()

  if (!category) {
    throw new Error("추가할 category를 입력하세요.")
  }

  const result = await books.updateOne(
    { isbn },
    {
      $addToSet: { categories: category },
      $set: { updatedAt: new Date() },
    },
  )
  console.log(`category 결과: matched=${result.matchedCount}, changed=${result.modifiedCount}`)
  await getBook(books, isbn)
}

async function removeBook(books, isbn, confirmation) {
  const target = await books.findOne(
    { isbn },
    { projection: { _id: 0, isbn: 1, title: 1 } },
  )

  if (!target) {
    console.log("삭제할 도서를 찾지 못했습니다.")
    return
  }

  console.log("삭제 대상", target)

  if (confirmation !== "confirm") {
    console.log("삭제하려면 마지막 인자로 confirm을 입력하세요.")
    return
  }

  const result = await books.deleteOne({ isbn })
  console.log(`삭제 결과: ${result.deletedCount}건`)
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

    const commands = {
      seed: () => seedBooks(books),
      list: () => listBooks(books, args[0]),
      get: () => getBook(books, args[0]),
      add: () => addBook(books, args),
      search: () => searchBooks(books, args[0], args[1]),
      "update-stock": () => updateStock(books, args[0], args[1]),
      "add-category": () => addCategory(books, args[0], args[1]),
      remove: () => removeBook(books, args[0], args[1]),
    }

    const runCommand = commands[command]

    if (!runCommand) {
      showHelp()
      throw new Error(`알 수 없는 command: ${command}`)
    }

    await runCommand()
  })
}

main().catch((error) => {
  console.error("MongoDB CRUD 실습 실패")
  console.error(error.message)
  process.exitCode = 1
})
