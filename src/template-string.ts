import { readFileSync } from "fs"
import { resolve } from "path"
import Bluebird = require("bluebird")
import { isPrimitive, Primitive } from "./types/common"
import { deepResolve } from "./util"
import * as deepMap from "deep-map"

type KeyResolver = (keyParts: string[]) => Promise<string> | string

export interface TemplateStringContext {
  [type: string]: Primitive | KeyResolver | TemplateStringContext | undefined
}

class TemplateStringError extends Error { }

let _parser: any

function getParser() {
  if (!_parser) {
    try {
      _parser = require("./template-string-parser")
    } catch (_err) {
      // fallback for when running with ts-node or mocha
      const peg = require("pegjs")
      const pegFilePath = resolve(__dirname, "template-string.pegjs")
      const grammar = readFileSync(pegFilePath)
      _parser = peg.generate(grammar.toString())
    }
  }

  return _parser
}

/**
 * Parse and resolve a templated string, with the given context. The template format is similar to native JS templated
 * strings but only supports simple lookups from the given context, e.g. "prefix-${nested.key}-suffix", and not
 * arbitrary JS code.
 *
 * The context should be a map whose values are either primitives (string, number or boolean), resolver functions
 * or a nested context maps.
 *
 * Resolver functions should accept a key path as an array of strings and return a string or string Promise.
 *
 * @param {string} string
 * @param {TemplateStringContext} context
 * @returns {Promise<string>}
 */
export async function parseTemplateString(string: string, context: TemplateStringContext) {
  const parser = getParser()
  const parsed = parser.parse(string, { getKey: genericResolver(context), TemplateStringError })

  const resolved = await Bluebird.all(parsed)
  return resolved.join("")
}

export function genericResolver(context: TemplateStringContext) {
  return (parts: string[]) => {
    const path = parts.join(".")
    let value

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p]
      value = value ? value[part] : context[part]

      switch (typeof value) {
        case "function":
          // pass the rest of the key parts to the resolver function
          return value(parts.slice(p + 1))

        case "undefined":
          throw new TemplateStringError(`Could not find key: ${path}`)
      }
    }

    if (!isPrimitive(value)) {
      throw new TemplateStringError(`Value at ${path} exists but is not a primitive (string, number or boolean)`)
    }

    return value
  }
}

/**
 * Recursively parses and resolves all templated strings in the given object.
 *
 * @param {T} o
 * @param {TemplateStringContext} context
 * @returns {Promise<T>}
 */
export async function resolveTemplateStrings<T extends object>(o: T, context: TemplateStringContext): Promise<T> {
  const mapped = deepMap(o, (v) => typeof v === "string" ? parseTemplateString(v, context) : v)
  return deepResolve(mapped)
}

export async function getTemplateContext(extraContext: TemplateStringContext = {}): Promise<TemplateStringContext> {
  const baseContext: TemplateStringContext = {
    // TODO: add user configuration here
    env: process.env,
  }

  return { ...baseContext, ...extraContext }
}