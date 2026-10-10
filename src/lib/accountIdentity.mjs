/**
 * Identity fields collected once during ElevationPilot account creation.
 * Do not infer DOB or gender from an invitee's name, team captain, or payment.
 */
export const ACCOUNT_GENDERS = Object.freeze(['Male', 'Female', 'Prefer not to say']);

export function validateAccountIdentity({ date_of_birth, gender }, today = new Date()) {
  const dob = String(date_of_birth || '').trim();
  const selectedGender = String(gender || '').trim();
  if (!dob) return 'Enter your date of birth.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Enter a valid date of birth.';
  const date = new Date(dob + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob ||
      Number(dob.slice(0, 4)) < 1900 ||
      dob > today.toISOString().slice(0, 10)) {
    return 'Enter a valid date of birth that is not in the future.';
  }
  if (!selectedGender) return 'Select your gender (or Prefer not to say).';
  if (!ACCOUNT_GENDERS.includes(selectedGender)) return 'Select a valid gender option.';
  return '';
}
