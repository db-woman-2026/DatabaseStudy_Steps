const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

async function main() {
  await withDatabase(async (database, databaseName) => {
    const books = database.collection("books_step4")

    await books.deleteMany({})
    const insertResult = await books.insertMany(sampleBooks)

    console.log(`database: ${databaseName}`)
    console.log(`생성한 문서: ${insertResult.insertedCount}개`)

    const savedBooks = await books
      .find({}, { projection: { _id: 0, isbn: 1, title: 1, categories: 1 } })
      .sort({ title: 1 })
      .toArray()

    console.log("\n저장된 도서 목록")
    console.table(savedBooks)

    const oneBook = await books.findOne(
      { isbn: "978-00-0001" },
      { projection: { _id: 0 } },
    )

    console.log("중첩 JSON 문서 한 개")
    console.log(JSON.stringify(oneBook, null, 2))
  })
}

main().catch((error) => {
  console.error("MongoDB 실습 실행 실패")
  console.error(error.message)
  console.error("MongoDB 서버와 .env의 MONGODB_URI를 확인하세요.")
  process.exitCode = 1
})
