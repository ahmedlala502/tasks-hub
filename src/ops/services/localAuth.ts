export type LocalAuthRole = 'master' | 'operations' | 'community';

export type LocalAuthUser = {
  uid: string;
  email: string;
  displayName: string;
  role: LocalAuthRole;
  createdAt: number;
};

type StoredLocalAuthUser = LocalAuthUser & {
  passwordHash: string;
  passwordSalt: string;
};

const USERS_KEY = 'trygc-local-auth-users';
const SESSION_KEY = 'trygc-local-auth-session';
const DEFAULT_ADMIN_EMAIL = 'admin@trygc.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

const saveStoredUsers = (users: StoredLocalAuthUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const normalizeRole = (role: unknown): LocalAuthRole => {
  if (role === 'master' || role === 'operations' || role === 'community') return role;
  if (role === 'admin') return 'master';
  return 'operations';
};

const getStoredUsers = (): StoredLocalAuthUser[] => {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];

    let changed = false;
    const normalized = parsed.map((user: StoredLocalAuthUser) => {
      const role = normalizeRole(user?.role);
      if (role !== user?.role) changed = true;
      return { ...user, role };
    });

    if (changed) saveStoredUsers(normalized);
    return normalized;
  } catch {
    localStorage.removeItem(USERS_KEY);
    return [];
  }
};

const toPublicUser = ({ passwordHash, passwordSalt, ...user }: StoredLocalAuthUser): LocalAuthUser => user;

const generateSalt = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const hashPassword = async (password: string, salt: string) => {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const localAuth = {
  defaultAdminEmail: DEFAULT_ADMIN_EMAIL,
  defaultAdminPassword: DEFAULT_ADMIN_PASSWORD,

  ensureDefaultUser: async () => {
    const users = getStoredUsers();
    if (users.some(user => user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL)) return;

    const passwordSalt = generateSalt();
    users.unshift({
      uid: 'local-admin',
      email: DEFAULT_ADMIN_EMAIL,
      displayName: 'Admin User',
      role: 'master',
      createdAt: Date.now(),
      passwordSalt,
      passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD, passwordSalt),
    });
    saveStoredUsers(users);
  },

  getSession: () => {
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) return null;
      const user = getStoredUsers().find(item => item.uid === sessionId);
      return user ? toPublicUser(user) : null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  listUsers: () => getStoredUsers().map(toPublicUser),

  signIn: async (email: string, password: string) => {
    await localAuth.ensureDefaultUser();
    const normalizedEmail = email.trim().toLowerCase();
    const user = getStoredUsers().find(item => item.email.toLowerCase() === normalizedEmail);
    if (!user) throw new Error('No local user found for that email.');

    const passwordHash = await hashPassword(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) throw new Error('Incorrect password.');

    localStorage.setItem(SESSION_KEY, user.uid);
    return toPublicUser(user);
  },

  signOut: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  createUser: async ({ name, email, password, role }: { name: string; email: string; password: string; role: LocalAuthRole }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getStoredUsers();
    if (users.some(user => user.email.toLowerCase() === normalizedEmail)) {
      throw new Error('A local user with this email already exists.');
    }

    const passwordSalt = generateSalt();
    const user: StoredLocalAuthUser = {
      uid: `local-${Date.now()}`,
      email: normalizedEmail,
      displayName: name.trim(),
      role,
      createdAt: Date.now(),
      passwordSalt,
      passwordHash: await hashPassword(password, passwordSalt),
    };

    users.push(user);
    saveStoredUsers(users);
    return toPublicUser(user);
  },

  removeUser: (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getStoredUsers();
    const nextUsers = users.filter(user => user.email.toLowerCase() !== normalizedEmail);
    saveStoredUsers(nextUsers);

    const currentSession = localStorage.getItem(SESSION_KEY);
    const removedCurrentUser = users.some(user => user.uid === currentSession && user.email.toLowerCase() === normalizedEmail);
    if (removedCurrentUser) localStorage.removeItem(SESSION_KEY);

    return nextUsers.map(toPublicUser);
  },
};
