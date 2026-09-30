'use client';

import { create } from 'zustand';

export type RegisterStep = 'phone' | 'otp' | 'details' | 'confirm';

export interface RegisterDetailsForm {
  firstName: string;
  lastName: string;
  // Ro'yxatdan o'tishda endi so'ralmaydi (faqat telefon raqami bilan) —
  // ixtiyoriy qilib qoldirildi, chunki eskiroq brauzerda saqlanib qolgan
  // (persist) holatda bu maydon hali ham bo'lishi mumkin.
  email?: string;
  password: string;
  confirmPassword: string;
  // Manzil birinchi buyurtmada so'raladi, ro'yxatdan o'tishda emas.
  address?: string;
}

interface RegisterWizardState {
  step: RegisterStep;
  phoneDigits: string;
  otpCode: string;
  details: RegisterDetailsForm | null;
  setStep: (step: RegisterStep) => void;
  setPhoneDigits: (value: string) => void;
  setOtpCode: (value: string) => void;
  setDetails: (value: RegisterDetailsForm | null) => void;
  reset: () => void;
}

const initialState = {
  step: 'phone' as RegisterStep,
  phoneDigits: '',
  otpCode: '',
  details: null as RegisterDetailsForm | null,
};

// WHY THIS EXISTS: the register wizard (phone -> SMS OTP -> details ->
// confirm) used to keep its step/phoneDigits/otpCode/details in plain
// useState inside RegisterPage. That broke the moment someone switched
// language (uz/ru) mid-flow: the language switcher navigates from
// /uz/register to /ru/register, and because `locale` is a *layout*-level
// dynamic segment (the root layout itself lives at app/[locale]/layout.tsx,
// wrapping <html>/<body>), Next.js treats the two locales as distinct
// static routes and fully remounts everything under that layout — including
// RegisterPage — instead of just re-rendering it with a new `locale` prop.
// A fresh mount means useState re-initializes to its default, so a user who
// had already received their SMS code and was sitting on the OTP screen got
// silently bounced back to the phone-entry screen, with the code they'd
// typed (and the phone number itself) gone.
//
// A Zustand store defined at module scope isn't part of that component
// tree, so it isn't torn down and rebuilt when the tree remounts — the
// store object just keeps living in memory, and RegisterPage picks up
// exactly where it left off after the remount. Deliberately NOT using
// zustand's `persist` middleware (no localStorage): this only needs to
// survive an in-memory remount, not a real page reload/new tab, and OTP
// codes/passwords have no business sitting in localStorage.
export const useRegisterWizardStore = create<RegisterWizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setPhoneDigits: (phoneDigits) => set({ phoneDigits }),
  setOtpCode: (otpCode) => set({ otpCode }),
  setDetails: (details) => set({ details }),
  reset: () => set(initialState),
}));
