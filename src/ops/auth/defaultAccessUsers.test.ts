import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCESS_PASSWORD, DEFAULT_ACCESS_USERS } from './defaultAccessUsers';

describe('default access users', () => {
  it('includes every user shown in the access screenshot', () => {
    const emails = DEFAULT_ACCESS_USERS.map((user) => user.email);
    const coreUsers = [
      'shouq_ksa@trygc.com',
      'sara_ksa@trygc.com',
      'aljazi_ksa@trygc.com',
      'lamiaa@trygc.com',
      'm.tarek@trygc.com',
      'mahdi@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'shahd@trygc.com',
      'nada@trygc.com',
      'm.atia@trygc.com',
      'admin@trygc.com',
    ];
    coreUsers.forEach((email) => expect(emails).toContain(email));
    expect(emails.length).toBeGreaterThanOrEqual(coreUsers.length);
  });

  it('uses the requested default password and preserves master roles', () => {
    expect(DEFAULT_ACCESS_PASSWORD).toBe('Admin123');
    expect(DEFAULT_ACCESS_USERS.filter((user) => user.role === 'master').map((user) => user.email)).toEqual([
      'lamiaa@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'admin@trygc.com',
    ]);
  });

  it('assigns required offices for seeded access users', () => {
    expect(DEFAULT_ACCESS_USERS.every((user) => Boolean(user.office))).toBe(true);
    expect(DEFAULT_ACCESS_USERS.filter((user) => user.role === 'community').every((user) => user.office === 'KSA')).toBe(true);
    expect(DEFAULT_ACCESS_USERS.filter((user) => user.role !== 'community').every((user) => user.office === 'Egypt')).toBe(true);
  });
});
