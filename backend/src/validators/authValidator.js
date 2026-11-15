const { ApiError } = require("../utils/apiResponse");
const { hasControlCharacters } = require("../utils/validationHelpers");

const PUBLIC_ACCOUNT_TYPES = ["PARENT_CAREGIVER", "PAYING_PARENT"];
const MAX_BCRYPT_BYTES = 72;

function validateRegistration(req, _res, next) {
  const { fullName, email, phone, password, confirmPassword, accountType } = req.body || {};
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 150 ||
      hasControlCharacters(fullName)) {
    return next(new ApiError(400, "Enter a valid full name (up to 150 characters)."));
  }
  if (typeof email !== "string" || email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return next(new ApiError(400, "Enter a valid email address."));
  }
  if (typeof phone !== "string" || phone.trim().length > 30 ||
      !/^\+?[0-9 ()-]{7,30}$/.test(phone.trim()) ||
      (phone.match(/[0-9]/g) || []).length < 7) {
    return next(new ApiError(400, "Enter a valid phone number."));
  }
  if (typeof password !== "string" || password.length < 10 ||
      Buffer.byteLength(password) > MAX_BCRYPT_BYTES ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return next(new ApiError(400, "Password must be at least 10 characters and include uppercase, lowercase and a number (maximum 72 bytes)."));
  }
  if (password !== confirmPassword) {
    return next(new ApiError(400, "Passwords do not match."));
  }
  // The submitted account type never selects the stored role; it only has to be one of the public choices.
  if (!PUBLIC_ACCOUNT_TYPES.includes(accountType)) {
    return next(new ApiError(400, "Select a valid account type."));
  }

  req.validated = {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    password,
  };
  return next();
}

function validateLogin(req, _res, next) {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" ||
      !email.trim() || email.length > 255 || !password ||
      Buffer.byteLength(password) > MAX_BCRYPT_BYTES) {
    return next(new ApiError(400, "Enter a valid email and password."));
  }
  req.validated = { email: email.trim().toLowerCase(), password };
  return next();
}

module.exports = { validateLogin, validateRegistration };
