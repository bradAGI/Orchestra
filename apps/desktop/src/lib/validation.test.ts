import { describe, expect, it } from 'vitest'
import {
  validateTaskTitle,
  validateTaskDescription,
  validateUrl,
  validateBaseUrl,
  validateProjectPath,
} from '@/lib/validation'

describe('validateTaskTitle', () => {
  it('returns error for empty title', () => {
    expect(validateTaskTitle('')).toBe('Title is required')
    expect(validateTaskTitle('   ')).toBe('Title is required')
  })

  it('returns error for too short title', () => {
    expect(validateTaskTitle('ab')).toBe('Title must be at least 3 characters')
  })

  it('returns error for too long title', () => {
    const long = 'a'.repeat(501)
    expect(validateTaskTitle(long)).toBe('Title must be under 500 characters')
  })

  it('returns empty string for valid title', () => {
    expect(validateTaskTitle('Fix the login page')).toBe('')
    expect(validateTaskTitle('abc')).toBe('')
  })
})

describe('validateTaskDescription', () => {
  it('returns error for too long description', () => {
    const long = 'x'.repeat(10001)
    expect(validateTaskDescription(long)).toBe('Description must be under 10,000 characters')
  })

  it('returns empty string for valid description', () => {
    expect(validateTaskDescription('A reasonable description')).toBe('')
  })

  it('returns empty string for empty description', () => {
    expect(validateTaskDescription('')).toBe('')
  })
})

describe('validateUrl', () => {
  it('returns empty string when URL is empty', () => {
    expect(validateUrl('')).toBe('')
    expect(validateUrl('   ')).toBe('')
  })

  it('returns empty string for valid URL', () => {
    expect(validateUrl('https://example.com')).toBe('')
    expect(validateUrl('http://localhost:3000/path')).toBe('')
  })

  it('returns error for invalid URL', () => {
    expect(validateUrl('not-a-url')).toBe('Must be a valid URL (e.g. https://example.com)')
  })
})

describe('validateBaseUrl', () => {
  it('returns error for empty URL', () => {
    expect(validateBaseUrl('')).toBe('Base URL is required')
    expect(validateBaseUrl('   ')).toBe('Base URL is required')
  })

  it('returns empty string for valid http URL', () => {
    expect(validateBaseUrl('http://127.0.0.1:4010')).toBe('')
  })

  it('returns empty string for valid https URL', () => {
    expect(validateBaseUrl('https://api.example.com')).toBe('')
  })

  it('returns error for invalid protocol', () => {
    expect(validateBaseUrl('ftp://example.com')).toBe('URL must use http or https')
  })

  it('returns error for invalid URL', () => {
    expect(validateBaseUrl('not-a-url')).toBe('Must be a valid URL (e.g. http://127.0.0.1:4010)')
  })
})

describe('validateProjectPath', () => {
  it('returns error for empty path', () => {
    expect(validateProjectPath('')).toBe('Path is required')
    expect(validateProjectPath('   ')).toBe('Path is required')
  })

  it('returns empty string for absolute unix path', () => {
    expect(validateProjectPath('/home/user/project')).toBe('')
  })

  it('returns empty string for absolute windows path', () => {
    expect(validateProjectPath('C:\\Users\\project')).toBe('')
  })

  it('returns error for relative path', () => {
    expect(validateProjectPath('relative/path')).toBe('Path must be absolute')
    expect(validateProjectPath('./local')).toBe('Path must be absolute')
  })
})
