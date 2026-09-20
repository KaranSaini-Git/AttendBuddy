const normalizeHeader = (value) =>
  String(value || '')
    .replace(/\ufeff/g, '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');

const aliases = {
  subject_name: ['subject name', 'subject', 'subject title', 'subject name (optional)'],
  subject_code: ['subject code', 'subject code optional', 'code', 'course code'],
  day: ['day', 'day of week'],
  start_time: ['start time', 'start', 'from', 'class start time'],
  end_time: ['end time', 'end', 'to', 'class end time'],
  room: ['room', 'room number', 'room no', 'room no.', 'room number or additional details'],
  notes: ['notes', 'details', 'additional details', 'description']
};

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseTimetableCsv(text) {
  const lines = String(text || '')
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('The CSV needs a header row and at least one timetable row.');
  }

  const rawHeaders = splitCsvLine(lines[0]);
  const headerMap = rawHeaders.map(normalizeHeader);

  const getColumn = (field) => {
    const accepted = aliases[field];
    const index = headerMap.findIndex((header) => accepted.includes(header));
    return index;
  };

  const indexes = {
    subject_name: getColumn('subject_name'),
    subject_code: getColumn('subject_code'),
    day: getColumn('day'),
    start_time: getColumn('start_time'),
    end_time: getColumn('end_time'),
    room: getColumn('room'),
    notes: getColumn('notes')
  };

  const required = ['subject_name', 'day', 'start_time', 'end_time'];
  const missing = required.filter((field) => indexes[field] === -1);

  if (missing.length) {
    throw new Error(
      `Missing required CSV columns: ${missing.join(', ')}.`
    );
  }

  const rows = lines.slice(1)
    .map((line) => {
      const cells = splitCsvLine(line);
      return Object.fromEntries(
        Object.entries(indexes).map(([field, index]) => [
          field,
          index >= 0 ? cells[index] || '' : ''
        ])
      );
    })
    .filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));

  if (!rows.length) {
    throw new Error('The CSV does not contain any timetable rows.');
  }

  return rows;
}

export function downloadTimetableTemplate() {
  const rows = [
    ['subject_name', 'subject_code', 'day', 'start_time', 'end_time', 'room', 'notes'],
    ['Fundamentals of Machine Intelligence 1', 'MTH3647', 'Monday', '08:00', '09:00', 'C-111', ''],
    ['Design Principles of Operating Systems', 'CSE3249', 'Monday', '09:00', '10:00', 'C-111', ''],
    ['Practical Programming With C', 'CSE3544', 'Monday', '10:00', '11:00', 'C-111', ''],
    ['Computer Networking: Concepts', 'CSE3751', 'Monday', '11:00', '13:00', 'C-021', 'Lab'],
    ['Practical Programming With C', 'CSE3544', 'Tuesday', '08:00', '10:00', 'C-021', 'Lab'],
    ['Intermediate Problem Solving 1', 'GET2024', 'Tuesday', '10:00', '11:00', 'C-111', ''],
    ['Fundamentals of Machine Intelligence 1', 'MTH3647', 'Tuesday', '11:00', '12:00', 'C-111', ''],
    ['Introduction to Theory of Computation', 'CSE3731', 'Tuesday', '12:00', '13:00', 'C-111', ''],
    ['Design Principles of Operating Systems', 'CSE3249', 'Wednesday', '08:00', '09:00', 'C-111', ''],
    ['Introduction to Theory of Computation', 'CSE3731', 'Wednesday', '09:00', '10:00', 'C-111', ''],
    ['Computer Networking: Concepts', 'CSE3751', 'Wednesday', '10:00', '11:00', 'C-111', ''],
    ['Machine Learning Concepts 1', 'CSE3967', 'Wednesday', '11:00', '13:00', 'C-021', 'Lab'],
    ['Introduction to Theory of Computation', 'CSE3731', 'Thursday', '13:50', '14:50', 'C-111', ''],
    ['Intermediate Problem Solving 1', 'GET2024', 'Thursday', '14:50', '15:50', 'C-111', ''],
    ['Fundamentals of Machine Intelligence 1', 'MTH3647', 'Thursday', '15:50', '16:50', 'C-111', ''],
    ['Design Principles of Operating Systems', 'CSE3249', 'Thursday', '16:50', '17:50', 'C-111', ''],
    ['Practical Programming With C', 'CSE3544', 'Thursday', '17:50', '18:50', 'C-111', ''],
    ['Intermediate Problem Solving 1', 'GET2024', 'Friday', '13:50', '14:50', 'C-111', ''],
    ['Computer Networking: Concepts', 'CSE3751', 'Friday', '14:50', '15:50', 'C-111', ''],
    ['Practical Programming With C', 'CSE3544', 'Friday', '16:50', '18:50', 'C-021', 'Lab'],
    ['Computer Networking: Concepts', 'CSE3751', 'Saturday', '13:50', '14:50', 'C-111', ''],
    ['Machine Learning Concepts 1', 'CSE3967', 'Saturday', '14:50', '16:50', 'C-021', 'Lab'],
    ['Design Principles of Operating Systems', 'CSE3249', 'Saturday', '16:50', '18:50', 'C-021', 'Lab']
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'attendbuddy-timetable-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
