import { describe, expect, it } from "vitest"

import {
  buildMemoryContext,
  lastUserText,
  normalizeKey,
  parseExtractionOutput,
} from "@/lib/memory-shared"

describe("normalizeKey", () => {
  it("lowercases and snake_cases arbitrary text", () => {
    expect(normalizeKey("My Cat's Name!")).toBe("my_cat_s_name")
    expect(normalizeKey("Favorite Color")).toBe("favorite_color")
    expect(normalizeKey(" dog name ")).toBe("dog_name")
  })

  it("caps length and trims trailing separators after slicing", () => {
    const key = normalizeKey("a".repeat(70) + " b")
    expect(key.length).toBeLessThanOrEqual(64)
    expect(key.endsWith("_")).toBe(false)
  })

  it("never returns an empty non-empty-input string of separators", () => {
    expect(normalizeKey("!!!")).toBe("")
  })
})

describe("parseExtractionOutput", () => {
  it("parses a clean JSON object", () => {
    const items = parseExtractionOutput(
      `{"memories":[{"key":"cat_name","value":"XYZ","category":"personal_fact"}]}`
    )
    expect(items).toEqual([
      { key: "cat_name", value: "XYZ", category: "personal_fact" },
    ])
  })

  it("parses JSON embedded in prose or fences", () => {
    const items = parseExtractionOutput(
      'Sure! ```json\n{"memories":[{"key":"Favorite Color","value":"teal","category":"preference"}]}\n``` hope that helps'
    )
    expect(items).toEqual([
      { key: "favorite_color", value: "teal", category: "preference" },
    ])
  })

  it("returns nothing for garbage output", () => {
    expect(parseExtractionOutput("I could not find any facts.")).toEqual([])
    expect(parseExtractionOutput('{"memories": [{"key":')).toEqual([])
  })

  it("drops items failing validation and unknown categories", () => {
    const items = parseExtractionOutput(
      `{"memories":[
        {"key":"ok","value":"fine","category":"preference"},
        {"key":"","value":"no key","category":"personal_fact"},
        {"key":"no_value","value":"","category":"personal_fact"},
        {"key":"bad_cat","value":"x","category":"secret"}
      ]}`
    )
    expect(items).toEqual([
      { key: "ok", value: "fine", category: "preference" },
    ])
  })

  it("dedupes by normalized key and caps at 3", () => {
    const items = parseExtractionOutput(
      `{"memories":[
        {"key":"cat_name","value":"first","category":"personal_fact"},
        {"key":"Cat Name","value":"second","category":"personal_fact"},
        {"key":"k1","value":"v1","category":"personal_fact"},
        {"key":"k2","value":"v2","category":"personal_fact"},
        {"key":"k3","value":"v3","category":"personal_fact"}
      ]}`
    )
    expect(items).toHaveLength(3)
    // "Cat Name" normalizes to the same key, so the pair collapses to one.
    expect(items[0].value).toBe("second")
  })
})

describe("buildMemoryContext", () => {
  it("is empty with no memories", () => {
    expect(buildMemoryContext([])).toBe("")
  })

  it("lists facts with a no-inventing instruction", () => {
    const block = buildMemoryContext([{ key: "cat_name", value: "XYZ" }])
    expect(block).toContain("GLOBAL USER MEMORY")
    expect(block).toContain("- cat_name: XYZ")
    expect(block).toContain("say you don't know instead of guessing")
  })
})

describe("lastUserText", () => {
  it("returns the newest user message", () => {
    const text = lastUserText([
      { role: "user", content: "My cat's name is XYZ." },
      { role: "assistant", content: "Nice." },
      { role: "user", content: "What is my cat's name?" },
    ])
    expect(text).toBe("What is my cat's name?")
  })

  it("joins text parts of structured content", () => {
    const text = lastUserText([
      {
        role: "user",
        content: [
          { type: "text", text: "My cat's name is " },
          { type: "text", text: "XYZ." },
        ],
      } as never,
    ])
    expect(text).toBe("My cat's name is \nXYZ.")
  })

  it("skips user messages without text and finds the previous turn", () => {
    const text = lastUserText([
      { role: "user", content: "My cat's name is XYZ." },
      { role: "assistant", content: "Noted." },
      { role: "user", content: [{ type: "image", image: "x" }] } as never,
    ])
    expect(text).toBe("My cat's name is XYZ.")
  })

  it("returns undefined with no user messages", () => {
    expect(lastUserText([{ role: "assistant", content: "hi" }])).toBeUndefined()
  })
})
