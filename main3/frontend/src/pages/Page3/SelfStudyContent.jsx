import { useEffect, useMemo, useState } from 'react'
import FormulaBlock from './FormulaBlock'
import { validateAnswer } from './answerUtils'
import { buildContentFromElement, pickContentElement } from './contentData'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function getCsrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrftoken='))
    ?.split('=')[1]
}

function isCorrect(question, answer) {
  const expected = question.type === 'polynomial'
    ? { expression: question.expected_answer, sample_points: question.sample_points }
    : question.expected_answer

  return validateAnswer(answer, expected, question.type, question.answer_format)
}

function renderParagraph(paragraph, key) {
  const trimmed = paragraph.trim()

  if (!trimmed) {
    return (
      <p key={key} className="text-body mb-3">
        &nbsp;
      </p>
    )
  }

  return (
    <p key={key} className="text-body mb-3 leading-7">
      {trimmed}
    </p>
  )
}

function fallbackQuestions(data) {
  if (data?.questions?.length) return data.questions

  return (data?.steps || [])
    .flatMap((step) => step.tests || [])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

function FormulaSequence({ cards = [] }) {
  if (!cards.length) return null

  return (
    <div className="mb-8">
      {cards.map((item) => (
        <div key={item.title} className="mb-6">
          <h3 className="text-body font-semibold text-gray-800 mb-3">
            {item.title}
          </h3>
          <div className="text-center my-4 overflow-x-auto">
            <FormulaBlock math={item.formula} />
          </div>
        </div>
      ))}
    </div>
  )
}

function IntroContent({ content }) {
  if (!content?.subtitle && !content?.paragraphs?.length) return null

  return (
    <div className="mb-6">
      {content.subtitle && (
        <h3 className="text-body font-semibold text-gray-800 mb-3">
          {content.subtitle}
        </h3>
      )}
      {(content.paragraphs || []).map((paragraph, index) => renderParagraph(paragraph, index))}
    </div>
  )
}

export default function SelfStudyContent({ labId, onComplete }) {
  const [interactiveData, setInteractiveData] = useState(null)
  const [selfStudy, setSelfStudy] = useState({
    title: 'Загрузка...',
    sections: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [validation, setValidation] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const questions = useMemo(() => fallbackQuestions(interactiveData), [interactiveData])
  const allCorrect = validation && questions.length > 0 && questions.every((question) => validation[question.id])

  async function loadSelfStudy() {
    if (!labId) return

    setLoading(true)
    setError(null)
    setInteractiveData(null)
    setAnswers({})
    setValidation(null)

    try {
      const interactiveResponse = await fetch(`${API_BASE}/laboratory-works/${labId}/task/with_data/`, {
        credentials: 'include',
      })

      if (interactiveResponse.ok) {
        const data = await interactiveResponse.json()
        if (data.success && (data.questions?.length || data.steps?.length)) {
          setInteractiveData(data)
          return
        }
      }

      const response = await fetch(`${API_BASE}/laboratory-works/${labId}/task/`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status}`)
      }

      const data = await response.json()
      const element = pickContentElement(data, 'task')
      setSelfStudy(buildContentFromElement(element, 'Самостоятельное задание'))
    } catch (err) {
      console.error('Failed to load self study', err)
      setError(err.message || 'Ошибка загрузки')
      setSelfStudy({
        title: 'Самостоятельное задание',
        sections: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSelfStudy()
  }, [labId])

  function handleAnswerChange(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setValidation(null)
  }

  function handleCheck() {
    const nextValidation = {}
    questions.forEach((question) => {
      nextValidation[question.id] = isCorrect(question, answers[question.id])
    })
    setValidation(nextValidation)
  }

  async function handleComplete() {
    if (!interactiveData?.result_id || !allCorrect) return

    try {
      setSubmitting(true)
      const response = await fetch(`${API_BASE}/results/${interactiveData.result_id}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken() || '',
        },
        body: JSON.stringify({ is_passed: true }),
      })

      if (!response.ok) {
        throw new Error('Не удалось обновить статус')
      }

      setInteractiveData((prev) => ({ ...prev, result_is_passed: true }))
      window.dispatchEvent(new Event('results-updated'))
      onComplete?.()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Ошибка сохранения')
    } finally {
      setSubmitting(false)
    }
  }

  if (interactiveData) {
    return (
      <div className="flex-1 h-full bg-white rounded-b-md border border-x border-b border-gray-200 overflow-y-auto p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-3 py-1 text-xs font-semibold ${
                interactiveData.result_is_passed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {interactiveData.result_is_passed ? 'Пройдено' : 'Не пройдено'}
            </span>
          </div>
        </div>

        <IntroContent content={interactiveData.content} />

        {!interactiveData.content && interactiveData.description && (
          <p className="text-body mb-3 leading-7">
            {interactiveData.description}
          </p>
        )}

        {interactiveData.instructions && (
          <div className="mb-5 rounded border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
            {interactiveData.instructions}
          </div>
        )}

        <FormulaSequence cards={interactiveData.formula_cards || []} />

        <div className="space-y-4">
          {questions.map((question, index) => {
            const state = validation?.[question.id]

            return (
              <div
                key={question.id}
                className={`rounded border p-4 transition-colors ${
                  state === false
                    ? 'border-red-300 bg-red-50/60'
                    : state === true
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-800">
                    {index + 1}. {question.question_rendered || question.question}
                  </span>
                  <input
                    type="text"
                    value={answers[question.id] || ''}
                    onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                    className={`w-full rounded border px-3 py-2 text-sm outline-none transition-colors ${
                      state === false
                        ? 'border-red-400 bg-white'
                        : state === true
                        ? 'border-emerald-400 bg-white'
                        : 'border-gray-300'
                    }`}
                    placeholder={question.type === 'polynomial' ? 'Например: 2*x^2 - 3*x + 1' : 'Введите ответ'}
                  />
                </label>

                {state === false && (
                  <p className="mt-2 text-xs text-red-600">
                    Ответ пока неверный. Дробные ответы можно вводить до 2 знаков после точки без округления.
                  </p>
                )}
                {state === true && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Верно.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {validation && (
          <div
            className={`mt-4 rounded p-3 text-sm ${
              allCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {allCorrect
              ? 'Все ответы верные. Теперь можно завершить самостоятельное задание.'
              : 'Есть ошибки. Исправьте выделенные ответы и проверьте еще раз. Дроби проверяются до 2 знаков после точки без округления.'}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleCheck}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
          >
            Проверить ответы
          </button>
          <button
            onClick={handleComplete}
            disabled={!allCorrect || submitting || interactiveData.result_is_passed}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {interactiveData.result_is_passed
              ? 'Уже пройдено'
              : submitting
              ? 'Сохраняем...'
              : 'Завершить задание'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full bg-white rounded-b-md border border-x border-b border-gray-200 overflow-y-auto p-6">
      {loading && (
        <p className="text-body text-gray-600">
          Загрузка...
        </p>
      )}

      {error && (
        <p className="text-body text-red-600">
          Ошибка загрузки: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {selfStudy.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-8">
              {section.subtitle && (
                <h3 className="text-body font-semibold text-gray-800 mb-3">
                  {section.subtitle}
                </h3>
              )}

              {section.content.map((item, itemIndex) => {
                if (item.type === 'paragraph') {
                  return renderParagraph(item.value, itemIndex)
                }

                if (item.type === 'formula' && item.latex) {
                  return (
                    <div key={itemIndex} className="text-center my-4 overflow-x-auto">
                      <FormulaBlock math={item.latex} />
                    </div>
                  )
                }

                return null
              })}
            </div>
          ))}

        </>
      )}
    </div>
  )
}



