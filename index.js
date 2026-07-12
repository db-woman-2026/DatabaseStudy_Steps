const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

const samplePublishers = [
  {
    code: "DATA-LAB",
    name: "데이터 연구소",
    website: "https://example.com/data-lab",
  },
  {
    code: "WEB-BOOKS",
    name: "웹북스",
    website: "https://example.com/web-books",
  },
]

async function main() {
  await withDatabase(async (database, databaseName) => {
    const books = database.collection("books_step5")
    const publishers = database.collection("publishers_step5")

    await books.deleteMany({})
    await publishers.deleteMany({})

    await publishers.createIndex({ code: 1 }, { unique: true })
    await books.createIndex({ isbn: 1 }, { unique: true })
    await books.createIndex({ categories: 1 })
    await books.createIndex({ "inventory.stock": 1 })

    await publishers.insertMany(samplePublishers)
    await books.insertMany(sampleBooks)

    console.log(`database: ${databaseName}`)
    console.log("books_step5 인덱스")
    console.table(
      (await books.indexes()).map((index) => ({
        name: index.name,
        key: JSON.stringify(index.key),
        unique: index.unique ?? false,
      })),
    )

    const databaseBooks = await books
      .find(
        { categories: "database" },
        {
          projection: {
            _id: 0,
            title: 1,
            "author.name": 1,
            publisherCode: 1,
            "inventory.stock": 1,
          },
        },
      )
      .sort({ publishedYear: -1 })
      .toArray()

    console.log("database 카테고리 도서")
    console.log(JSON.stringify(databaseBooks, null, 2))

    const publisher = await publishers.findOne(
      { code: databaseBooks[0].publisherCode },
      { projection: { _id: 0 } },
    )

    console.log("publisherCode로 참조한 출판사")
    console.log(publisher)
  })
}

main().catch((error) => {
  console.error("MongoDB 실습 실행 실패")
  console.error(error.message)
  console.error("MongoDB 서버와 .env의 MONGODB_URI를 확인하세요.")
  process.exitCode = 1
})
