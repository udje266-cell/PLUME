import { describe, it, expect } from 'vitest';
import { calculateAge, isUserAgeAllowed } from './age';

describe('calculateAge', () => {
  it('should calculate age correctly', () => {
    const today = new Date();
    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
    const dateString = twentyYearsAgo.toISOString().split('T')[0];
    expect(calculateAge(dateString)).toBe(20);
  });

  it('should return 99 if birthDateString is undefined or invalid', () => {
    expect(calculateAge(undefined)).toBe(99);
    expect(calculateAge('invalid-date')).toBe(99);
  });
});

describe('isUserAgeAllowed', () => {
  it('should allow access to "all" rated stories for everyone', () => {
    expect(isUserAgeAllowed(10, 'all')).toBe(true);
    expect(isUserAgeAllowed(5, undefined)).toBe(true);
  });

  it('should restrict access appropriately for age rated stories', () => {
    expect(isUserAgeAllowed(11, '12')).toBe(false);
    expect(isUserAgeAllowed(12, '12')).toBe(true);
    expect(isUserAgeAllowed(15, '16')).toBe(false);
    expect(isUserAgeAllowed(16, '16')).toBe(true);
    expect(isUserAgeAllowed(17, '18')).toBe(false);
    expect(isUserAgeAllowed(18, '18')).toBe(true);
  });
});
