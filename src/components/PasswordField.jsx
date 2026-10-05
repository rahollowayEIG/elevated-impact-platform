import React, { useEffect, useId, useState } from 'react';

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.4A10.7 10.7 0 0 1 12 4c5.2 0 8.7 4.6 9.5 5.8a3.8 3.8 0 0 1 0 4.4c-.5.7-1.5 2.1-3 3.3M6.3 6.3C4.3 7.6 3 9.4 2.5 10.2a3.8 3.8 0 0 0 0 4.4C3.3 15.8 6.8 20 12 20c1.3 0 2.5-.3 3.6-.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 10.2C3.3 9 6.8 4 12 4s8.7 5 9.5 6.2a3.4 3.4 0 0 1 0 3.6C20.7 15 17.2 20 12 20s-8.7-5-9.5-6.2a3.4 3.4 0 0 1 0-3.6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PasswordField({
  label,
  id,
  inputRef,
  disabled = false,
  className = '',
  ...inputProps
}) {
  const generatedId = useId();
  const inputId = id || ('eig-password-' + generatedId.replace(/:/g, ''));
  const [visible, setVisible] = useState(false);
  const labelText = String(label || 'Password');

  useEffect(() => {
    if (disabled) setVisible(false);
  }, [disabled]);

  useEffect(() => {
    const hide = () => setVisible(false);
    const hideWhenBackgrounded = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hideWhenBackgrounded);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hideWhenBackgrounded);
    };
  }, []);

  return (
    <div className={['eig-password-field', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId}>{labelText}</label>
      <span className="eig-password-input-wrap">
        <input
          {...inputProps}
          id={inputId}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
        />
        <button
          type="button"
          className="eig-password-visibility"
          aria-label={(visible ? 'Hide ' : 'Show ') + labelText.toLowerCase()}
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
        >
          <EyeIcon visible={visible} />
        </button>
      </span>
    </div>
  );
}
