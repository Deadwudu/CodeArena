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
app.use(express.static(clientDistPath))
app.use(express.static(legacyClientPath))

function mapTask(row) {
    return {
        id: row.id,
        title: row.title,
        difficulty: row.difficulty_code,
        description: row.description,
        category: row.categories?.name ?? null,
    }
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
            .order("id", { ascending: true })
        if (error) throw error
        res.json((data ?? []).map(mapTask))
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

        const { data: attempts, error: aErr } = await supabase.from("attempts").select("user_id, status_code, task_id")
        if (aErr) throw aErr

        /** @type {Map<string, { total: number; pass: number; fail: number; error: number; tasks: Set<string> }>} */
        const statsByUser = new Map()
        for (const a of attempts ?? []) {
            const key = a.user_id ?? "__guest__"
            if (!statsByUser.has(key)) {
                statsByUser.set(key, { total: 0, pass: 0, fail: 0, error: 0, tasks: new Set() })
            }
            const s = statsByUser.get(key)
            s.total++
            if (a.status_code === "PASS") s.pass++
            else if (a.status_code === "FAIL") s.fail++
            else if (a.status_code === "ERROR") s.error++
            s.tasks.add(a.task_id)
        }

        const pack = (s) => ({
            attemptCount: s.total,
            passCount: s.pass,
            failCount: s.fail,
            errorCount: s.error,
            distinctTaskCount: s.tasks.size,
        })

        const rows = (users ?? []).map((u) => {
            const s = statsByUser.get(u.id) ?? { total: 0, pass: 0, fail: 0, error: 0, tasks: new Set() }
            return {
                id: u.id,
                username: u.username,
                role: roleById.get(u.role_id) ?? "user",
                createdAt: u.created_at,
                ...pack(s),
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
                      ...pack(guest),
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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log("SERVER STARTED on", PORT)
})
