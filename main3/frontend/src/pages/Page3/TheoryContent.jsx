import { useEffect, useState } from 'react'
import FormulaBlock from './FormulaBlock'
import { buildContentFromElement, pickContentElement } from './contentData'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function getCsrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrftoken='))
    ?.split('=')[1]
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

export default function TheoryContent({ labId, onComplete }) {
  const [theory, setTheory] = useState({
    title: 'Загрузка...',
    sections: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultId, setResultId] = useState(null)
  const [resultIsPassed, setResultIsPassed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function loadTheory() {
    try {
      setLoading(true)
      setError(null)

      const endpoint = labId
        ? `${API_BASE}/laboratory-works/${labId}/theory/`
        : `${API_BASE}/elements/`

      const response = await fetch(endpoint, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status}`)
      }

      const data = await response.json()
      const element = pickContentElement(data, 'theory')

      setTheory(buildContentFromElement(element, 'Теория'))
      setResultId(element?.result_id || null)
      setResultIsPassed(Boolean(element?.result_is_passed))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Ошибка загрузки')
      setTheory({
        title: 'Теория',
        sections: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (labId) {
      loadTheory()
    }
  }, [labId])

  async function handleComplete() {
    if (!resultId) return

    try {
      setSubmitting(true)

      const response = await fetch(`${API_BASE}/results/${resultId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken() || '',
        },
        body: JSON.stringify({
          is_passed: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Не удалось обновить статус')
      }

      setResultIsPassed(true)
      window.dispatchEvent(new Event('results-updated'))
      onComplete?.()
    } catch (err) {
      console.error(err)
      alert(err.message || 'Ошибка сохранения')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 h-full bg-white rounded-b-md border border-x border-b border-gray-200 overflow-y-auto p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold ${
              resultIsPassed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {resultIsPassed ? 'Пройдено' : 'Не пройдено'}
          </span>
        </div>
      </div>

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

      {!loading &&
        !error &&
        theory.sections.map((section, sectionIndex) => (
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
                  <div
                    key={itemIndex}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center my-4 overflow-x-auto"
                  >
                    <FormulaBlock math={item.latex} />
                  </div>
                )
              }

              return null
            })}
          </div>
        ))}

      <div className="mt-6">
        <button
          onClick={handleComplete}
          disabled={!resultId || resultIsPassed || submitting}
          className="w-auto rounded bg-emerald-600 text-white text-sm px-4 py-3 disabled:opacity-50 hover:bg-emerald-700 transition-colors"
        >
          {resultIsPassed
            ? 'Уже пройдено'
            : submitting
            ? 'Сохраняем...'
            : 'Завершить и отметить как пройдено'}
        </button>
      </div>
    </div>
  )
}
