const authService = require('../src/services/authService');

describe('AuthService role handling', () => {
  test('accepts supported roles and legacy aliases', () => {
    expect(authService.validateRole('super')).toBe('super');
    expect(authService.validateRole('editor')).toBe('editor');
    expect(authService.validateRole('moderator')).toBe('moderator');
    expect(authService.validateRole('admin')).toBe('super');
    expect(authService.validateRole('viewer')).toBe('moderator');
  });

  test('rejects unknown roles instead of silently assigning privileges', () => {
    expect(() => authService.validateRole('owner')).toThrow('Invalid role');
    expect(() => authService.validateRole('user')).toThrow('Invalid role');
    expect(() => authService.validateRole('')).toThrow('Invalid role');
  });
});
