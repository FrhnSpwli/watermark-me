const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string) {
  if (!email.trim()) {
    return 'Email is required.'
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Enter a valid email address.'
  }

  return null
}

export function validatePassword(password: string) {
  if (!password) {
    return 'Password is required.'
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters.'
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter, and a number.'
  }

  return null
}
