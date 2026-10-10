/**
 * Shared, read-only success notification bridge.
 * Legacy screens can retain their existing inline notices; the app-wide
 * announcer also observes those notices and displays them in the viewport.
 * New flows should call announceActionComplete after the server confirms.
 */
export const ACTION_CONFIRMATION_EVENT = 'eig:action-confirmation';

const ERROR_WORDS = /\b(?:unable|failed|failure|error|could not|cannot|can't|not saved|not sent|not delivered|needs attention|invalid|expired|blocked|unsaved|a reason is required)\b/i;
const ERROR_PREFIX = /^(?:enter\b|choose\b|select\b|please\b|preparing\b|loading\b|missing\b|a .+ is required\b)/i;
const SUCCESS_WORDS = /\b(?:saved|created|updated|synced|synchronized|imported|uploaded|downloaded|copied|sent|delivered|confirmed|approved|published|registered|claimed|completed|added|removed|refreshed|reopened|restored|connected|transferred|processed|withdrawn|submitted|opened)\b/i;
const READY_WORDS = /\b(?:account|roster|sheet|workbook|registration|event|packet|draft)\b.{0,48}\bready\b/i;

export function isActionSuccessText(value) {
  if (typeof value !== 'string') return false;
  const message = value.replace(/\s+/g, ' ').trim();
  if (!message || message.length > 750 || ERROR_WORDS.test(message) || ERROR_PREFIX.test(message)) return false;
  return SUCCESS_WORDS.test(message) || READY_WORDS.test(message);
}

export function announceActionComplete(message) {
  if (!isActionSuccessText(message) || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(ACTION_CONFIRMATION_EVENT, {
    detail: { message: message.replace(/\s+/g, ' ').trim() },
  }));
  return true;
}
