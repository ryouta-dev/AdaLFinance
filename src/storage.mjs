export const deserialize = row => ({ ...row, state: JSON.parse(row.state), config: JSON.parse(row.config) });

export async function userAttempts(db, user, group = user.role === 'teacher') {
  const column = group ? 'group_id' : 'owner';
  const rows = await db.prepare('SELECT * FROM attempts WHERE ' + column + ' = ? ORDER BY started_at DESC, id DESC')
    .bind(group ? user.group : user.username).all();
  return rows.results.map(deserialize);
}

export async function customCases(db, group) {
  const rows = await db.prepare('SELECT config FROM custom_cases WHERE group_id = ? ORDER BY created_at DESC').bind(group).all();
  return rows.results.map(row => JSON.parse(row.config));
}

export async function teamSubmissions(db, group) {
  const rows = await db.prepare('SELECT * FROM team_submissions WHERE group_id = ? ORDER BY recorded_at DESC, rowid DESC').bind(group).all();
  return rows.results.map(row => ({ ...row, answers: JSON.parse(row.answers) }));
}
