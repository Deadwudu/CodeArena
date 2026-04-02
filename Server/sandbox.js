/**
 * Проверка решений в изолированном QuickJS (WASM): нет доступа к Node, FS, process.
 * Лимиты: память и время на один запуск /api/run.
 */
const { getQuickJS, shouldInterruptAfterDeadline } = require("quickjs-emscripten")

const SANDBOX_TIME_MS = 3000
const SANDBOX_MEMORY_BYTES = 8 * 1024 * 1024
const SANDBOX_STACK_BYTES = 256 * 1024
const MAX_CODE_LENGTH = 120_000

const EXPORT_NAME_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

function deepEqual(a, b) {
    if (a === b) return true
    if (Number.isNaN(a) && Number.isNaN(b)) return true
    if (a === null || b === null) return a === b
    if (typeof a !== typeof b) return false
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
        return true
    }
    return false
}

function quickJSErrorToMessage(dumped) {
    if (dumped == null) return "Ошибка в песочнице"
    if (typeof dumped === "string") return dumped
    if (typeof dumped === "object" && dumped !== null) {
        const name = dumped.name
        const msg = dumped.message
        if (name === "InternalError" && msg === "interrupted") {
            return "Превышено время выполнения в песочнице"
        }
        if (msg) return String(msg)
        if (name) return String(name)
    }
    return String(dumped)
}

/**
 * @param {string} code
 * @param {object} validation — { version: 1, export, cases }
 * @Promise {boolean} true если все кейсы прошли
 */
async function evaluateAgainstValidation(code, validation) {
    if (!validation || validation.version !== 1) {
        throw new Error("Некорректный validation: нужен объект { version: 1, export, cases }")
    }
    const exportName = validation.export
    if (!exportName || typeof exportName !== "string" || !EXPORT_NAME_RE.test(exportName)) {
        throw new Error("validation.export — допустимое имя функции (идентификатор JS)")
    }
    const cases = validation.cases
    if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error("validation.cases — непустой массив { args?, expect }")
    }
    if (code.length > MAX_CODE_LENGTH) {
        throw new Error("Код слишком длинный для проверки")
    }

    const QuickJS = await getQuickJS()
    const runtime = QuickJS.newRuntime({
        memoryLimitBytes: SANDBOX_MEMORY_BYTES,
        maxStackSizeBytes: SANDBOX_STACK_BYTES,
    })
    const deadline = Date.now() + SANDBOX_TIME_MS
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
    const context = runtime.newContext()

    try {
        const load = context.evalCode(code, "submission.js", { type: "global", strict: true })
        if (load.error) {
            const dumped = context.dump(load.error)
            load.error.dispose()
            throw new Error(quickJSErrorToMessage(dumped))
        }
        if (load.value) load.value.dispose()

        const typeProbe = context.evalCode(`typeof ${exportName}`, "typeof.js", {
            type: "global",
            strict: true,
        })
        if (typeProbe.error) {
            const dumped = context.dump(typeProbe.error)
            typeProbe.error.dispose()
            throw new Error(quickJSErrorToMessage(dumped))
        }
        const t = context.dump(typeProbe.value)
        typeProbe.value.dispose()
        if (t !== "function") {
            throw new Error("Ожидалась функция: " + exportName)
        }

        for (const c of cases) {
            if (!Object.prototype.hasOwnProperty.call(c, "expect")) {
                throw new Error("Каждый case должен содержать expect")
            }
            const args = Array.isArray(c.args) ? c.args : []
            let callExpr
            try {
                callExpr = `(${exportName})(...${JSON.stringify(args)})`
            } catch {
                throw new Error("Некорректные args в кейсе validation")
            }
            const cr = context.evalCode(callExpr, "case.js", { type: "global", strict: true })
            if (cr.error) {
                const dumped = context.dump(cr.error)
                cr.error.dispose()
                throw new Error(quickJSErrorToMessage(dumped))
            }
            const got = context.dump(cr.value)
            cr.value.dispose()
            if (!deepEqual(got, c.expect)) return false
        }
        return true
    } finally {
        context.dispose()
        runtime.dispose()
    }
}

/**
 * Прогон эталонного кода на наборах args и получение expect для каждого кейса.
 * @param {string} code
 * @param {string} exportName
 * @param {Array<{ args?: unknown[] }>} cases — достаточно args (массив аргументов функции)
 * @returns {Promise<Array<{ args: unknown[], expect: unknown }>>}
 */
async function computeExpectsFromReference(code, exportName, cases) {
    if (!exportName || typeof exportName !== "string" || !EXPORT_NAME_RE.test(exportName)) {
        throw new Error("Имя функции (export): допустимый идентификатор JS")
    }
    if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error("Нужен хотя бы один тест-кейс с полем args (JSON-массив аргументов)")
    }
    if (code.length > MAX_CODE_LENGTH) {
        throw new Error("Код слишком длинный для проверки")
    }

    const QuickJS = await getQuickJS()
    const runtime = QuickJS.newRuntime({
        memoryLimitBytes: SANDBOX_MEMORY_BYTES,
        maxStackSizeBytes: SANDBOX_STACK_BYTES,
    })
    const deadline = Date.now() + SANDBOX_TIME_MS
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
    const context = runtime.newContext()

    try {
        const load = context.evalCode(code, "reference.js", { type: "global", strict: true })
        if (load.error) {
            const dumped = context.dump(load.error)
            load.error.dispose()
            throw new Error(quickJSErrorToMessage(dumped))
        }
        if (load.value) load.value.dispose()

        const typeProbe = context.evalCode(`typeof ${exportName}`, "typeof.js", {
            type: "global",
            strict: true,
        })
        if (typeProbe.error) {
            const dumped = context.dump(typeProbe.error)
            typeProbe.error.dispose()
            throw new Error(quickJSErrorToMessage(dumped))
        }
        const t = context.dump(typeProbe.value)
        typeProbe.value.dispose()
        if (t !== "function") {
            throw new Error("В эталоне должна быть функция: " + exportName)
        }

        const out = []
        for (const c of cases) {
            const args = Array.isArray(c.args) ? c.args : []
            let callExpr
            try {
                callExpr = `(${exportName})(...${JSON.stringify(args)})`
            } catch {
                throw new Error("Некорректные args в кейсе")
            }
            const cr = context.evalCode(callExpr, "case.js", { type: "global", strict: true })
            if (cr.error) {
                const dumped = context.dump(cr.error)
                cr.error.dispose()
                throw new Error(quickJSErrorToMessage(dumped))
            }
            const got = context.dump(cr.value)
            cr.value.dispose()
            out.push({ args, expect: got })
        }
        return out
    } finally {
        context.dispose()
        runtime.dispose()
    }
}

module.exports = { evaluateAgainstValidation, computeExpectsFromReference }
