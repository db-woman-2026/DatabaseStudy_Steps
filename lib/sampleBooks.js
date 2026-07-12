const sampleBooks = [
  {
    isbn: "978-00-0001",
    title: "데이터를 배우는 시간",
    author: {
      name: "김데이터",
      country: "KR",
    },
    categories: ["database", "beginner"],
    publisherCode: "DATA-LAB",
    inventory: {
      stock: 3,
      location: "A-01",
    },
    publishedYear: 2025,
    reviews: [],
    courseSeed: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  },
  {
    isbn: "978-00-0002",
    title: "MongoDB 첫걸음",
    author: {
      name: "박문서",
      country: "KR",
    },
    categories: ["database", "mongodb"],
    publisherCode: "DATA-LAB",
    inventory: {
      stock: 5,
      location: "A-02",
    },
    publishedYear: 2026,
    reviews: [
      {
        reviewer: "민지",
        score: 5,
        comment: "문서 구조를 이해하기 쉬웠어요.",
      },
    ],
    courseSeed: true,
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
  },
  {
    isbn: "978-00-0003",
    title: "Node.js 실습 노트",
    author: {
      name: "이노드",
      country: "KR",
    },
    categories: ["nodejs", "beginner"],
    publisherCode: "WEB-BOOKS",
    inventory: {
      stock: 1,
      location: "B-01",
    },
    publishedYear: 2024,
    reviews: [],
    courseSeed: true,
    createdAt: new Date("2026-07-03T00:00:00.000Z"),
  },
]

module.exports = {
  sampleBooks,
}
