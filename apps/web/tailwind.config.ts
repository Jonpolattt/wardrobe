import type { Config } from 'tailwindcss';
import { webColors } from '@wardrobe/theme';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // ── RANG TIZIMI ──────────────────────────────────────────────────
      //
      // MUHIM: klass NOMLARI ataylab o'zgarmadi (`ink`, `cream`, `gold`).
      // Butun sayt bo'ylab ~yuzlab joyda `bg-white dark:bg-ink-950`,
      // `text-gold-600`, `border-ink-900/10` kabi yozuvlar bor — faqat shu
      // yerdagi QIYMATLARNI almashtirish bilan hamma sahifa va komponent
      // yangi uslubga o'tadi, birorta ham joylashuv/o'lcham/funksiyaga
      // tegmasdan.
      //
      // Har bir token qaysi rolni bajarishi (sayt kodida qanday
      // ishlatilishi) pastda yozilgan — kelajakda qiymat almashtirilganda
      // nimaga ta'sir qilishi shundan ko'rinadi.
      colors: {
        ink: {
          // Qorong'i rejimdagi SAHIFA/bo'lim foni (`dark:bg-ink-950`) va
          // yorug' rejimdagi sarlavha matni (`text-ink-950`). Bitta token
          // ikki rolda, lekin ular hech qachon bir vaqtda uchramaydi.
          950: webColors.ink[950],
          // Yorug' rejimdagi asosiy matn; shuningdek `border-ink-900/10`,
          // `bg-ink-900/5` kabi nozik chegara va yuzalar shu rangning
          // shaffof ulushlaridan hosil bo'ladi.
          900: webColors.ink[900],
          // Qorong'i rejimdagi KARTOCHKA/panel yuzasi (`.card-surface`
          // dark holati).
          800: webColors.ink[800],
          // Qorong'i rejimdagi input va qo'shimcha yuzalar.
          700: webColors.ink[700],
        },
        // Yorug' rejimdagi sahifa foni VA qorong'i rejimdagi asosiy matn —
        // #F8FAFC ikkala rolga ham mos (deyarli oq, lekin sof oq emas).
        cream: webColors.cream,
        // Saytning yagona aksent rangi. Avval yashil edi; endi ko'k
        // tizimi. Nom ("gold") tarixiy — o'zgartirilsa yuzlab faylga
        // tegishga to'g'ri kelardi, shuning uchun faqat qiymati yangilandi.
        //   600 — yorug' rejimdagi aksent matn/narx va hover holati
        //   500 — asosiy (primary): tugma, badge, faol nuqta
        //   400 — qorong'i rejimdagi aksent matn/narx (to'q fonda yorqin)
        gold: {
          400: webColors.gold[400],
          500: webColors.gold[500],
          600: webColors.gold[600],
        },
        // ── Holat ranglari ─────────────────────────────────────────────
        // Tailwind'ning tayyor `emerald`/`amber`/`red` shkalalari saytda
        // allaqachon ishlatilgan (muvaffaqiyat, ogohlantirish, xato).
        // `extend` chuqur birlashtirgani uchun quyida faqat AYNAN
        // ishlatilayotgan darajalar qayta belgilanadi — qolganlari
        // Tailwind'nikicha qolaveradi (masalan `bg-amber-50` kabi och
        // fonlar).
        //   *-600/700 → yorug' rejim uchun (to'qroq, oq fonda o'qiladi)
        //   *-400/300 → qorong'i rejim uchun (ochroq, to'q fonda o'qiladi)
        emerald: {
          300: webColors.emerald[300],
          400: webColors.emerald[400],
          500: webColors.emerald[500],
          600: webColors.emerald[600],
          700: webColors.emerald[700],
        },
        amber: {
          300: webColors.amber[300],
          400: webColors.amber[400],
          500: webColors.amber[500],
          600: webColors.amber[600],
          700: webColors.amber[700],
        },
        red: {
          300: webColors.red[300],
          400: webColors.red[400],
          500: webColors.red[500],
          600: webColors.red[600],
          700: webColors.red[700],
        },
      },
      fontFamily: {
        // `font-display` sayt bo'ylab SARLAVHALARDA ishlatiladi (20+ fayl),
        // faqat logotipda emas. Talabga ko'ra sarlavhalar ham Inter
        // bo'lishi kerak, shuning uchun bu ham Inter stekiga qaratildi.
        // WARDROBE logotipining serif ko'rinishi esa globals.css dagi
        // `.brand-wordmark` klassi orqali beriladi — o'sha yerda
        // `var(--font-display)` (Playfair Display, next/font orqali lokal
        // WOFF2 + font-display: swap) va Georgia zaxirasi turadi.
        display: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease forwards',
        marquee: 'marquee 26s linear infinite',
        float: 'float 6s ease-in-out infinite',
        // Slower, multi-directional drift for the hero's glow blobs — the
        // plain `float` above only bounces straight up/down and is quick
        // (6s), which reads as a bounce rather than a "gently floating"
        // effect. This instead wanders in both x and y over a much longer
        // loop, so it feels ambient rather than something you'd consciously
        // notice moving. Each blob is given a different duration/delay
        // inline (see page.tsx) so they drift out of sync with each other.
        'float-slow': 'floatSlow 20s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '33%': { transform: 'translate(22px, -26px)' },
          '66%': { transform: 'translate(-18px, 16px)' },
        },
      },
      boxShadow: {
        // Yumshoq, yengil soya — avval `0 20px 60px -20px rgba(0,0,0,0.25)`
        // edi (ancha kuchli va uzun). Yangi uslubda soya yuzani ajratish
        // uchun emas, faqat nozik ko'tarilish hissi uchun.
        soft: '0 8px 30px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
