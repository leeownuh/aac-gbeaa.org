const authService = require('../src/services/authService');

describe('Account Lockout Logic', () => {
  beforeEach(() => {
    authService.failedAttempts.clear();
    authService.lockedAccounts.clear();
  });

  test('should not lock account initially', () => {
    const isLocked = authService.isAccountLocked('testuser');
    expect(isLocked).toBe(false);
  });

  test('should lock account after max failed attempts', async () => {
    const ip = '127.0.0.1';
    const username = 'testuser';

    for (let i = 0; i < 5; i++) {
      await authService.recordFailedAttempt(username, ip, 'test-agent');
    }

    const isLocked = authService.isAccountLocked(username);
    expect(isLocked).toBe(true);
  });

  test('should clear failed attempts on successful login', async () => {
    const username = 'testuser';
    const ip = '127.0.0.1';

    await authService.recordFailedAttempt(username, ip, 'test-agent');
    await authService.recordFailedAttempt(username, ip, 'test-agent');
    
    authService.clearFailedAttempts(username);
    
    const isLocked = authService.isAccountLocked(username);
    expect(isLocked).toBe(false);
  });

  test('should track attempts by IP', async () => {
    const username = 'testuser';
    const ip1 = '127.0.0.1';
    const ip2 = '127.0.0.2';

    await authService.recordFailedAttempt(username, ip1, 'test-agent');
    await authService.recordFailedAttempt(username, ip2, 'test-agent');

    const attempts = authService.failedAttempts;
    let totalAttempts = 0;
    
    for (const [key] of attempts) {
      if (key.startsWith(username)) {
        totalAttempts++;
      }
    }

    expect(totalAttempts).toBe(2);
  });

  test('should unlock account after lockout duration', async () => {
    const username = 'lockeduser';
    
    authService.lockedAccounts.set(username, {
      unlockAt: new Date(Date.now() - 1000)
    });

    const isLocked = authService.isAccountLocked(username);
    expect(isLocked).toBe(false);
    expect(authService.lockedAccounts.has(username)).toBe(false);
  });
});