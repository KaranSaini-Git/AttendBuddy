import { validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  next();
};

const loginValidation = [];
const studentValidation = [];
const teacherValidation = [];

export {
  validate,
  loginValidation,
  studentValidation,
  teacherValidation
};
