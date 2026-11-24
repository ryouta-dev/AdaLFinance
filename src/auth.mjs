export const people = {
  student: { username: 'student', password: 'market360', role: 'student', group: 'БУ-21', name: 'Аружан Сейіт' },
  student2: { username: 'student2', password: 'team360', role: 'student', group: 'БУ-21', name: 'Әли Нұрлан' },
  teacher: { username: 'teacher', password: 'adal360', role: 'teacher', group: 'БУ-21', name: 'Дана Әлиева' }
};

export function cookie(request, name) {
  return request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function setCookie(request, name, value, seconds) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

export async function digest(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

const scopePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function demoScope(request) {
  const existing = cookie(request, 'adal_demo');
  return scopePattern.test(existing ?? '') ? existing : crypto.randomUUID();
}

export function scopeFromGroup(group, classGroup) {
  if (group === classGroup) return '';
  if (!group.startsWith(classGroup + '/')) return null;
  const scope = group.slice(classGroup.length + 1);
  return scopePattern.test(scope) ? scope : null;
}

export async function signIn(db, request, user, scope = '') {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const duration = 43200;
  const now = Date.now();
  await db.prepare('DELETE FROM sessions WHERE expires <= ?').bind(now).run();
  const identity = scope ? user.username + '/' + scope : user.username;
  await db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await digest(token), identity, now + duration * 1000).run();
  const session = setCookie(request, 'adal_session', token, duration);
  return scope ? [session, setCookie(request, 'adal_demo', scope, 604800)] : session;
}

export async function currentUser(db, request) {
  const token = cookie(request, 'adal_session');
  if (!token || !/^[a-f0-9-]{72}$/.test(token)) return null;
  const row = await db.prepare('SELECT username FROM sessions WHERE token = ? AND expires > ?')
    .bind(await digest(token), Date.now()).first();
  if (!row) return null;
  const [name, scope] = row.username.split('/');
  const person = Object.hasOwn(people, name) ? people[name] : null;
  if (!person || !scope) return person;
  if (!scopePattern.test(scope)) return null;
  return { ...person, classGroup: person.group, group: person.group + '/' + scope };
}

export async function signOut(db, request) {
  const token = cookie(request, 'adal_session');
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await digest(token)).run();
  return setCookie(request, 'adal_session', '', 0);
}
