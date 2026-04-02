const express = require("express")
const cors = require("cors")
const path = require("path")
const { supabase } = require("./supabase")
const { evaluateAgainstValidation, computeExpectsFromReference } = require("./sandbox")

const app = express()

const clientDistPath = path.join(__dirname, "../ClientApp/dist")
const legacyClientPath = path.join(__dirname, "../client")

app.use(cors())
app.use(express.json())

function mapTask(row) {
    return {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty_code,
        description: row.description,
        category: row.categories?.name ?? null,
    }
}

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 }

function sortTasksByDifficultyThenTitle(tasks) {
    return [...tasks].sort((a, b) => {
        const da = DIFFICULTY_ORDER[a.difficulty] ?? 99
        const db = DIFFICULTY_ORDER[b.difficulty] ?? 99
        if (da !== db) return da - db
        return String(a.title).localeCompare(String(b.title), "ru")
    })
}

function mapAttempt(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        code: row.source_code,
        result: row.status_code,
        createdAt: row.created_at,
        userId: row.user_id,
    }
}

/** Для статистики: на каждую пару (пользователь|гость, задача) — только последняя по времени попытка. */
function lastAttemptsPerUserTask(attempts) {
    const best = new Map()
    for (const a of attempts ?? []) {
        const uid = a.user_id ?? "__guest__"
        const key = `${uid}::${a.task_id}`
        const t = new Date(a.created_at).getTime()
        const prev = best.get(key)
        if (!prev || t > new Date(prev.created_at).getTime()) best.set(key, a)
    }
    return [...best.values()]
}

/** Турниры со сроком ends_at переводятся в finished (для таймера без отдельного cron). */
async function expireLiveTournaments() {
    const now = new Date().toISOString()
    const { data: expiring, error: selErr } = await supabase
        .from("tournaments")
        .select("id, name")
        .eq("status", "live")
        .not("ends_at", "is", null)
        .lte("ends_at", now)
    if (selErr) {
        console.error("expireLiveTournaments select:", selErr.message)
        return
    }
    if (!expiring?.length) return
    const ids = expiring.map((t) => t.id)
    const { error } = await supabase
        .from("tournaments")
        .update({ status: "finished", finished_at: now })
        .in("id", ids)
    if (error) {
        console.error("expireLiveTournaments:", error.message)
        return
    }
    for (const t of expiring) {
        await notifyTournamentParticipants(t.id, {
            title: `«${t.name}»: турнир завершён`,
            body: "Время турнира истекло. Спасибо за участие!",
            link_kind: "tournament",
            link_id: String(t.id),
        })
    }
}

async function getUserById(userId) {
    const { data: user, error } = await supabase.from("users").select("id, username, role_id").eq("id", userId).maybeSingle()
    if (error) throw error
    if (!user) return null
    const { data: role } = await supabase.from("app_roles").select("code").eq("id", user.role_id).maybeSingle()
    return { ...user, app_roles: role ? { code: role.code } : null }
}

async function ensureAdmin(userId) {
    const user = await getUserById(userId)
    if (!user || user.app_roles?.code !== "admin") return false
    return true
}

/** @param {string[]} userIds */
async function insertNotificationsForUsers(userIds, notification) {
    const unique = [...new Set(userIds.filter(Boolean))]
    if (!unique.length) return
    const title = String(notification.title ?? "").trim().slice(0, 500) || "Уведомление"
    const body = notification.body != null ? String(notification.body).trim().slice(0, 2000) : null
    const link_kind = notification.link_kind != null ? String(notification.link_kind).trim().slice(0, 64) : null
    const link_id = notification.link_id != null ? String(notification.link_id).trim().slice(0, 128) : null
    const rows = unique.map((user_id) => ({
        user_id,
        title,
        body,
        link_kind,
        link_id,
    }))
    const chunkSize = 300
    for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase.from("user_notifications").insert(rows.slice(i, i + chunkSize))
        if (error) console.error("user_notifications insert:", error.message)
    }
}

async function notifyTournamentParticipants(tournamentId, notification) {
    const { data, error } = await supabase
        .from("tournament_participants")
        .select("user_id")
        .eq("tournament_id", tournamentId)
    if (error) {
        console.error("notifyTournamentParticipants:", error.message)
        return
    }
    const ids = [...new Set((data ?? []).map((p) => p.user_id).filter(Boolean))]
    await insertNotificationsForUsers(ids, notification)
}

async function seedCoreData() {
    const rolesSeed = await supabase.from("app_roles").upsert(
        [
            { code: "admin", name: "Administrator" },
            { code: "user", name: "User" },
        ],
        { onConflict: "code" },
    )
    if (rolesSeed.error) throw rolesSeed.error

    const difficultiesSeed = await supabase.from("difficulties").upsert(
        [
            { code: "easy", name: "Easy" },
            { code: "medium", name: "Medium" },
            { code: "hard", name: "Hard" },
        ],
        { onConflict: "code" },
    )
    if (difficultiesSeed.error) throw difficultiesSeed.error

    const categorySeed = await supabase.from("categories").upsert({ name: "base" }, { onConflict: "name" })
    if (categorySeed.error) throw categorySeed.error

    const { data: adminRole, error: adminRoleError } = await supabase
        .from("app_roles")
        .select("id")
        .eq("code", "admin")
        .maybeSingle()
    if (adminRoleError) throw adminRoleError
    if (!adminRole?.id) throw new Error("app_roles admin missing (run SQL seed or POST /api/db/bootstrap)")

    const { data: userRole, error: userRoleError } = await supabase
        .from("app_roles")
        .select("id")
        .eq("code", "user")
        .maybeSingle()
    if (userRoleError) throw userRoleError
    if (!userRole?.id) throw new Error("app_roles user missing (run SQL seed or POST /api/db/bootstrap)")

    const adminSeed = await supabase.from("users").upsert(
        { username: "admin", password: "123", role_id: adminRole.id },
        { onConflict: "username" },
    )
    if (adminSeed.error) throw adminSeed.error

    return { userRoleId: userRole.id }
}

app.get("/api/supabase/health", async (req, res) => {
    try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
            res.status(500).json({ ok: false, error: error.message })
            return
        }
        res.json({ ok: true, session: data?.session ? "present" : "none" })
    } catch (e) {
        res.status(500).json({ ok: false, error: e?.toString?.() ?? String(e) })
    }
})

app.post("/api/db/bootstrap", async (req, res) => {
    try {
        const seed = await seedCoreData()
        res.json({ success: true, seed })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) })
    }
})

app.get("/api/tasks", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("tasks")
            .select("id, title, description, difficulty_code, categories(name)")
        if (error) throw error
        res.json(sortTasksByDifficultyThenTitle((data ?? []).map(mapTask)))
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/tasks/:id", async (req, res) => {
    try {
        const id = req.params.id
        const { data, error } = await supabase
            .from("tasks")
            .select("id, title, description, difficulty_code, categories(name)")
            .eq("id", id)
            .maybeSingle()
        if (error) throw error
        if (!data) {
            res.status(404).json({ error: "not found" })
            return
        }
        res.json(mapTask(data))
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/tasks", async (req, res) => {
    try {
        const { userId } = req.body
        const allowed = await ensureAdmin(userId)
        if (!allowed) {
            res.status(403).json({ error: "no access" })
            return
        }

        const { title, difficulty, description } = req.body
        if (!title || !description || !difficulty) {
            res.status(400).json({ error: "title, difficulty, description обязательны" })
            return
        }

        const { data: cat, error: catErr } = await supabase.from("categories").select("id").eq("name", "base").maybeSingle()
        if (catErr) throw catErr
        if (!cat?.id) {
            res.status(500).json({ error: "Категория base не найдена — выполните supabase-schema.sql" })
            return
        }

        let validation = req.body.validation
        if (typeof validation === "string") {
            try {
                validation = JSON.parse(validation)
            } catch {
                res.status(400).json({ error: "validation: невалидный JSON" })
                return
            }
        }

        const id = String(req.body.id ?? Date.now())
        const { error } = await supabase.from("tasks").insert({
            id,
            title,
            description,
            difficulty_code: difficulty,
            category_id: cat.id,
            created_by: userId ?? null,
            validation: validation ?? null,
        })
        if (error) throw error
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const { userId } = req.body
        const allowed = await ensureAdmin(userId)
        if (!allowed) {
            res.status(403).json({ error: "no access" })
            return
        }
        const { error } = await supabase.from("tasks").delete().eq("id", req.params.id)
        if (error) throw error
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/run", async (req, res) => {
    const { userId } = req.body
    const code = String(req.body.code ?? "").replace(/^\uFEFF/, "").trimEnd()
    const taskId = String(req.body.taskId ?? "").trim()
    try {
        const { data: task, error: taskErr } = await supabase
            .from("tasks")
            .select("id, validation")
            .eq("id", taskId)
            .maybeSingle()
        if (taskErr) throw taskErr
        if (!task) {
            res.status(404).json({ result: "FAIL", error: "Задача не найдена в БД" })
            return
        }
        if (!task.validation) {
            res.status(400).json({
                result: "FAIL",
                error: "У задачи нет validation в БД (добавьте JSON в колонку validation)",
            })
            return
        }

        let result
        try {
            result = (await evaluateAgainstValidation(code, task.validation)) ? "PASS" : "FAIL"
        } catch (evalErr) {
            await supabase.from("attempts").insert({
                task_id: taskId,
                user_id: userId ?? null,
                source_code: code,
                status_code: "ERROR",
            })
            res.json({ result: "ERROR", error: evalErr instanceof Error ? evalErr.message : String(evalErr) })
            return
        }

        const payload = {
            task_id: taskId,
            user_id: userId ?? null,
            source_code: code,
            status_code: result,
        }
        await supabase.from("attempts").insert(payload)
        res.json({ result })
    } catch (e) {
        await supabase.from("attempts").insert({
            task_id: taskId,
            user_id: userId ?? null,
            source_code: code,
            status_code: "ERROR",
        })
        res.json({ result: "ERROR", error: e.toString() })
    }
})

app.get("/api/attempts", async (req, res) => {
    try {
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        let q = supabase
            .from("attempts")
            .select("id, task_id, user_id, source_code, status_code, created_at")
            .order("created_at", { ascending: false })
        if (userId) q = q.eq("user_id", userId)
        const { data, error } = await q
        if (error) throw error
        res.json((data ?? []).map(mapAttempt))
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/attempts/:taskId", async (req, res) => {
    try {
        const taskId = req.params.taskId
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        let q = supabase
            .from("attempts")
            .select("id, task_id, user_id, source_code, status_code, created_at")
            .eq("task_id", taskId)
            .order("created_at", { ascending: false })
        if (userId) q = q.eq("user_id", userId)
        const { data, error } = await q
        if (error) throw error
        res.json((data ?? []).map(mapAttempt))
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

/** Статистика пользователя по всем задачам каталога: успех / провал / нерешённые; по задаче учитывается только последняя попытка. */
app.get("/api/user/stats", async (req, res) => {
    try {
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }

        const { data: taskRows, error: taskErr } = await supabase.from("tasks").select("id")
        if (taskErr) throw taskErr
        const taskIds = (taskRows ?? []).map((t) => t.id)
        const totalTasks = taskIds.length

        const { data: attempts, error } = await supabase
            .from("attempts")
            .select("task_id, status_code, created_at")
            .eq("user_id", userId)
        if (error) throw error

        const all = attempts ?? []
        const totalSubmissions = all.length

        const byTask = new Map()
        for (const a of all) {
            const t = new Date(a.created_at).getTime()
            const prev = byTask.get(a.task_id)
            if (!prev || t > new Date(prev.created_at).getTime()) byTask.set(a.task_id, a)
        }

        let pass = 0
        let failed = 0
        let unsolved = 0
        for (const taskId of taskIds) {
            const last = byTask.get(taskId)
            if (!last) unsolved++
            else if (last.status_code === "PASS") pass++
            else failed++
        }

        res.json({
            pass,
            failed,
            unsolved,
            totalTasks,
            totalSubmissions,
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/admin/users-stats", async (req, res) => {
    try {
        const adminId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }

        const { data: users, error: uErr } = await supabase
            .from("users")
            .select("id, username, created_at, role_id")
            .order("username", { ascending: true })
        if (uErr) throw uErr

        const { data: roles, error: rErr } = await supabase.from("app_roles").select("id, code")
        if (rErr) throw rErr
        const roleById = new Map((roles ?? []).map((r) => [r.id, r.code]))

        const { data: attempts, error: aErr } = await supabase
            .from("attempts")
            .select("user_id, status_code, task_id, created_at")
        if (aErr) throw aErr

        /** Всего отправок (все попытки), по пользователю */
        /** @type {Map<string, number>} */
        const totalSubmissionsByUser = new Map()
        for (const a of attempts ?? []) {
            const key = a.user_id ?? "__guest__"
            totalSubmissionsByUser.set(key, (totalSubmissionsByUser.get(key) ?? 0) + 1)
        }

        const lastOnly = lastAttemptsPerUserTask(attempts ?? [])

        /** @type {Map<string, { pass: number; fail: number; error: number; tasks: Set<string> }>} */
        const statsByUser = new Map()
        for (const a of lastOnly) {
            const key = a.user_id ?? "__guest__"
            if (!statsByUser.has(key)) {
                statsByUser.set(key, { pass: 0, fail: 0, error: 0, tasks: new Set() })
            }
            const s = statsByUser.get(key)
            if (a.status_code === "PASS") s.pass++
            else if (a.status_code === "FAIL") s.fail++
            else if (a.status_code === "ERROR") s.error++
            s.tasks.add(a.task_id)
        }

        const pack = (userKey, s) => ({
            attemptCount: totalSubmissionsByUser.get(userKey) ?? 0,
            passCount: s.pass,
            failCount: s.fail,
            errorCount: s.error,
            distinctTaskCount: s.tasks.size,
        })

        const rows = (users ?? []).map((u) => {
            const s = statsByUser.get(u.id) ?? { pass: 0, fail: 0, error: 0, tasks: new Set() }
            return {
                id: u.id,
                username: u.username,
                role: roleById.get(u.role_id) ?? "user",
                createdAt: u.created_at,
                ...pack(u.id, s),
            }
        })

        const guest = statsByUser.get("__guest__")
        const out = guest
            ? [
                  ...rows,
                  {
                      id: null,
                      username: "(без аккаунта)",
                      role: "guest",
                      createdAt: null,
                      ...pack("__guest__", guest),
                  },
              ]
            : rows

        res.json({ users: out })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/admin/user-attempts", async (req, res) => {
    try {
        const adminId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const forUserId = req.query.forUserId !== undefined ? String(req.query.forUserId).trim() : ""
        if (!forUserId) {
            res.status(400).json({ error: "forUserId required (uuid с пользователя или __guest__)" })
            return
        }

        let q = supabase
            .from("attempts")
            .select("id, task_id, user_id, source_code, status_code, created_at")
            .order("created_at", { ascending: false })

        if (forUserId === "__guest__") q = q.is("user_id", null)
        else q = q.eq("user_id", forUserId)

        const { data, error } = await q
        if (error) throw error
        res.json((data ?? []).map(mapAttempt))
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/admin/tasks/:taskId/attempts", async (req, res) => {
    try {
        const adminId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const taskId = req.params.taskId
        const { data: attempts, error } = await supabase
            .from("attempts")
            .select("id, task_id, user_id, source_code, status_code, created_at")
            .eq("task_id", taskId)
            .order("created_at", { ascending: false })
        if (error) throw error

        const userIds = [...new Set((attempts ?? []).map((a) => a.user_id).filter(Boolean))]
        /** @type {Map<string, string>} */
        const userMap = new Map()
        if (userIds.length) {
            const { data: userRows, error: uErr } = await supabase.from("users").select("id, username").in("id", userIds)
            if (uErr) throw uErr
            for (const u of userRows ?? []) userMap.set(u.id, u.username)
        }

        res.json(
            (attempts ?? []).map((a) => ({
                ...mapAttempt(a),
                username: a.user_id ? userMap.get(a.user_id) ?? "—" : "(гость)",
            })),
        )
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/admin/fill-expect-from-reference", async (req, res) => {
    try {
        const { userId } = req.body
        if (!(await ensureAdmin(userId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const referenceCode = String(req.body.referenceCode ?? "").replace(/^\uFEFF/, "").trimEnd()
        const exportName = String(req.body.export ?? req.body.exportName ?? "").trim()
        let cases = req.body.cases
        if (typeof cases === "string") {
            try {
                cases = JSON.parse(cases)
            } catch {
                res.status(400).json({ error: "cases: невалидный JSON" })
                return
            }
        }
        if (!Array.isArray(cases)) {
            res.status(400).json({ error: "cases — массив объектов { args: [...] }" })
            return
        }

        const normalized = cases.map((c, i) => {
            if (!c || typeof c !== "object") throw new Error(`Кейс ${i + 1}: ожидался объект`)
            if (!Object.prototype.hasOwnProperty.call(c, "args")) throw new Error(`Кейс ${i + 1}: нужно поле args (массив аргументов)`)
            if (!Array.isArray(c.args)) throw new Error(`Кейс ${i + 1}: args должен быть массивом`)
            return { args: c.args }
        })

        const filled = await computeExpectsFromReference(referenceCode, exportName, normalized)
        res.json({ cases: filled })
    } catch (e) {
        res.status(400).json({ error: e?.message ?? String(e) })
    }
})

app.patch("/api/admin/attempts/:attemptId", async (req, res) => {
    try {
        const adminId = req.body.userId ? String(req.body.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const status = String(req.body.status ?? "").toUpperCase()
        if (status !== "PASS" && status !== "FAIL") {
            res.status(400).json({ error: "status должен быть PASS или FAIL" })
            return
        }
        const attemptId = Number.parseInt(String(req.params.attemptId), 10)
        if (!Number.isFinite(attemptId)) {
            res.status(400).json({ error: "некорректный id попытки" })
            return
        }

        const { data: row, error: findErr } = await supabase
            .from("attempts")
            .select("id")
            .eq("id", attemptId)
            .maybeSingle()
        if (findErr) throw findErr
        if (!row) {
            res.status(404).json({ error: "попытка не найдена" })
            return
        }

        const { error } = await supabase.from("attempts").update({ status_code: status }).eq("id", attemptId)
        if (error) throw error
        res.json({ success: true, status })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

// --- Турниры (ручная проверка, задачи задаёт админ) ---

async function getOrderedTournamentTasks(tournamentId) {
    const { data, error } = await supabase
        .from("tournament_tasks")
        .select("id, title, description, sort_order")
        .eq("tournament_id", tournamentId)
        .order("sort_order", { ascending: true })
    if (error) throw error
    return data ?? []
}

app.post("/api/admin/tournaments", async (req, res) => {
    try {
        const { userId } = req.body
        if (!(await ensureAdmin(userId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const name = String(req.body.name ?? "").trim()
        let tasksIn = req.body.tasks
        if (!name) {
            res.status(400).json({ error: "Название турнира обязательно" })
            return
        }
        if (typeof tasksIn === "string") {
            try {
                tasksIn = JSON.parse(tasksIn)
            } catch {
                res.status(400).json({ error: "tasks: невалидный JSON" })
                return
            }
        }
        if (!Array.isArray(tasksIn) || tasksIn.length === 0) {
            res.status(400).json({ error: "Добавьте хотя бы одну задачу (title, description)" })
            return
        }
        for (let i = 0; i < tasksIn.length; i++) {
            const t = tasksIn[i]
            if (!t || typeof t !== "object" || !String(t.title ?? "").trim() || !String(t.description ?? "").trim()) {
                res.status(400).json({ error: `Задача ${i + 1}: нужны title и description` })
                return
            }
        }

        const { data: tour, error: tErr } = await supabase
            .from("tournaments")
            .insert({
                name,
                status: "pending",
                created_by: userId,
            })
            .select("id, name, status, created_by, started_at, finished_at, created_at")
            .maybeSingle()
        if (tErr) throw tErr

        const taskRows = tasksIn.map((t, i) => ({
            tournament_id: tour.id,
            sort_order: i,
            title: String(t.title).trim(),
            description: String(t.description).trim(),
        }))
        const { error: insErr } = await supabase.from("tournament_tasks").insert(taskRows)
        if (insErr) throw insErr

        const { data: allUsers, error: nuErr } = await supabase.from("users").select("id")
        if (nuErr) console.error("users list for notifications:", nuErr.message)
        else if (allUsers?.length)
            await insertNotificationsForUsers(
                allUsers.map((u) => u.id),
                {
                    title: "Новый турнир",
                    body: `Администратор организовал турнир «${tour.name}». Загляните в раздел «Турниры», чтобы присоединиться.`,
                    link_kind: "tournament",
                    link_id: String(tour.id),
                },
            )

        res.json({ success: true, tournament: tour })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/admin/tournaments/:id/go-live", async (req, res) => {
    try {
        const { userId } = req.body
        if (!(await ensureAdmin(userId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const id = req.params.id
        const { data: tour, error: fErr } = await supabase.from("tournaments").select("id, status, name").eq("id", id).maybeSingle()
        if (fErr) throw fErr
        if (!tour) {
            res.status(404).json({ error: "турнир не найден" })
            return
        }
        if (tour.status !== "pending") {
            res.status(400).json({ error: "Турнир уже запущен или завершён" })
            return
        }
        let endsAt = null
        const dm = req.body.durationMinutes
        if (dm != null && dm !== "") {
            const n = Number(dm)
            if (Number.isFinite(n) && n > 0) {
                const cap = 10080
                const mins = Math.min(Math.floor(n), cap)
                endsAt = new Date(Date.now() + mins * 60 * 1000).toISOString()
            }
        }
        const { error } = await supabase
            .from("tournaments")
            .update({ status: "live", started_at: new Date().toISOString(), ends_at: endsAt })
            .eq("id", id)
        if (error) throw error
        const endHint = endsAt ? ` Окончание: ${new Date(endsAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК).` : ""
        await notifyTournamentParticipants(id, {
            title: `«${tour.name}»: турнир начался`,
            body: `Можно переходить к задачам турнира.${endHint}`,
            link_kind: "tournament",
            link_id: String(id),
        })
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/admin/tournaments/:id/finish", async (req, res) => {
    try {
        const { userId } = req.body
        if (!(await ensureAdmin(userId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const id = req.params.id
        const { data: tourInfo, error: infoErr } = await supabase
            .from("tournaments")
            .select("id, name, status")
            .eq("id", id)
            .maybeSingle()
        if (infoErr) throw infoErr
        if (!tourInfo) {
            res.status(404).json({ error: "турнир не найден" })
            return
        }
        if (tourInfo.status === "finished") {
            res.status(400).json({ error: "Турнир уже завершён" })
            return
        }
        const { error } = await supabase
            .from("tournaments")
            .update({ status: "finished", finished_at: new Date().toISOString() })
            .eq("id", id)
            .in("status", ["pending", "live"])
        if (error) throw error
        await notifyTournamentParticipants(id, {
            title: `«${tourInfo.name}»: турнир завершён`,
            body: "Турнир завершён администратором. Спасибо за участие!",
            link_kind: "tournament",
            link_id: String(id),
        })
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/tournaments", async (req, res) => {
    try {
        await expireLiveTournaments()
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        const { data, error } = await supabase
            .from("tournaments")
            .select("id, name, status, started_at, finished_at, ends_at, created_at")
            .order("created_at", { ascending: false })
        if (error) throw error
        const rows = data ?? []
        const ids = rows.map((r) => r.id)
        let taskCounts = new Map()
        if (ids.length) {
            const { data: tc } = await supabase.from("tournament_tasks").select("tournament_id").in("tournament_id", ids)
            for (const t of tc ?? []) {
                taskCounts.set(t.tournament_id, (taskCounts.get(t.tournament_id) ?? 0) + 1)
            }
        }
        const joinedSet = new Set()
        if (userId && ids.length) {
            const { data: parts, error: pErr } = await supabase
                .from("tournament_participants")
                .select("tournament_id")
                .eq("user_id", userId)
                .in("tournament_id", ids)
            if (pErr) throw pErr
            for (const p of parts ?? []) joinedSet.add(p.tournament_id)
        }
        res.json(
            rows.map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
                startedAt: r.started_at,
                finishedAt: r.finished_at,
                endsAt: r.ends_at,
                createdAt: r.created_at,
                taskCount: taskCounts.get(r.id) ?? 0,
                joined: userId ? joinedSet.has(r.id) : false,
            })),
        )
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

/** Таблица результатов: только для status === finished. Места 1…n по числу PASS, при равенстве — раньше завершивший турнир (completed_at), иначе раньше последняя отправка. */
app.get("/api/tournaments/:id/leaderboard", async (req, res) => {
    try {
        await expireLiveTournaments()
        const tournamentId = req.params.id
        const { data: tour, error: tErr } = await supabase.from("tournaments").select("id, name, status").eq("id", tournamentId).maybeSingle()
        if (tErr) throw tErr
        if (!tour) {
            res.status(404).json({ error: "не найден" })
            return
        }
        if (tour.status !== "finished") {
            res.status(403).json({ error: "Таблица результатов доступна после завершения турнира" })
            return
        }

        const ordered = await getOrderedTournamentTasks(tournamentId)
        const taskCount = ordered.length

        const { data: parts, error: pErr } = await supabase
            .from("tournament_participants")
            .select("user_id, joined_at, completed_at")
            .eq("tournament_id", tournamentId)
        if (pErr) throw pErr

        const { data: subs, error: sErr } = await supabase
            .from("tournament_submissions")
            .select("user_id, review_status, submitted_at")
            .eq("tournament_id", tournamentId)
        if (sErr) throw sErr

        const userIds = [...new Set((parts ?? []).map((p) => p.user_id))]
        const userMap = new Map()
        if (userIds.length) {
            const { data: users } = await supabase.from("users").select("id, username").in("id", userIds)
            for (const u of users ?? []) userMap.set(u.id, u.username)
        }

        const byUser = new Map()
        for (const p of parts ?? []) {
            byUser.set(p.user_id, {
                completedAt: p.completed_at ? new Date(p.completed_at).getTime() : null,
                joinedAt: p.joined_at ? new Date(p.joined_at).getTime() : 0,
            })
        }

        const passCount = new Map()
        const maxSubmitted = new Map()
        for (const s of subs ?? []) {
            const uid = s.user_id
            if (s.review_status === "PASS") {
                passCount.set(uid, (passCount.get(uid) ?? 0) + 1)
            }
            const t = new Date(s.submitted_at).getTime()
            maxSubmitted.set(uid, Math.max(maxSubmitted.get(uid) ?? 0, t))
        }

        const rows = userIds.map((userId) => ({
            userId,
            username: userMap.get(userId) ?? "—",
            passCount: passCount.get(userId) ?? 0,
            completedAt: byUser.get(userId)?.completedAt ?? null,
            maxSubmitted: maxSubmitted.get(userId) ?? null,
            joinedAt: byUser.get(userId)?.joinedAt ?? 0,
        }))

        rows.sort((a, b) => {
            if (b.passCount !== a.passCount) return b.passCount - a.passCount
            const ca = a.completedAt ?? Number.MAX_SAFE_INTEGER
            const cb = b.completedAt ?? Number.MAX_SAFE_INTEGER
            if (ca !== cb) return ca - cb
            const ma = a.maxSubmitted ?? Number.MAX_SAFE_INTEGER
            const mb = b.maxSubmitted ?? Number.MAX_SAFE_INTEGER
            if (ma !== mb) return ma - mb
            return String(a.userId).localeCompare(String(b.userId))
        })

        res.json({
            tournamentId: tour.id,
            tournamentName: tour.name,
            taskCount,
            rows: rows.map((r, i) => ({
                rank: i + 1,
                userId: r.userId,
                username: r.username,
                passCount: r.passCount,
                taskCount,
            })),
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/tournaments/:id", async (req, res) => {
    try {
        await expireLiveTournaments()
        const id = req.params.id
        const adminId = req.query.adminUserId ? String(req.query.adminUserId).trim() : ""
        const isAdmin = adminId ? await ensureAdmin(adminId) : false

        const { data: tour, error: tErr } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle()
        if (tErr) throw tErr
        if (!tour) {
            res.status(404).json({ error: "не найден" })
            return
        }

        const tasks = await getOrderedTournamentTasks(id)
        const hideBodies = tour.status === "pending" && !isAdmin
        res.json({
            id: tour.id,
            name: tour.name,
            status: tour.status,
            startedAt: tour.started_at,
            finishedAt: tour.finished_at,
            endsAt: tour.ends_at,
            createdAt: tour.created_at,
            taskCount: tasks.length,
            tasks: hideBodies
                ? []
                : tasks.map((t) => ({
                      id: t.id,
                      sortOrder: t.sort_order,
                      title: t.title,
                      description: t.description,
                  })),
            tasksHiddenUntilLive: hideBodies,
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/tournaments/:id/join", async (req, res) => {
    try {
        const tournamentId = req.params.id
        const userId = req.body.userId ? String(req.body.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }

        const { data: tour, error: tErr } = await supabase.from("tournaments").select("id, status").eq("id", tournamentId).maybeSingle()
        if (tErr) throw tErr
        if (!tour) {
            res.status(404).json({ error: "турнир не найден" })
            return
        }
        if (tour.status === "finished") {
            res.status(400).json({ error: "Турнир завершён" })
            return
        }

        const { data: existing } = await supabase
            .from("tournament_participants")
            .select("id")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .maybeSingle()
        if (!existing) {
            const { error } = await supabase.from("tournament_participants").insert({
                tournament_id: tournamentId,
                user_id: userId,
            })
            if (error) throw error
        }
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/tournaments/:id/play", async (req, res) => {
    try {
        await expireLiveTournaments()
        const tournamentId = req.params.id
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }

        const { data: tour, error: tErr } = await supabase
            .from("tournaments")
            .select("id, status, name, ends_at")
            .eq("id", tournamentId)
            .maybeSingle()
        if (tErr) throw tErr
        if (!tour) {
            res.status(404).json({ error: "турнир не найден" })
            return
        }

        const { data: part, error: pErr } = await supabase
            .from("tournament_participants")
            .select("id, current_task_index, completed_at")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .maybeSingle()
        if (pErr) throw pErr
        if (!part) {
            res.status(403).json({ error: "Сначала присоединитесь к турниру" })
            return
        }

        const endsAt = tour.ends_at ?? null

        if (part.completed_at) {
            res.json({ phase: "done", tournamentName: tour.name, completedAt: part.completed_at, endsAt })
            return
        }

        if (tour.status === "pending") {
            res.json({ phase: "waiting", tournamentName: tour.name, message: "Ожидание старта турнира администратором", endsAt })
            return
        }

        if (tour.status === "finished") {
            res.json({ phase: "finished", tournamentName: tour.name, message: "Турнир завершён", endsAt })
            return
        }

        const ordered = await getOrderedTournamentTasks(tournamentId)
        const idx = part.current_task_index
        if (idx >= ordered.length) {
            res.json({
                phase: "await_complete",
                tournamentName: tour.name,
                taskCount: ordered.length,
                endsAt,
            })
            return
        }

        const cur = ordered[idx]
        res.json({
            phase: "task",
            tournamentName: tour.name,
            taskIndex: idx,
            taskCount: ordered.length,
            endsAt,
            task: { id: cur.id, title: cur.title, description: cur.description },
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/tournaments/:id/submit", async (req, res) => {
    try {
        await expireLiveTournaments()
        const tournamentId = req.params.id
        const userId = req.body.userId ? String(req.body.userId).trim() : ""
        const code = String(req.body.code ?? "").replace(/^\uFEFF/, "").trimEnd()
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }
        if (!code) {
            res.status(400).json({ error: "Отправьте код" })
            return
        }

        const { data: tour, error: tErr } = await supabase.from("tournaments").select("id, status").eq("id", tournamentId).maybeSingle()
        if (tErr) throw tErr
        if (!tour || tour.status !== "live") {
            res.status(400).json({ error: "Отправка возможна только в активном турнире" })
            return
        }

        const { data: part, error: pErr } = await supabase
            .from("tournament_participants")
            .select("id, current_task_index")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .maybeSingle()
        if (pErr) throw pErr
        if (!part) {
            res.status(403).json({ error: "Вы не участник турнира" })
            return
        }

        const ordered = await getOrderedTournamentTasks(tournamentId)
        const idx = part.current_task_index
        if (idx >= ordered.length) {
            res.status(400).json({ error: "Все задачи уже отправлены — завершите турнир" })
            return
        }

        const taskRow = ordered[idx]
        const { error: upErr } = await supabase.from("tournament_submissions").upsert(
            {
                tournament_id: tournamentId,
                tournament_task_id: taskRow.id,
                user_id: userId,
                source_code: code,
                review_status: "pending",
                submitted_at: new Date().toISOString(),
            },
            { onConflict: "tournament_task_id,user_id" },
        )
        if (upErr) throw upErr

        const nextIdx = idx + 1
        const { error: updP } = await supabase
            .from("tournament_participants")
            .update({ current_task_index: nextIdx })
            .eq("id", part.id)
        if (updP) throw updP

        res.json({ success: true, nextTaskIndex: nextIdx, allTasksSubmitted: nextIdx >= ordered.length })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/tournaments/:id/complete", async (req, res) => {
    try {
        const tournamentId = req.params.id
        const userId = req.body.userId ? String(req.body.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }

        const ordered = await getOrderedTournamentTasks(tournamentId)
        const { data: part, error: pErr } = await supabase
            .from("tournament_participants")
            .select("id, current_task_index, completed_at")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .maybeSingle()
        if (pErr) throw pErr
        if (!part) {
            res.status(403).json({ error: "не участник" })
            return
        }
        if (part.completed_at) {
            res.json({ success: true, already: true })
            return
        }
        if (part.current_task_index < ordered.length) {
            res.status(400).json({ error: "Сначала отправьте решения по всем задачам" })
            return
        }

        const { error } = await supabase
            .from("tournament_participants")
            .update({ completed_at: new Date().toISOString() })
            .eq("id", part.id)
        if (error) throw error
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/tournaments/:id/summary", async (req, res) => {
    try {
        await expireLiveTournaments()
        const tournamentId = req.params.id
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }

        const { data: tour, error: tourErr } = await supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle()
        if (tourErr) throw tourErr
        if (!tour) {
            res.status(404).json({ error: "турнир не найден" })
            return
        }

        const { data: part } = await supabase
            .from("tournament_participants")
            .select("completed_at")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .maybeSingle()
        if (!part) {
            res.status(403).json({ error: "Вы не участник турнира" })
            return
        }

        const tournamentFinished = tour.status === "finished"
        if (!tournamentFinished && !part.completed_at) {
            res.status(400).json({ error: "Сначала завершите турнир на экране решения" })
            return
        }

        const ordered = await getOrderedTournamentTasks(tournamentId)
        const taskIds = ordered.map((t) => t.id)
        const { data: subs, error: sErr } = await supabase
            .from("tournament_submissions")
            .select("tournament_task_id, source_code, review_status, submitted_at, admin_comment")
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId)
            .in("tournament_task_id", taskIds)
        if (sErr) throw sErr
        const byTask = new Map((subs ?? []).map((s) => [s.tournament_task_id, s]))

        res.json({
            tasks: ordered.map((t) => {
                const s = byTask.get(t.id)
                const st = s?.review_status ?? "pending"
                const label = st === "pending" ? "На проверке" : st
                return {
                    taskId: t.id,
                    title: t.title,
                    code: s?.source_code ?? "",
                    reviewStatus: st,
                    adminComment: s?.admin_comment ?? null,
                    label,
                    labelRu: label,
                }
            }),
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/admin/tournaments/:id/submissions", async (req, res) => {
    try {
        const adminId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const tournamentId = req.params.id

        const { data: rows, error } = await supabase
            .from("tournament_submissions")
            .select("id, tournament_task_id, user_id, source_code, review_status, submitted_at, admin_comment")
            .eq("tournament_id", tournamentId)
            .order("submitted_at", { ascending: false })
        if (error) throw error

        const userIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))]
        const taskIds = [...new Set((rows ?? []).map((r) => r.tournament_task_id).filter(Boolean))]
        /** @type {Map<string, string>} */
        const userMap = new Map()
        if (userIds.length) {
            const { data: users } = await supabase.from("users").select("id, username").in("id", userIds)
            for (const u of users ?? []) userMap.set(u.id, u.username)
        }
        /** @type {Map<string, string>} */
        const taskTitleMap = new Map()
        if (taskIds.length) {
            const { data: tt } = await supabase.from("tournament_tasks").select("id, title").in("id", taskIds)
            for (const t of tt ?? []) taskTitleMap.set(t.id, t.title)
        }

        res.json(
            (rows ?? []).map((r) => ({
                id: r.id,
                tournamentTaskId: r.tournament_task_id,
                taskTitle: taskTitleMap.get(r.tournament_task_id) ?? "—",
                userId: r.user_id,
                username: userMap.get(r.user_id) ?? "—",
                code: r.source_code,
                reviewStatus: r.review_status,
                submittedAt: r.submitted_at,
                adminComment: r.admin_comment ?? null,
            })),
        )
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.patch("/api/admin/tournament-submissions/:submissionId", async (req, res) => {
    try {
        const adminId = req.body.userId ? String(req.body.userId).trim() : ""
        if (!(await ensureAdmin(adminId))) {
            res.status(403).json({ error: "no access" })
            return
        }
        const status = String(req.body.status ?? "").toUpperCase()
        if (status !== "PASS" && status !== "FAIL") {
            res.status(400).json({ error: "status: PASS или FAIL" })
            return
        }
        const submissionId = Number.parseInt(String(req.params.submissionId), 10)
        if (!Number.isFinite(submissionId)) {
            res.status(400).json({ error: "некорректный id" })
            return
        }

        const commentRaw = req.body.comment != null ? String(req.body.comment) : ""
        const adminComment = commentRaw.trim().slice(0, 2000)

        const { data: prev, error: prevErr } = await supabase
            .from("tournament_submissions")
            .select("id, user_id, tournament_id")
            .eq("id", submissionId)
            .maybeSingle()
        if (prevErr) throw prevErr
        if (!prev) {
            res.status(404).json({ error: "отправка не найдена" })
            return
        }

        const { error } = await supabase
            .from("tournament_submissions")
            .update({
                review_status: status,
                reviewed_at: new Date().toISOString(),
                reviewed_by: adminId,
                admin_comment: adminComment || null,
            })
            .eq("id", submissionId)
        if (error) throw error

        const { data: tname } = await supabase.from("tournaments").select("name").eq("id", prev.tournament_id).maybeSingle()
        const ttitle = tname?.name ?? "Турнир"
        const statusRu = status === "PASS" ? "PASS (зачтено)" : "FAIL (не зачтено)"
        let body = `Статус вашего решения в турнире: ${statusRu}.`
        if (adminComment) body += ` Комментарий проверяющего: ${adminComment}`
        await insertNotificationsForUsers([prev.user_id], {
            title: `«${ttitle}»: ${status} по решению`,
            body: body.slice(0, 2000),
            link_kind: "tournament",
            link_id: String(prev.tournament_id),
        })

        res.json({ success: true, status })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.get("/api/notifications", async (req, res) => {
    try {
        const userId = req.query.userId ? String(req.query.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }
        const { data, error } = await supabase
            .from("user_notifications")
            .select("id, title, body, link_kind, link_id, read_at, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50)
        if (error) throw error
        const rows = data ?? []
        const unreadCount = rows.filter((n) => !n.read_at).length
        res.json({
            unreadCount,
            items: rows.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                linkKind: n.link_kind,
                linkId: n.link_id,
                readAt: n.read_at,
                createdAt: n.created_at,
            })),
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/notifications/:id/read", async (req, res) => {
    try {
        const userId = req.body.userId ? String(req.body.userId).trim() : ""
        if (!userId) {
            res.status(400).json({ error: "userId обязателен" })
            return
        }
        const id = Number.parseInt(String(req.params.id), 10)
        if (!Number.isFinite(id)) {
            res.status(400).json({ error: "некорректный id" })
            return
        }
        const { data: n, error: nErr } = await supabase.from("user_notifications").select("user_id").eq("id", id).maybeSingle()
        if (nErr) throw nErr
        if (!n || String(n.user_id) !== userId) {
            res.status(403).json({ error: "нет доступа" })
            return
        }
        const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", id)
        if (error) throw error
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body
        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password, role_id")
            .eq("username", username)
            .maybeSingle()
        if (error) throw error
        if (!user || user.password !== password) {
            res.status(401).json({ error: "wrong credentials" })
            return
        }
        const { data: role } = await supabase.from("app_roles").select("code").eq("id", user.role_id).maybeSingle()
        res.json({
            id: user.id,
            username: user.username,
            role: role?.code ?? "user",
        })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body
        const { data: userRole, error: roleErr } = await supabase.from("app_roles").select("id").eq("code", "user").maybeSingle()
        if (roleErr) throw roleErr
        if (!userRole?.id) {
            res.status(500).json({ error: "Роль user не найдена — выполните supabase-schema.sql или POST /api/db/bootstrap" })
            return
        }
        const { error } = await supabase.from("users").insert({
            username,
            password,
            role_id: userRole.id,
        })
        if (error) {
            res.status(400).json({ error: error.message?.includes("duplicate") ? "user exists" : error.message })
            return
        }
        res.json({ success: true })
    } catch (e) {
        res.status(500).json({ error: e?.message ?? "db error" })
    }
})

app.use(express.static(clientDistPath))
app.use(express.static(legacyClientPath))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log("SERVER STARTED on", PORT)
})
