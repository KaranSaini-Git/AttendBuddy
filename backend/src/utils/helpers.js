import crypto from 'node:crypto';

const generateTempPassword = () => {
  return crypto.randomBytes(4).toString('hex');
};

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculatePercentage = (present, total) => {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
};

export { generateTempPassword, formatDate, calculatePercentage };
