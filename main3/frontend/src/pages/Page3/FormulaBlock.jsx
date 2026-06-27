import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function normalizeMath(math) {
  return String(math || '')
    .replace(/ξ/g, '\\xi')
    .replace(/ω\s*([A-Za-z])\s*\(/g, '\\omega_$1(')
    .replace(/\^\(([^)]+)\)/g, '^{($1)}')
    .replace(/\(\(1\s*\/\s*\(\(([^()]+)\)!\)\)\)/g, '\\frac{1}{($1)!}')
    .replace(/1\s*\/\s*\(\(([^()]+)\)!\)/g, '\\frac{1}{($1)!}')
    .replace(/\\ldots\s*(?=[A-Za-zА-Яа-я])/g, '\\ldots, ')
    .replace(/\.\.\./g, '\\ldots')
    .replace(/[В·⋅]/g, '\\cdot ')
    .replace(/\*/g, '\\cdot ')
    .replace(/[ΣОЈ]\((\w+)=([^.)]+)\\ldots\s*,?\s*([^,)]+)\)/g, '\\sum_{$1=$2}^{$3}')
    .replace(/[ΣОЈ]\((\w+)=([^.)]+)\.\.\.([^,)]+)\)/g, '\\sum_{$1=$2}^{$3}')
    .replace(/[ΠО]\((\w+)=([^.)]+)\\ldots\s*,?\s*([^,)]+)\)/g, '\\prod_{$1=$2}^{$3}')
    .replace(/[ΠО]\((\w+)=([^.)]+)\.\.\.([^,)]+)\)/g, '\\prod_{$1=$2}^{$3}')
    .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}')
    .replace(/([A-Za-z0-9_]+)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}')
}

export default function FormulaBlock({ math }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    const normalizedMath = normalizeMath(math)

    try {
      katex.render(normalizedMath, ref.current, {
        throwOnError: false,
        displayMode: true,
        strict: false,
        trust: true,
      })
    } catch (error) {
      console.error(error)
      ref.current.textContent = normalizedMath
    }
  }, [math])

  return <div ref={ref} />
}
