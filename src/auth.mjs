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

export async function signIn(db, request, user) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const duration = 43200;
  const now = Date.now();
  await db.prepare('DELETE FROM sessions WHERE expires <= ?').bind(now).run();
  await db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await digest(token), user.username, now + duration * 1000).run();
  return setCookie(request, 'adal_session', token, duration);
}

export async function currentUser(db, request) {
  const token = cookie(request, 'adal_session');
  if (!token || !/^[a-f0-9-]{72}$/.test(token)) return null;
  const row = await db.prepare('SELECT username FROM sessions WHERE token = ? AND expires > ?')
    .bind(await digest(token), Date.now()).first();
  return row && people[row.username];
}

export async function signOut(db, request) {
  const token = cookie(request, 'adal_session');
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await digest(token)).run();
  return setCookie(request, 'adal_session', '', 0);
}
