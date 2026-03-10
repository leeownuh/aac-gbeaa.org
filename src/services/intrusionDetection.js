const logger = require('../utils/logger');
const authService = require('./authService');

class IntrusionDetectionService {
  constructor() {
    this.failedLoginsByIP = new Map();
    this.suspiciousPatterns = new Map();
    this.alertThresholds = {
      failedLogins: 20,
      rapidDeletes: 10,
      rapidUploads: 15
    };
    this.timeWindows = {
      failedLogins: 15 * 60 * 1000,
      rapidActions: 60 * 1000
    };
  }

  trackFailedLogin(ip, username) {
    const now = Date.now();
    const key = `login:${ip}`;
    
    let attempts = this.failedLoginsByIP.get(key) || [];
    attempts = attempts.filter(t => now - t < this.timeWindows.failedLogins);
    attempts.push(now);
    
    this.failedLoginsByIP.set(key, attempts);
    
    if (attempts.length >= this.alertThresholds.failedLogins) {
      this.triggerSecurityAlert('multiple_failed_logins', {
        ip,
        username,
        attempts: attempts.length,
        timeWindow: this.timeWindows.failedLogins
      });
    }
  }

  trackSuspiciousAction(actionType, details) {
    const now = Date.now();
    const key = `${actionType}:${details.userId || 'anonymous'}`;
    
    let actions = this.suspiciousPatterns.get(key) || [];
    actions = actions.filter(a => now - a.timestamp < this.timeWindows.rapidActions);
    actions.push({
      timestamp: now,
      ...details
    });
    
    this.suspiciousPatterns.set(key, actions);
    
    const threshold = this.alertThresholds[actionType] || 10;
    if (actions.length >= threshold) {
      this.triggerSecurityAlert(`rapid_${actionType}`, {
        userId: details.userId,
        count: actions.length,
        timeWindow: this.timeWindows.rapidActions
      });
    }
  }

  async triggerSecurityAlert(eventType, details) {
    const severity = this.determineSeverity(eventType);
    
    logger.error('Security alert triggered', {
      eventType,
      severity,
      ...details
    });

    await authService.logAudit('security_alert', eventType, null, null, {
      eventType,
      severity,
      ...details
    }, severity);
  }

  determineSeverity(eventType) {
    const criticalEvents = [
      'multiple_failed_logins',
      'account_lockout',
      'privilege_escalation'
    ];
    
    const errorEvents = [
      'rapid_deletes',
      'unauthorized_access',
      'data_tampering'
    ];
    
    if (criticalEvents.includes(eventType)) {
      return 'critical';
    }
    
    if (errorEvents.includes(eventType)) {
      return 'error';
    }
    
    return 'warning';
  }

  cleanup() {
    const now = Date.now();
    
    for (const [key, attempts] of this.failedLoginsByIP) {
      this.failedLoginsByIP.set(
        key,
        attempts.filter(t => now - t < this.timeWindows.failedLogins)
      );
    }
    
    for (const [key, actions] of this.suspiciousPatterns) {
      this.suspiciousPatterns.set(
        key,
        actions.filter(a => now - a.timestamp < this.timeWindows.rapidActions)
      );
    }
  }

  getStatistics() {
    const stats = {
      totalFailedLogins: 0,
      suspiciousIPs: [],
      activeAlerts: 0
    };
    
    for (const [key, attempts] of this.failedLoginsByIP) {
      stats.totalFailedLogins += attempts.length;
      if (attempts.length >= 5) {
        stats.suspiciousIPs.push(key.replace('login:', ''));
      }
    }
    
    for (const actions of this.suspiciousPatterns.values()) {
      if (actions.length >= 5) {
        stats.activeAlerts++;
      }
    }
    
    return stats;
  }
}

module.exports = new IntrusionDetectionService();