import { evaluate } from 'mathjs'

export function normalizeExpression(expression) {
  return String(expression || '')
    .replace(/\*\*/g, '^')
    .replace(/,/g, '.')
    .replace(/^.*?=/, '')
    .trim()
}

export function evalExpression(expression, variables = {}, x = null) {
  try {
    const scope = x === null ? variables : { ...variables, x }
    const result = evaluate(normalizeExpression(expression), scope)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export function parseNumeric(value) {
  const text = String(value ?? '').replace(',', '.').trim()
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null

  const number = Number(text)
  if (!Number.isFinite(number)) return null

  return { number, decimals: text.split('.')[1]?.length || 0 }
}

function truncateToTwo(value) {
  return Math.trunc(value * 100) / 100
}

export function compareValues(answer, expected, tolerance = 1e-6) {
  const user = parseNumeric(answer)
  const correct = parseNumeric(expected)

  if (user && correct) {
    if (user.decimals >= 2 || correct.decimals >= 2) {
      return Math.abs(truncateToTwo(user.number) - truncateToTwo(correct.number)) < tolerance
    }

    return Math.abs(user.number - correct.number) < tolerance
  }

  return String(answer ?? '').trim() === String(expected ?? '').trim()
}

function compareText(answer, expected) {
  let userAnswer = String(answer).trim().toLowerCase()
  let correctAnswer = String(expected).trim().toLowerCase()

  if (userAnswer.endsWith('.')) userAnswer = userAnswer.slice(0, -1)
  if (correctAnswer.endsWith('.')) correctAnswer = correctAnswer.slice(0, -1)
  if (userAnswer.endsWith('!') || userAnswer.endsWith('?')) userAnswer = userAnswer.slice(0, -1)
  if (correctAnswer.endsWith('!') || correctAnswer.endsWith('?')) correctAnswer = correctAnswer.slice(0, -1)

  if (userAnswer === correctAnswer) return true

  if (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
    return Math.abs(userAnswer.length - correctAnswer.length) <= 3
  }

  return false
}

export function validateAnswer(answer, expected, type, answerFormat, tolerance = 1e-6) {
  const hasAnswer = answer !== undefined && answer !== null && answer !== ''
  if (!hasAnswer) return false

  if (type === 'polynomial' || answerFormat === 'expression') {
    const expectedExpression = typeof expected === 'object' ? expected.expression : expected
    const samplePoints = typeof expected === 'object' && expected.sample_points?.length
      ? expected.sample_points
      : [-2, -1, 0, 1, 2, 3]

    return samplePoints.every((point) => {
      const userValue = evalExpression(answer, {}, point)
      const expectedValue = evalExpression(expectedExpression, {}, point)
      return userValue !== null && expectedValue !== null && Math.abs(userValue - expectedValue) < tolerance
    })
  }

  if (type === 'calculated' || answerFormat === 'number') {
    return compareValues(answer, expected, tolerance)
  }

  if (type === 'calculated_input' || answerFormat === 'array') {
    if (!Array.isArray(answer)) return false

    let expectedArray = expected
    if (!Array.isArray(expectedArray)) {
      expectedArray = expected?.expected_inputs
    }

    if (!Array.isArray(expectedArray) || answer.length !== expectedArray.length) {
      return false
    }

    return expectedArray.every((item, index) => {
      const value = answer[index] === undefined || answer[index] === null ? '' : String(answer[index]).trim()
      return compareValues(value, item, tolerance)
    })
  }

  if (type === 'single_choice' || answerFormat === 'single') {
    return String(answer) === String(expected)
  }

  return compareText(answer, expected)
}
