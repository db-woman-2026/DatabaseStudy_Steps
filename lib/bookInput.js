function requireText(value, fieldName) {
  const text = String(value ?? "").trim()

  if (!text) {
    throw new Error(`${fieldName} 값을 입력하세요.`)
  }

  return text
}

function parseStock(value) {
  const text = String(value ?? "").trim()

  if (!text) {
    throw new Error("stock 값을 입력하세요.")
  }

  const stock = Number(text)

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("stock은 0 이상의 정수여야 합니다.")
  }

  return stock
}

function parseCategories(value) {
  const categories = String(value ?? "")
    .split(",")
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(categories)]
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createBookDocument(args) {
  const [isbnValue, titleValue, authorValue, stockValue, categoriesValue] = args

  return {
    isbn: requireText(isbnValue, "isbn"),
    title: requireText(titleValue, "title"),
    author: {
      name: requireText(authorValue, "author"),
      country: "KR",
    },
    categories: parseCategories(categoriesValue),
    publisherCode: "STUDENT",
    inventory: {
      stock: parseStock(stockValue),
      location: "PRACTICE",
    },
    publishedYear: new Date().getFullYear(),
    reviews: [],
    courseSeed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

module.exports = {
  createBookDocument,
  escapeRegex,
  parseCategories,
  parseStock,
}
