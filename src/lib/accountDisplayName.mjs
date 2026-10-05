const text = (value) => typeof value === 'string' ? value.trim() : '';

// Labels are presentation only. Account IDs remain the relationship keys.
export function accountDisplayName(user) {
  const profile = user?.profile || {};
  return text(profile.display_name)
    || [text(profile.first_name), text(profile.last_name)].filter(Boolean).join(' ')
    || (text(profile.username) ? '@' + text(profile.username).replace(/^@/, '') : '')
    || 'ElevationPilot User';
}
