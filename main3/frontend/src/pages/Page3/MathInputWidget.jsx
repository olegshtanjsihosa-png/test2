import 'katex/dist/katex.min.css';
import { useEffect, useMemo, useRef } from 'react';
import katex from 'katex';

export default function MathInputWidget({
  template = '',
  values = [],
  placeholders = [],
  invalidIndexes = [],
  onChange,
}) {
  const containerRef = useRef(null);
  const inputsRef = useRef({});
  const invalidKey = Array.isArray(invalidIndexes) ? invalidIndexes.join(',') : '';
  const invalidSet = useMemo(() => new Set(invalidIndexes), [invalidKey]);

  const buildTemplate = (latex) => {
    const seenPh = new Map();
    let nextIndex = 0;

    return latex.replace(/___|\bph_?\{?(\d+)\}?/g, (match, phNumber) => {
      let current;

      if (phNumber) {
        const key = `ph${phNumber}`;
        if (!seenPh.has(key)) {
          seenPh.set(key, Math.max(Number(phNumber) - 1, 0));
        }
        current = seenPh.get(key);
      } else {
        current = nextIndex;
        nextIndex += 1;
      }

      return String.raw`
        \htmlClass{math-input-slot math-input-slot-${current}}{
          \phantom{000}
        }
      `;
    });
  };

  const createInput = (realIndex) => {
    const input = document.createElement('input');
    const isInvalid = invalidSet.has(realIndex);

    input.type = 'text';
    input.value = values?.[realIndex] ?? '';
    input.placeholder = placeholders?.[realIndex] ?? '';
    input.className = 'math-input-field';

    input.style.cssText = `
      width: 74px;
      min-width: 74px;
      height: 36px;
      border: 1px solid ${isInvalid ? '#ef4444' : '#b8b8b8'};
      border-radius: 8px;
      background: ${isInvalid ? '#fef2f2' : '#fff'};
      padding: 0 10px;
      text-align: center;
      font-size: 16px;
      font-family: Arial, sans-serif;
      color: #111827;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      position: relative;
      z-index: 50;
      cursor: text;
    `;

    input.addEventListener('focus', () => {
      input.style.borderColor = isInvalid ? '#ef4444' : '#4a90e2';
      input.style.boxShadow = isInvalid
        ? '0 0 0 3px rgba(239,68,68,0.12)'
        : '0 0 0 3px rgba(74,144,226,0.15)';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = isInvalid ? '#ef4444' : '#b8b8b8';
      input.style.boxShadow = isInvalid ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none';
    });

    input.addEventListener('input', (e) => {
      onChange?.(realIndex, e.target.value);
    });

    return input;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    inputsRef.current = {};

    katex.render(buildTemplate(template), container, {
      throwOnError: false,
      displayMode: true,
      trust: true,
      strict: false,
    });

    container.querySelectorAll('.mfrac, .vlist').forEach((el) => {
      el.style.pointerEvents = 'none';
    });

    requestAnimationFrame(() => {
      const slots = Array.from(container.querySelectorAll('.math-input-slot'));

      slots
        .sort((a, b) => {
          const ai = Number(a.className.match(/-(\d+)/)?.[1] ?? 0);
          const bi = Number(b.className.match(/-(\d+)/)?.[1] ?? 0);
          return ai - bi;
        })
        .forEach((slot) => {
          const index = Number(slot.className.match(/-(\d+)/)?.[1]);
          const input = createInput(index);
          inputsRef.current[index] = input;

          slot.innerHTML = '';
          Object.assign(slot.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            verticalAlign: 'middle',
            minWidth: '74px',
            minHeight: '36px',
            margin: '0 4px',
            position: 'relative',
            zIndex: 50,
          });

          slot.appendChild(input);
        });
    });
  }, [template, invalidKey]);

  useEffect(() => {
    Object.entries(inputsRef.current).forEach(([i, input]) => {
      const val = values?.[Number(i)] ?? '';

      if (document.activeElement === input) return;
      input.value = String(val);
    });
  }, [values]);

  return (
    <div className="math-input-scroll">
      <style>{`
        .math-input-scroll {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;
        }

        .math-input-field::placeholder {
          color: #9ca3af;
          font-size: 13px;
        }

        .math-input-slot {
          pointer-events: auto !important;
        }

        .katex {
          display: inline-block !important;
          white-space: nowrap !important;
        }

        .katex-display {
          display: inline-block !important;
          overflow: visible !important;
          margin: 0 !important;
        }
      `}</style>

      <div
        ref={containerRef}
        style={{
          fontSize: '28px',
          lineHeight: 1.8,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          padding: '14px',
          minWidth: 'max-content',
        }}
      />
    </div>
  );
}
