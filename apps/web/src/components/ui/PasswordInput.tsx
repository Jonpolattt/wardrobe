'use client';

import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Wraps a plain <input type="password"> with a show/hide toggle (eye icon).
// Forwards the ref and spreads the rest of react-hook-form's `register(...)`
// output directly onto the input, so call sites only need to swap
// `<input type="password" {...register(...)} />` for
// `<PasswordInput {...register(...)} />`.
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          {...props}
          className={className ?? 'w-full rounded-xl border border-ink-900/15 px-4 py-3 pr-11 text-sm outline-none focus:border-ink-950'}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-900/40 hover:text-ink-900/70 dark:text-cream/40 dark:hover:text-cream/70"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  },
);
