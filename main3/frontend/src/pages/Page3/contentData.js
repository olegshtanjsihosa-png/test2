const typeAliases = {
  theory: ['theory', 'теория'],
  task: ['task', 'self', 'самостоятельное задание', 'задание'],
  training: ['training', 'обучающее задание'],
}

function getTypeName(item) {
  return (
    item?.element_type?.name ||
    item?.type ||
    item?.name ||
    item?.element?.type ||
    ''
  ).toString().toLowerCase()
}

function matchesType(item, expectedType) {
  const aliases = typeAliases[expectedType] || [expectedType]
  const typeName = getTypeName(item)

  return aliases.some((alias) => typeName === alias || typeName.includes(alias))
}

function flattenBindings(data) {
  const source = Array.isArray(data) ? data : [data].filter(Boolean)
  const result = []

  for (const item of source) {
    if (item?.characteristic_values) {
      result.push(item)
    }

    for (const element of item?.elements || []) {
      for (const binding of element?.type_bindings || []) {
        result.push({
          ...binding,
          lab_element_title: binding.lab_element_title || element.title,
          laboratory_work_title: binding.laboratory_work_title || item.title,
        })
      }
    }

    for (const binding of item?.type_bindings || []) {
      result.push({
        ...binding,
        lab_element_title: binding.lab_element_title || item.title,
      })
    }
  }

  return result
}

export function pickContentElement(data, expectedType) {
  const bindings = flattenBindings(data)
  return bindings.find((item) => matchesType(item, expectedType)) || bindings[0] || null
}

export function buildContentFromElement(element, fallbackTitle) {
  if (!element) {
    return {
      title: fallbackTitle,
      sections: [],
    }
  }

  const sections = []
  let currentSection = null

  const priority = {
    subtitle: 1,
    paragraphs: 2,
    formula: 3,
    note: 4,
  }

  const values = (element.characteristic_values || [])
    .map((item, index) => ({ ...item, __index: index }))
    .sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY
      const orderB = Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY

      if (orderA !== orderB) return orderA - orderB

      const nameA = a.characteristic?.name || ''
      const nameB = b.characteristic?.name || ''
      const priorityA = priority[nameA] ?? 999
      const priorityB = priority[nameB] ?? 999

      if (priorityA !== priorityB) return priorityA - priorityB
      if (nameA !== nameB) return nameA.localeCompare(nameB)

      return a.__index - b.__index
    })

  for (const item of values) {
    const type = item.characteristic?.name
    const rawValue = item.value ?? item.value_text ?? item.value_integer ?? item.value_boolean ?? ''
    const text = String(rawValue ?? '')
    const latex = (type === 'formula' ? text : '').trim()

    if (type === 'subtitle') {
      currentSection = { subtitle: text || '', content: [] }
      sections.push(currentSection)
      continue
    }

    if (!currentSection) {
      currentSection = { subtitle: '', content: [] }
      sections.push(currentSection)
    }

    if (type === 'paragraphs') {
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((paragraph) => {
          currentSection.content.push({ type: 'paragraph', value: paragraph })
        })
      continue
    }

    if (type === 'formula') {
      if (latex) currentSection.content.push({ type: 'formula', latex })
      continue
    }

    if (text) {
      currentSection.content.push({ type: 'paragraph', value: text })
    }
  }

  return {
    title: element.lab_element_title || fallbackTitle,
    sections,
  }
}

export function normalizeAssignmentData(data) {
  if (!data) return null
  if (data.success && Array.isArray(data.steps)) return data

  const element = pickContentElement(data, 'training')
  if (!element) return data

  return {
    ...data,
    success: data.success ?? true,
    element: data.element || {
      title: element.lab_element_title,
      type: 'training',
    },
    steps: data.steps || element.steps || [],
    generated_variables: data.generated_variables || {},
    functions: data.functions || [],
    result_id: data.result_id ?? element.result_id ?? null,
    result_is_passed: data.result_is_passed ?? element.result_is_passed ?? false,
  }
}
