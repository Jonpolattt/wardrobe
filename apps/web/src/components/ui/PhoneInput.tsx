'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';

const PREFIX = '+998 ';

// Controlled-ish phone input for the O'zbekiston format: the "+998 " prefix
// is permanently fixed (can't be deleted, selected-and-typed-over, or
// pasted over) and only the remaining 9 digits are editable. Every keystroke
// and paste is filtered down to digits only — nothing else (letters,
// symbols, extra "+") can ever land in the field, and the digit count is
// capped at 9 so a value like "+998123456789123" can never be typed in the
// first place.
//
// `value`/`onChange` here work in terms of the plain 9-digit string (no
// prefix, no spaces) — the component itself renders the "+998 XX XXX XX XX"
// display and does the plumbing. Kept close to a native <input> (forwardRef
// + spreadable props) so it drops into react-hook-form's `register()`-free
// controlled pattern used by the wizard below.
export interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
}

function formatDigits(digits: string) {
  // XX XXX XX XX grouping, built incrementally so partial input still looks
  // right while typing.
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, className, autoFocus, disabled, id, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

  function extractDigits(raw: string) {
    // Strip everything except digits, then drop a leading "998" if someone
    // pastes a full "+998901234567" / "998901234567" — keeps paste
    // convenient without letting the prefix itself be edited in place.
    let digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.startsWith('998')) digitsOnly = digitsOnly.slice(3);
    return digitsOnly.slice(0, 9);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const displayed = e.target.value;
    // The visible input always starts with PREFIX (see `value=` below); if
    // the user managed to delete part of it (e.g. selecting all + typing),
    // whatever remains after stripping non-digits is still just treated as
    // the 9-digit tail.
    const afterPrefix = displayed.startsWith(PREFIX) ? displayed.slice(PREFIX.length) : displayed;
    onChange(extractDigits(afterPrefix));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = innerRef.current;
    if (!el) return;
    // Block Backspace/Delete from ever eating into the "+998 " prefix.
    if ((e.key === 'Backspace' || e.key === 'Delete') && el.selectionStart !== null && el.selectionStart <= PREFIX.length && el.selectionEnd === el.selectionStart) {
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    onChange(extractDigits(pasted));
  }

  function moveCaretToEnd(target: HTMLInputElement) {
    // Always land the caret after the prefix, never inside/before it.
    const len = target.value.length;
    requestAnimationFrame(() => {
      target.setSelectionRange(len, len);
    });
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    moveCaretToEnd(e.target);
  }

  function handleClick(e: React.MouseEvent<HTMLInputElement>) {
    moveCaretToEnd(e.currentTarget);
  }

  return (
    <input
      ref={innerRef}
      id={id}
      type="tel"
      inputMode="numeric"
      autoFocus={autoFocus}
      disabled={disabled}
      value={PREFIX + formatDigits(value)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onClick={handleClick}
      className={className ?? 'w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950'}
      {...rest}
    />
  );
});
