import { useState, useEffect, useCallback, useRef } from "react";
import MathInputWidget from "./MathInputWidget";
import FormulaBlock from "./FormulaBlock";
import { compareValues, validateAnswer } from "./answerUtils";
const SuccessMessage = ({ children }) => (
  <div className="p-2 rounded bg-green-50 text-green-700 text-xs">{children}</div>
);

const ErrorMessage = ({ children }) => (
  <div className="p-2 rounded bg-red-50 text-red-700 text-xs">{children}</div>
);

const TextTest = ({ test, value, onChange }) => (
  <div className="space-y-2">
    <p className="text-xs text-gray-700">{test.question}</p>
    <textarea 
      value={value || ""} 
      onChange={e => onChange(e.target.value)} 
      className="w-full px-2 py-1.5 rounded border border-gray-300 text-xs"
      rows={3}
    />
  </div>
);

const SingleChoiceTest = ({ test, value, onChange, variables }) => {
  const text = variables ? test.question.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`) : test.question;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-700">{text}</p>
      <div className="space-y-1">
        {test.options?.map(opt => (
          <label key={opt.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${value === opt.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
            <input type="radio" checked={value === opt.id} onChange={() => onChange(opt.id)} className="w-3 h-3" />
            <span>{variables ? opt.answer_text.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`) : opt.answer_text}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const CalculatedInputTest = ({ test, value, onChange, variables, invalidIndexes = [] }) => {
  const extractLeftPart = (question) => {
    if (!question) return null;
    const match = question.match(/^([^=]+?)\s*=/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  };
  const placeholderMatches = test.question_with_blanks?.match(/___|\bph_?\{?\d+\}?/g) || [];
  const inputCount = test.expected_inputs?.length || test.placeholders_count || placeholderMatches.length || 0;

  const [vals, setVals] = useState(() => {
    return (value && Array.isArray(value)) ? value : new Array(inputCount).fill("");
  });

  useEffect(() => {
    if (value && Array.isArray(value)) {
      setVals(value);
    }
  }, [value]);

  const handleChange = useCallback((idx, val) => {
    setVals(prev => {
      const nv = [...prev];
      nv[idx] = val;
      onChange(nv);
      return nv;
    });
  }, [onChange]);

  if (!test.question_with_blanks || (!placeholderMatches.length && test.placeholders_count === 0)) {
    const question = variables ? test.question.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`) : test.question;
    const leftPart = extractLeftPart(question);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {leftPart && (
            <span className="text-sm font-mono font-semibold text-blue-600">
              {leftPart} =
            </span>
          )}
          <input 
            type="text" 
            value={value || ""} 
            onChange={e => onChange(e.target.value)} 
            className="flex-1 px-2 py-1.5 rounded border border-gray-300 text-xs" 
            placeholder="Введите значение..."
          />
        </div>
      </div>
    );
  }

  const leftPart = extractLeftPart(test.question);
  
  return (
    <div className="space-y-2">
      <div className="rounded border border-gray-200 p-2 bg-gray-50">
        <MathInputWidget
          template={test.question_with_blanks}
          values={vals}
          placeholders={test.input_labels || []}
          invalidIndexes={invalidIndexes}
          leftPart={leftPart}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
const CalculatedTest = ({ test, value, onChange, variables }) => {
  const text = variables ? (test.question_rendered || test.question).replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`) : (test.question_rendered || test.question);
  
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-700">{text}</p>
      <input 
        type="number" 
        step="any" 
        value={value === undefined || value === null ? "" : value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full px-2 py-1.5 rounded border border-gray-300 text-xs" 
        placeholder="Введите число..."
      />
    </div>
  );
};

const PolynomialTest = ({ test, value, onChange }) => (
  <div className="space-y-2">
    <p className="text-xs text-gray-700">{test.question}</p>
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded border border-gray-300 text-xs font-mono"
      placeholder="Например: 2*x^2 - 3*x + 1"
    />
    {test.sample_points?.length > 0 && (
      <p className="text-[11px] text-gray-500">
        Проверка идёт по значениям многочлена, поэтому эквивалентная запись тоже подойдёт.
      </p>
    )}
  </div>
);

function StepContent({ step, variables, answers, onAnswerChange, onTestsValidated }) {
  const answersRef = useRef(answers);
  const isNewtonBuildStep = step.tests?.some((test) => test.question?.includes('P2(x)'));

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const makeInitialAnswers = useCallback(() => {
    const init = {};
    const savedAnswers = answersRef.current || {};

    step.tests?.forEach(t => { 
      if (savedAnswers[t.id] !== undefined) {
        init[t.id] = savedAnswers[t.id];
      } else if (t.answer_format === 'array' || t.type === 'calculated_input') {
        init[t.id] = new Array(t.expected_inputs?.length || 0).fill("");
      } else if (t.type === 'polynomial' || t.answer_format === 'expression') {
        init[t.id] = "";
      } else if (t.type === 'calculated' || t.answer_format === 'number') {
        init[t.id] = "";
      }
    });
    return init;
  }, [step.tests]);
  const [localAnswers, setLocalAnswers] = useState({});
  const [validation, setValidation] = useState(null);

  const buildValidation = useCallback((answerSet) => {
    let all = true;
    const byId = {};
    const invalidIndexesById = {};

    for (const t of step.tests) {
      let expected = t.expected_answer;

      if (t.type === 'calculated_input' || t.answer_format === 'array') {
        expected = t.expected_inputs;
      }

      if (t.type === 'polynomial' || t.answer_format === 'expression') {
        expected = {
          expression: t.expected_answer,
          sample_points: t.sample_points || [],
        };
      }

      const userAnswer = answerSet[t.id];
      const isCorrect = validateAnswer(userAnswer, expected, t.type, t.answer_format);
      byId[t.id] = isCorrect;

      if (!isCorrect) {
        all = false;

        if ((t.type === 'calculated_input' || t.answer_format === 'array') && Array.isArray(expected)) {
          const answerArray = Array.isArray(userAnswer) ? userAnswer : [];
          invalidIndexesById[t.id] = expected
            .map((exp, i) => compareValues(answerArray[i] ?? "", exp) ? null : i)
            .filter((i) => i !== null);
        }
      }
    }

    return { all, byId, invalidIndexesById };
  }, [step.tests]);
  
  useEffect(() => { 
    const initial = makeInitialAnswers();
    setLocalAnswers(initial);

    const hasSavedAnswers = step.tests?.some((t) => {
      const value = initial[t.id];
      return Array.isArray(value) ? value.some((item) => String(item || '').trim() !== '') : String(value || '').trim() !== '';
    });

    if (hasSavedAnswers) {
      const nextValidation = buildValidation(initial);
      setValidation(nextValidation);
      onTestsValidated?.(nextValidation.all);
      return;
    }

    setValidation(null);
    onTestsValidated?.(false);
  }, [makeInitialAnswers, buildValidation, onTestsValidated, step.id, step.tests]);
  
  const handleChange = useCallback((id, val) => { 
    setLocalAnswers(prev => ({ ...prev, [id]: val }));
    setValidation(null);
    onTestsValidated?.(false);
    onAnswerChange?.(id, val); 
  }, [onAnswerChange, onTestsValidated]);
  
  const validateAll = useCallback(() => {
    const nextValidation = buildValidation(localAnswers);
    setValidation(nextValidation);
    onTestsValidated?.(nextValidation.all);
  }, [buildValidation, localAnswers, onTestsValidated]);
  
  const renderTest = (t) => {
    const props = {
      test: t,
      value: localAnswers[t.id],
      onChange: (v) => handleChange(t.id, v),
      variables,
      invalidIndexes: validation?.invalidIndexesById?.[t.id] || []
    };
    
    if (t.type === 'single_choice' || t.answer_format === 'single') {
      return <SingleChoiceTest {...props} />;
    }
    if (t.type === 'calculated_input' || t.answer_format === 'array') {
      return <CalculatedInputTest {...props} />;
    }
    if (t.type === 'calculated' || t.answer_format === 'number') {
      return <CalculatedTest {...props} />;
    }
    if (t.type === 'polynomial' || t.answer_format === 'expression') {
      return <PolynomialTest {...props} />;
    }
    return <TextTest {...props} />;
  };
  
  return (
    <div className="space-y-3">
      {step.description && <p className="text-xs text-gray-600">{step.description}</p>}
      {step.instructions && <p className="p-3 rounded-lg border-blue-500 bg-blue-50 text-xs text-gray-700">{step.instructions}</p>}
      
      {step.summary?.length > 0 && (
        <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-gray-700">
          <div className="mb-2 font-semibold text-blue-800">Уже найдено</div>
          <div className="space-y-2">
            {step.summary.map((item) => (
              <div key={item.label} className="rounded bg-white/70 p-2">
                {item.value && (
                  <div className="font-mono text-blue-900">{item.label} = {item.value}</div>
                )}
                {item.formula && !(isNewtonBuildStep && item.label === 'P2(x)') && (
                  <div className="mt-1 overflow-x-auto text-center">
                    <FormulaBlock math={item.formula} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {validation && (
        validation.all ? (
          <SuccessMessage>Все ответы верные. Можно переходить дальше.</SuccessMessage>
        ) : (
          <ErrorMessage>Есть ошибки. Проверьте вопросы, выделенные красным. Дробные ответы можно вводить до 2 знаков после точки без округления.</ErrorMessage>
        )
      )}
       
      {step.tests?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Вопросы ({step.tests.length})</h3>
          {step.tests.map((t, idx) => {
            const state = validation?.byId?.[t.id];
            return (
            <div key={t.id} className={`rounded border p-3 transition-colors ${
              state === false ? "border-red-300 bg-red-50/60" : state === true ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200"
            }`}>
              <div className="text-[10px] text-gray-400 mb-2">Вопрос {idx + 1}</div>
              {renderTest(t)}
            </div>
            );
          })}
        </div>
      )}
      
      <button 
        onClick={validateAll} 
        className="w-full py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors"
      >
        Проверить ответы
      </button>
    </div>
  );
}

export default StepContent;

