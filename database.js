
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataFolder = path.join(__dirname, 'data');

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const db = new Database(path.join(dataFolder, 'attendance.db'));

db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        department TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
        status TEXT NOT NULL CHECK(status IN ('P', 'A')),
        FOREIGN KEY (student_id) REFERENCES students(id)
            ON DELETE CASCADE,
        UNIQUE(student_id, date, period)
    );
`);

console.log('Database initialized successfully');

module.exports = db;