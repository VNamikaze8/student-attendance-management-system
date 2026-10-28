
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/students', (req, res) => {
    const students = db.prepare(
        'SELECT * FROM students ORDER BY roll_number'
    ).all();

    res.json(students);
});

app.post('/api/students', (req, res) => {
    const { roll_number, name, department } = req.body || {};

    if (
        typeof roll_number !== 'string' ||
        typeof name !== 'string' ||
        typeof department !== 'string' ||
        !roll_number.trim() ||
        !name.trim() ||
        !department.trim()
    ) {
        return res.status(400).json({
            message: 'All student details are required'
        });
    }

    try {
        const result = db.prepare(`
            INSERT INTO students (roll_number, name, department)
            VALUES (?, ?, ?)
        `).run(
            roll_number.trim(),
            name.trim(),
            department.trim()
        );

        res.status(201).json({
            message: 'Student added successfully',
            id: result.lastInsertRowid
        });
    } catch (error) {
        if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({
                message: 'Roll number already exists'
            });
        }
        res.status(500).json({
            message: 'Failed to add student'
        });
    }
});

app.put('/api/students/:id', (req, res) => {
    const { roll_number, name, department } = req.body || {};

    if (
        !Number.isSafeInteger(Number(req.params.id)) ||
        typeof roll_number !== 'string' ||
        typeof name !== 'string' ||
        typeof department !== 'string' ||
        !roll_number.trim() ||
        !name.trim() ||
        !department.trim()
    ) {
        return res.status(400).json({
            message: 'Valid student details are required'
        });
    }

    try {
        const result = db.prepare(`
            UPDATE students
            SET roll_number = ?, name = ?, department = ?
            WHERE id = ?
        `).run(
            roll_number.trim(),
            name.trim(),
            department.trim(),
            Number(req.params.id)
        );

        if (result.changes === 0) {
            return res.status(404).json({
                message: 'Student not found'
            });
        }

        res.json({ message: 'Student updated successfully' });
    } catch (error) {
        if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({
                message: 'Roll number already exists'
            });
        }
        res.status(500).json({
            message: 'Failed to update student'
        });
    }
});

const isValidDate = (date) => {
    if (typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(date + 'T00:00:00Z');
    return !isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date;
};

// Get attendance for a selected date
app.get('/api/attendance', (req, res) => {
    const { date } = req.query;

    if (!isValidDate(date)) {
        return res.status(400).json({
            message: 'Valid attendance date is required'
        });
    }

    const records = db.prepare(`
        SELECT student_id, date, period, status
        FROM attendance
        WHERE date = ?
        ORDER BY student_id, period
    `).all(date);

    res.json(records);
});

// Save or update daily attendance
app.post('/api/attendance', (req, res) => {
    const { date, records } = req.body || {};

    if (!isValidDate(date) || !Array.isArray(records)) {
        return res.status(400).json({
            message: 'Invalid attendance data'
        });
    }

    const studentIds = db.prepare(
        'SELECT id FROM students'
    ).all().map(student => student.id);

    if (studentIds.length === 0) {
        return res.status(400).json({
            message: 'Please add students first'
        });
    }

    if (records.length !== studentIds.length * 7) {
        return res.status(400).json({
            message: 'Mark all seven periods for every student'
        });
    }

    const allowedIds = new Set(studentIds);
    const uniqueRecords = new Set();

    for (const record of records) {
        if (
            !allowedIds.has(record.student_id) ||
            !Number.isInteger(record.period) ||
            record.period < 1 ||
            record.period > 7 ||
            !['P', 'A'].includes(record.status)
        ) {
            return res.status(400).json({
                message: 'Invalid student or attendance value'
            });
        }

        const key = `${record.student_id}-${record.period}`;

        if (uniqueRecords.has(key)) {
            return res.status(400).json({
                message: 'Duplicate attendance entry'
            });
        }

        uniqueRecords.add(key);
    }

    try {
        const save = db.prepare(`
            INSERT INTO attendance (student_id, date, period, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, date, period)
            DO UPDATE SET status = excluded.status
        `);

        const transaction = db.transaction(() => {
            for (const record of records) {
                save.run(
                    record.student_id,
                    date,
                    record.period,
                    record.status
                );
            }
        });

        transaction();

        res.json({
            message: 'Attendance saved successfully'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Unable to save attendance'
        });
    }
});

app.get('/api/monthly-report', (req, res) => {
    const { month } = req.query;
    const threshold = req.query.threshold === undefined
        ? 75
        : Number(req.query.threshold);

    if (
        typeof month !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        return res.status(400).json({
            message: 'Please select a valid month'
        });
    }

    if (
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 100
    ) {
        return res.status(400).json({
            message: 'Threshold must be between 0 and 100'
        });
    }

    try {
        const students = db.prepare(`
            SELECT
                s.id,
                s.roll_number,
                s.name,
                s.department,
                COUNT(a.id) AS working_periods,
                SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END)
                    AS present,
                SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END)
                    AS absent
            FROM students s
            LEFT JOIN attendance a
                ON s.id = a.student_id
                AND substr(a.date, 1, 7) = ?
            GROUP BY s.id
            ORDER BY s.roll_number
        `).all(month);

        const report = students.map(student => {
            const working = student.working_periods;
            const present = student.present;
            const absent = student.absent;

            const percentage = working > 0
                ? Number(((present / working) * 100).toFixed(2))
                : null;

            let status = 'Not Recorded';

            if (percentage !== null) {
                status = percentage < threshold
                    ? 'Low Attendance'
                    : 'Good';
            }

            return {
                ...student,
                working_periods: working,
                present,
                absent,
                percentage,
                status
            };
        });

        res.json({
            month,
            threshold,
            students: report
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Unable to generate monthly report'
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});