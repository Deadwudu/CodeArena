const express = require("express")
const cors = require("cors")
const path = require("path")
const db = require("./db")
const app = express()
db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS tasks(
            id TEXT PRIMARY KEY,
            title TEXT,
            difficulty TEXT,
            description TEXT
        )
    `)
    db.run(`
CREATE TABLE IF NOT EXISTS attempts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taskId TEXT,
    code TEXT,
    result TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)
        db.run(`
CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
)
`)
db.run(`
INSERT OR IGNORE INTO users(username,password,role)
VALUES ("admin","123","admin")
`)
})
db.run(`
INSERT OR IGNORE INTO tasks VALUES
("sum","Сумма двух чисел","easy","Найдите сумму двух чисел"),
("reverse","Разворот строки","medium","Разверните строку"),
("unique","Уникальный элемент","hard","Найдите уникальное число")
`)


db.run(`
ALTER TABLE attempts
ADD COLUMN userId INTEGER
`, (err)=>{
    if(err){
        console.log("userId уже существует")
    }
})

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, "../client")))

// получить все задачи
app.get("/api/tasks",(req,res)=>{

    db.all("SELECT * FROM tasks",(err,rows)=>{

        if(err){
            res.status(500).json({error:"db error"})
            return
        }

        res.json(rows)

    })

})
app.post("/api/tasks", (req, res) => {

    const { title, difficulty, description, userId } = req.body

    // проверяем пользователя
    db.get(
        "SELECT * FROM users WHERE id = ?",
        [userId],
        (err, user) => {

            if(!user || user.role !== "admin"){
                res.status(403).json({ error: "no access" })
                return
            }

            const id = Date.now().toString() // простой id

            db.run(
                "INSERT INTO tasks(id,title,difficulty,description) VALUES(?,?,?,?)",
                [id, title, difficulty, description],
                (err) => {

                    if(err){
                        res.status(500).json({ error: "db error" })
                        return
                    }

                    res.json({ success: true })

                }
            )

        }
    )

})
// получить одну задачу
app.get("/api/tasks/:id", (req, res) => {

    const id = req.params.id

    db.get(
        "SELECT * FROM tasks WHERE id = ?",
        [id],
        (err, row) => {

            if(err){
                res.status(500).json({error:"db error"})
                return
            }

            if(!row){
                res.status(404).json({error:"not found"})
                return
            }

            res.json(row)

        }
    )

})
app.use(express.json())
app.delete("/api/tasks/:id", (req, res) => {

    const { userId } = req.body
    const id = req.params.id

    db.get(
        "SELECT * FROM users WHERE id = ?",
        [userId],
        (err, user) => {

            if(!user || user.role !== "admin"){
                res.status(403).json({ error: "no access" })
                return
            }

            db.run(
                "DELETE FROM tasks WHERE id = ?",
                [id],
                (err) => {

                    if(err){
                        res.status(500).json({ error: "db error" })
                        return
                    }

                    res.json({ success: true })

                }
            )

        }
    )

})
app.post("/api/run", (req, res) => {

    const { code, taskId, userId } = req.body

    try{

        let result

        if(taskId === "sum"){

            const fn = new Function(code + "; return sum")

            const sum = fn()

            if(sum(2,3) === 5 && sum(10,5) === 15){
                result = "PASS"
            }else{
                result = "FAIL"
            }

        }

        else if(taskId === "reverse"){

            const fn = new Function(code + "; return reverse")

            const reverse = fn()

            if(reverse("abc") === "cba"){
                result = "PASS"
            }else{
                result = "FAIL"
            }

        }

        else if(taskId === "unique"){

            const fn = new Function(code + "; return unique")

            const unique = fn()

            if(unique([1,2,3,2,1]) === 3){
                result = "PASS"
            }else{
                result = "FAIL"
            }

        }
        db.run(
"INSERT INTO attempts(taskId, code, result, userId) VALUES(?,?,?,?)",
[taskId, code, result, userId]
)
        res.json({ result })

    }
    catch(e){

        res.json({ result:"ERROR", error:e.toString() })

    }

})
app.get("/api/attempts",(req,res)=>{

    db.all(
        "SELECT * FROM attempts ORDER BY createdAt DESC",
        (err,rows)=>{
            res.json(rows)
        }
    )

})

app.get("/api/attempts/:taskId",(req,res)=>{

    const taskId = req.params.taskId

    db.all(
        "SELECT * FROM attempts WHERE taskId = ? ORDER BY createdAt DESC",
        [taskId],
        (err,rows)=>{
            if(err){
                res.status(500).json({error:"db error"})
                return
            }

            res.json(rows)
        }
    )

})
app.post("/api/login", (req,res)=>{

    const { username, password } = req.body

    db.get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err,user)=>{

            if(!user){
                res.status(401).json({error:"wrong credentials"})
                return
            }

            res.json({
                id: user.id,
                username: user.username,
                role: user.role
            })

        }
    )

})
app.post("/api/register",(req,res)=>{

    const { username, password } = req.body

    db.run(
        "INSERT INTO users(username,password) VALUES(?,?)",
        [username,password],
        function(err){

            if(err){
                res.status(400).json({error:"user exists"})
                return
            }

            res.json({ success:true })

        }
    )

})

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    console.log("ТАБЛИЦЫ:", rows)
})

app.listen(3000, ()=>{
    console.log("SERVER STARTED")
})