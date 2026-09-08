import { query } from '../config/db.js';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

const buildReportQuery = (filters, userId) => {
  const { section_id, subject_id, student_id, date_from, date_to } = filters;
  
  let text = `
    SELECT 
      a.id, a.date, a.status, a.subject_id, a.section_id,
      s.student_id, s.name as student_name,
      sub.subject_name,
      sec.section_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN subjects sub ON a.subject_id = sub.id
    JOIN sections sec ON a.section_id = sec.id
    WHERE EXISTS (
      SELECT 1
      FROM teacher_assignments ta
      WHERE ta.teacher_id = (SELECT id FROM teachers WHERE user_id = $1)
        AND ta.section_id = a.section_id
        AND ta.subject_id = a.subject_id
        AND ta.active = true
    )
  `;
  const values = [userId];
  
  if (section_id) {
    values.push(section_id);
    text += ` AND a.section_id = $${values.length}`;
  }
  if (subject_id) {
    values.push(subject_id);
    text += ` AND a.subject_id = $${values.length}`;
  }
  if (student_id) {
    values.push(student_id);
    text += ` AND a.student_id = $${values.length}`;
  }
  if (date_from) {
    values.push(date_from);
    text += ` AND a.date >= $${values.length}`;
  }
  if (date_to) {
    values.push(date_to);
    text += ` AND a.date <= $${values.length}`;
  }
  
  text += ` ORDER BY a.date DESC, s.name ASC`;
  
  return { text, values };
};

const getReports = async (req, res) => {
  try {
    const { text, values } = buildReportQuery(req.query, req.user.id);
    const result = await query(text, values);
    
    const records = result.rows;
    
    // Calculate summary
    const total_classes = [...new Set(records.map(r => `${r.date}_${r.subject_id}_${r.section_id}`))].length;
    const total_present = records.filter(r => r.status === 'Present').length;
    const total_absent = records.filter(r => r.status === 'Absent').length;
    const average_percentage = records.length ? (total_present / records.length) * 100 : 0;
    
    // Group by student
    const studentMap = {};
    records.forEach(r => {
      if (!studentMap[r.student_id]) {
        studentMap[r.student_id] = {
          student_id: r.student_id,
          student_name: r.student_name,
          total: 0,
          present: 0,
          absent: 0
        };
      }
      studentMap[r.student_id].total++;
      if (r.status === 'Present') studentMap[r.student_id].present++;
      else studentMap[r.student_id].absent++;
    });
    
    const students = Object.values(studentMap).map(s => ({
      ...s,
      percentage: s.total ? (s.present / s.total) * 100 : 0
    }));
    
    const below_75 = students.filter(s => s.percentage < 75);
    
    // Group by date for daily stats
    const dailyMap = {};
    records.forEach(r => {
      const d = new Date(r.date).toISOString().split('T')[0];
      if (!dailyMap[d]) {
        dailyMap[d] = { date: d, present: 0, absent: 0, total: 0 };
      }
      dailyMap[d].total++;
      if (r.status === 'Present') dailyMap[d].present++;
      else dailyMap[d].absent++;
    });
    const daily_stats = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({
      summary: { total_classes, total_present, total_absent, average_percentage },
      students,
      below_75,
      daily_stats
    });
  } catch (error) {
    console.error('Error generating reports', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

const getStudentPercentages = (records) => {
    const studentMap = {};
    records.forEach(r => {
      if (!studentMap[r.student_id]) {
        studentMap[r.student_id] = { total: 0, present: 0 };
      }
      studentMap[r.student_id].total++;
      if (r.status === 'Present') studentMap[r.student_id].present++;
    });
    
    const percentages = {};
    for (const [id, stats] of Object.entries(studentMap)) {
        percentages[id] = stats.total ? (stats.present / stats.total) * 100 : 0;
    }
    return percentages;
};

const exportCSV = async (req, res) => {
  try {
    const { text, values } = buildReportQuery(req.query, req.user.id);
    const result = await query(text, values);
    
    const percentages = getStudentPercentages(result.rows);
    
    const data = result.rows.map(r => {
      const d = new Date(r.date).toISOString().split('T')[0];
      return [
        d,
        r.student_id,
        r.student_name,
        r.section_name,
        r.subject_name,
        r.status,
        percentages[r.student_id].toFixed(2) + '%'
      ];
    });
    
    data.unshift(['Date', 'Student ID', 'Student Name', 'Section', 'Subject', 'Status', 'Attendance %']);
    
    const csvStr = stringify(data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.csv"');
    res.send(csvStr);
  } catch (error) {
    console.error('Error exporting CSV', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};

const exportExcel = async (req, res) => {
  try {
    const { text, values } = buildReportQuery(req.query, req.user.id);
    const result = await query(text, values);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');
    
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Student ID', key: 'student_id', width: 15 },
      { header: 'Student Name', key: 'student_name', width: 25 },
      { header: 'Section', key: 'section_name', width: 20 },
      { header: 'Subject', key: 'subject_name', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Attendance %', key: 'attendance_pct', width: 15 },
    ];
    
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }
    };
    
    const percentages = getStudentPercentages(result.rows);
    
    result.rows.forEach(r => {
      const d = new Date(r.date).toISOString().split('T')[0];
      const pct = percentages[r.student_id];
      const row = worksheet.addRow({
        date: d,
        student_id: r.student_id,
        student_name: r.student_name,
        section_name: r.section_name,
        subject_name: r.subject_name,
        status: r.status,
        attendance_pct: pct.toFixed(2) + '%'
      });
      
      if (pct < 75) {
          row.eachCell((cell) => {
              cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFCCCC' } // Light Red
              };
          });
      } else if (pct >= 90) {
          row.eachCell((cell) => {
              cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFCCFFCC' } // Light Green
              };
          });
      }
    });
    
    const totalRows = result.rows.length;
    const summaryRow = worksheet.addRow({
        date: 'Total Rows:',
        student_id: totalRows,
        student_name: '',
        section_name: '',
        subject_name: '',
        status: '',
        attendance_pct: ''
    });
    summaryRow.font = { bold: true };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.xlsx"');
    
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Excel', error);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
};

export { getReports, exportCSV, exportExcel };
