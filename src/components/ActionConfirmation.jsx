import React, { useEffect, useRef, useState } from 'react';
import { ACTION_CONFIRMATION_EVENT, isActionSuccessText } from '../lib/successNotice.mjs';

const EXISTING_NOTICE_SELECTOR = '.platform-success, .message, .ia-notice, .sm-notice, .eig-state-notice, [role="status"]';
const AUTO_DISMISS_MS = 11000;

/**
 * One shared confirmation for the entire ElevationPilot app, including its
 * independently rendered Airport, Cockpit, ATC, roster, and studio screens.
 * Its fixed placement makes scrolling to a message unnecessary.
 */
export default function ActionConfirmation() {
  const [notice, setNotice] = useState(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return undefined;

    const lastByNode = new WeakMap();
    let latestText = '';
    let latestTime = 0;

    function publish(message) {
      const text = String(message || '').replace(/\s+/g, ' ').trim();
      if (!isActionSuccessText(text)) return;
      const now = Date.now();
      // A newly rendered inline notice and an explicit success event can
      // arrive together. Announce them once without hiding later saves.
      if (text === latestText && now - latestTime < 1600) return;
      latestText = text;
      latestTime = now;
      sequence.current += 1;
      setNotice({ id: sequence.current, text });
    }

    function inspectNotice(el) {
      if (!(el instanceof Element) || !el.isConnected ||
          el.closest('[data-eig-action-confirmation]') ||
          el.closest('.platform-error, .eig-state-error, [role="alert"]') ||
          !el.getClientRects().length) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || lastByNode.get(el) === text) return;
      lastByNode.set(el, text);
      publish(text);
    }

    function inspectNode(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.closest('[data-eig-action-confirmation]')) return;
      if (el.matches(EXISTING_NOTICE_SELECTOR)) inspectNotice(el);
      el.querySelectorAll(EXISTING_NOTICE_SELECTOR).forEach(inspectNotice);
    }

    function onMutations(records) {
      for (const record of records) {
        const parent = record.target.nodeType === Node.ELEMENT_NODE
          ? record.target : record.target.parentElement;
        // A changed text node can update a notice without replacing it.
        const existing = parent?.closest?.(EXISTING_NOTICE_SELECTOR);
        if (existing) inspectNotice(existing);
        if (record.type === 'childList') {
          record.addedNodes.forEach(inspectNode);
        }
      }
    }

    function onExplicitSuccess(event) {
      publish(event.detail?.message);
    }

    const observer = new MutationObserver(onMutations);
    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.addEventListener(ACTION_CONFIRMATION_EVENT, onExplicitSuccess);
    // Covers an existing success banner if the host mounts during a page update.
    document.querySelectorAll(EXISTING_NOTICE_SELECTOR).forEach(inspectNotice);
    return () => {
      observer.disconnect();
      window.removeEventListener(ACTION_CONFIRMATION_EVENT, onExplicitSuccess);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!notice) return null;
  return (
    <div className="eig-confirmation-layer" data-eig-action-confirmation="true">
      <section className="eig-confirmation-card" role="status" aria-live="polite" aria-atomic="true">
        <div className="eig-confirmation-symbol" aria-hidden="true">✓</div>
        <div className="eig-confirmation-body">
          <strong className="eig-confirmation-heading">Action completed</strong>
          <p>{notice.text}</p>
        </div>
        <button type="button" className="eig-confirmation-close" aria-label="Dismiss confirmation" onClick={() => setNotice(null)}>×</button>
      </section>
    </div>
  );
}
