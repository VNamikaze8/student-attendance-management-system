
const studentForm = document.getElementById('studentForm');
const studentTable = document.getElementById('studentTable');
const message = document.getElementById('message');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');

let editingId = null;
let students = [];

async function loadStudents() {
    try {
        const response = await fetch('/api/students');

        if (!response.ok) {
            throw new Error('Unable to load students');
        }

        students = await response.json();
        await loadDailyAttendance();
        studentTable.innerHTML = '';

        if (students.length === 0) {
            const row = studentTable.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = 'No students added yet';
            return;
        }

        students.forEach(student => {
            const row = studentTable.insertRow();

            row.insertCell().textContent = student.roll_number;
            row.insertCell().textContent = student.name;
            row.insertCell().textContent = student.department;

            const actionCell = row.insertCell();
            const editButton = document.createElement('button');

            editButton.textContent = 'Edit';
            editButton.className = 'edit-btn';
            editButton.addEventListener('click', () => {
                editStudent(student.id);
            });

            actionCell.appendChild(editButton);
        });
    } catch (error) {
        message.textContent = error.message;
        message.style.color = 'red';
    }
}

studentForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const roll_number = document.getElementById('rollNumber').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const department = document.getElementById('department').value.trim();

    if (!roll_number || !name || !department) {
        message.textContent = 'Please fill all fields';
        message.style.color = 'red';
        return;
    }

    const url = editingId
        ? `/api/students/${editingId}`
        : '/api/students';

    const method = editingId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roll_number,
                name,
                department
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Operation failed');
        }

        resetForm();
        message.textContent = result.message;
        message.style.color = 'green';

        await loadStudents();
    } catch (error) {
        message.textContent = error.message;
        message.style.color = 'red';
    }
});

function editStudent(id) {
    const student = students.find(s => s.id === id);

    if (!student) return;

    document.getElementById('rollNumber').value = student.roll_number;
    document.getElementById('studentName').value = student.name;
    document.getElementById('department').value = student.department;

    editingId = id;
    saveButton.textContent = 'Update Student';
    cancelButton.hidden = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    studentForm.reset();
    editingId = null;
    saveButton.textContent = 'Add Student';
    cancelButton.hidden = true;
}

cancelButton.addEventListener('click', resetForm);

loadStudents();

const attendanceDate = document.getElementById('attendanceDate');
const attendanceTable = document.getElementById('attendanceTable');
const attendanceMessage = document.getElementById('attendanceMessage');

function todayLocal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

attendanceDate.value = todayLocal();

function createPeriodSelect(studentId, period, status = '') {
    const select = document.createElement('select');

    select.dataset.student = studentId;
    select.dataset.period = period;
    select.setAttribute(
        'aria-label',
        `Student ${studentId}, Period ${period}`
    );

    const options = [
        ['', '--'],
        ['P', 'P'],
        ['A', 'A']
    ];

    options.forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });

    select.value = status;
    updateSelectColor(select);

    select.addEventListener('change', () => {
        updateSelectColor(select);
        attendanceMessage.textContent = '';
    });

    return select;
}

function updateSelectColor(select) {
    select.classList.remove('present', 'absent');

    if (select.value === 'P') {
        select.classList.add('present');
    } else if (select.value === 'A') {
        select.classList.add('absent');
    }
}

async function loadDailyAttendance() {
    const date = attendanceDate.value;

    attendanceMessage.textContent = '';
    attendanceTable.innerHTML = '';

    if (!date) return;

    try {
        const response = await fetch(
            `/api/attendance?date=${encodeURIComponent(date)}`
        );

        if (!response.ok) {
            throw new Error('Failed to load attendance');
        }

        const records = await response.json();
        const saved = new Map();

        records.forEach(record => {
            saved.set(
                `${record.student_id}-${record.period}`,
                record.status
            );
        });

        if (students.length === 0) {
            const row = attendanceTable.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 9;
            cell.textContent = 'Please add students first';
            return;
        }

        students.forEach(student => {
            const row = attendanceTable.insertRow();

            row.insertCell().textContent = student.roll_number;
            row.insertCell().textContent = student.name;

            for (let period = 1; period <= 7; period++) {
                const cell = row.insertCell();
                const status = saved.get(
                    `${student.id}-${period}`
                ) || '';

                cell.appendChild(
                    createPeriodSelect(student.id, period, status)
                );
            }
        });

    } catch (error) {
        attendanceMessage.textContent = error.message;
        attendanceMessage.style.color = 'red';
    }
}

function markAll(status) {
    document.querySelectorAll(
        '#attendanceTable select'
    ).forEach(select => {
        select.value = status;
        updateSelectColor(select);
    });

    attendanceMessage.textContent = '';
}

document.getElementById('markPresent')
    .addEventListener('click', () => markAll('P'));

document.getElementById('markAbsent')
    .addEventListener('click', () => markAll('A'));

attendanceDate.addEventListener('change', loadDailyAttendance);

document.getElementById('saveAttendance')
    .addEventListener('click', async () => {

        const selects = Array.from(
            document.querySelectorAll('#attendanceTable select')
        );

        if (selects.length === 0) {
            attendanceMessage.textContent = 'Please add students first';
            attendanceMessage.style.color = 'red';
            return;
        }

        if (selects.some(select => !select.value)) {
            attendanceMessage.textContent =
                'Please mark all seven periods for every student';
            attendanceMessage.style.color = 'red';
            return;
        }

        const records = selects.map(select => ({
            student_id: Number(select.dataset.student),
            period: Number(select.dataset.period),
            status: select.value
        }));

        try {
            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    date: attendanceDate.value,
                    records
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message);
            }

            attendanceMessage.textContent = result.message;
            attendanceMessage.style.color = 'green';

        } catch (error) {
            attendanceMessage.textContent = error.message;
            attendanceMessage.style.color = 'red';
        }
    });

const reportMonth = document.getElementById('reportMonth');
const attendanceThreshold = document.getElementById('attendanceThreshold');
const monthlyReportTable = document.getElementById('monthlyReportTable');
const reportMessage = document.getElementById('reportMessage');

reportMonth.value = todayLocal().slice(0, 7);

async function loadMonthlyReport() {
    const month = reportMonth.value;
    const threshold = Number(attendanceThreshold.value);

    if (!month) {
        reportMessage.textContent = 'Please select a month';
        reportMessage.style.color = 'red';
        return;
    }

    if (
        attendanceThreshold.value.trim() === '' ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 100
    ) {
        reportMessage.textContent =
            'Enter a threshold between 0 and 100';
        reportMessage.style.color = 'red';
        return;
    }

    try {
        const response = await fetch(
            `/api/monthly-report?month=${encodeURIComponent(month)}&threshold=${threshold}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        monthlyReportTable.innerHTML = '';

        if (data.students.length === 0) {
            const row = monthlyReportTable.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 7;
            cell.textContent = 'No students registered';

            reportMessage.textContent = '';
            return;
        }

        data.students.forEach(student => {
            const row = monthlyReportTable.insertRow();

            row.insertCell().textContent = student.roll_number;
            row.insertCell().textContent = student.name;
            row.insertCell().textContent = student.working_periods;
            row.insertCell().textContent = student.present;
            row.insertCell().textContent = student.absent;

            const percentageCell = row.insertCell();

            percentageCell.textContent =
                student.percentage === null
                    ? '--'
                    : student.percentage.toFixed(2) + '%';

            const statusCell = row.insertCell();
            statusCell.textContent = student.status;

            if (student.status === 'Good') {
                statusCell.className = 'status-good';
            } else if (student.status === 'Low Attendance') {
                statusCell.className = 'status-low';
            } else {
                statusCell.className = 'status-pending';
            }
        });

        reportMessage.textContent =
            'Monthly report generated successfully';
        reportMessage.style.color = 'green';

    } catch (error) {
        reportMessage.textContent = error.message;
        reportMessage.style.color = 'red';
    }
}

document.getElementById('generateReport')
    .addEventListener('click', loadMonthlyReport);

loadMonthlyReport();

const studentReportSelect = document.getElementById('studentReportSelect');
const studentReportMonth = document.getElementById('studentReportMonth');
const studentReportResult = document.getElementById('studentReportResult');

studentReportMonth.value = todayLocal().slice(0, 7);

// Load students into dropdown
async function loadReportStudents() {
    try {
        const response = await fetch('/api/students');

        if (!response.ok) {
            throw new Error('Unable to load students');
        }

        const studentList = await response.json();
        const previousSelection = studentReportSelect.value;

        studentReportSelect.innerHTML =
            '<option value="">Select Student</option>';

        studentList.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent =
                `${student.roll_number} - ${student.name}`;

            studentReportSelect.appendChild(option);
        });

        studentReportSelect.value = previousSelection;

    } catch (error) {
        studentReportResult.textContent = error.message;
    }
}

// Generate report for one student
async function generateStudentReport() {
    const studentId = Number(studentReportSelect.value);
    const month = studentReportMonth.value;

    studentReportResult.textContent = '';

    if (!studentId || !month) {
        studentReportResult.textContent =
            'Please select a student and month';
        return;
    }

    try {
        const response = await fetch(
            `/api/monthly-report?month=${encodeURIComponent(month)}`
        );

        if (!response.ok) {
            throw new Error('Unable to generate student report');
        }

        const data = await response.json();

        const student = data.students.find(
            s => s.id === studentId
        );

        if (!student) {
            studentReportResult.textContent = 'Student not found';
            return;
        }

        const card = document.createElement('div');
        card.className = 'student-report-card';

        const heading = document.createElement('h3');
        heading.textContent = student.name;
        card.appendChild(heading);

        const details = [
            ['Roll Number', student.roll_number],
            ['Department', student.department],
            ['Month', month],
            ['Working Periods', student.working_periods],
            ['Present', student.present],
            ['Absent', student.absent],
            [
                'Attendance',
                student.percentage === null
                    ? 'Not Recorded'
                    : student.percentage.toFixed(2) + '%'
            ],
            ['Status', student.status]
        ];

        details.forEach(([label, value]) => {
            const paragraph = document.createElement('p');
            const strong = document.createElement('strong');

            strong.textContent = `${label}: `;
            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(String(value))
            );

            card.appendChild(paragraph);
        });

        studentReportResult.appendChild(card);

    } catch (error) {
        studentReportResult.textContent = error.message;
    }
}

document.getElementById('viewStudentReport')
    .addEventListener('click', generateStudentReport);

studentReportSelect.addEventListener(
    'focus',
    loadReportStudents
);

loadReportStudents();

const historyDate = document.getElementById('historyDate');
const historyTable = document.getElementById('historyTable');
const historyMessage = document.getElementById('historyMessage');

historyDate.value = todayLocal();

async function viewAttendanceHistory() {
    const date = historyDate.value;

    historyTable.innerHTML = '';
    historyMessage.textContent = '';

    if (!date) {
        historyMessage.textContent = 'Please select a date';
        return;
    }

    try {
        const [studentsResponse, attendanceResponse] =
            await Promise.all([
                fetch('/api/students'),
                fetch(
                    `/api/attendance?date=${encodeURIComponent(date)}`
                )
            ]);

        if (!studentsResponse.ok || !attendanceResponse.ok) {
            throw new Error('Unable to load attendance history');
        }

        const studentList = await studentsResponse.json();
        const records = await attendanceResponse.json();

        const attendanceMap = new Map();

        records.forEach(record => {
            attendanceMap.set(
                `${record.student_id}-${record.period}`,
                record.status
            );
        });

        if (records.length === 0) {
            historyMessage.textContent =
                'No attendance recorded for this date';
            return;
        }

        studentList.forEach(student => {
            const row = historyTable.insertRow();

            row.insertCell().textContent = student.roll_number;
            row.insertCell().textContent = student.name;

            for (let period = 1; period <= 7; period++) {
                const cell = row.insertCell();

                const status = attendanceMap.get(
                    `${student.id}-${period}`
                );

                cell.textContent = status || '--';

                if (status === 'P') {
                    cell.className = 'present-cell';
                } else if (status === 'A') {
                    cell.className = 'absent-cell';
                }
            }
        });

        historyMessage.textContent =
            `Attendance history loaded for ${date}`;
        historyMessage.style.color = 'green';

    } catch (error) {
        historyMessage.textContent = error.message;
        historyMessage.style.color = 'red';
    }
}

document.getElementById('viewHistory')
    .addEventListener('click', viewAttendanceHistory);

const downloadCSV = document.getElementById('downloadCSV');
const exportMessage = document.getElementById('exportMessage');

function csvValue(value) {
    let text = String(value ?? '');

    // Prevent spreadsheet applications from evaluating user input
    if (/^\s*[=+\-@\t\r\n]/.test(text)) {
        text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
}

downloadCSV.addEventListener('click', async () => {
    const month = reportMonth.value;
    const threshold = Number(attendanceThreshold.value);

    exportMessage.textContent = '';

    if (!month) {
        exportMessage.textContent = 'Please select a report month';
        return;
    }

    if (
        attendanceThreshold.value.trim() === '' ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 100
    ) {
        exportMessage.textContent =
            'Enter a valid attendance threshold';
        return;
    }

    try {
        const response = await fetch(
            `/api/monthly-report?month=${encodeURIComponent(month)}&threshold=${threshold}`
        );

        if (!response.ok) {
            throw new Error('Unable to export monthly report');
        }

        const data = await response.json();

        if (data.students.length === 0) {
            exportMessage.textContent = 'No students to export';
            return;
        }

        const rows = [
            [
                'Roll Number',
                'Student Name',
                'Department',
                'Working Periods',
                'Present',
                'Absent',
                'Attendance Percentage',
                'Status'
            ]
        ];

        data.students.forEach(student => {
            rows.push([
                student.roll_number,
                student.name,
                student.department,
                student.working_periods,
                student.present,
                student.absent,
                student.percentage === null
                    ? ''
                    : student.percentage.toFixed(2),
                student.status
            ]);
        });

        const csvContent = '\uFEFF' + rows.map(row =>
            row.map(csvValue).join(',')
        ).join('\r\n');

        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `Attendance_Report_${month}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        exportMessage.textContent =
            'Monthly report downloaded successfully';
        exportMessage.style.color = 'green';

    } catch (error) {
        exportMessage.textContent = error.message;
        exportMessage.style.color = 'red';
    }
});
