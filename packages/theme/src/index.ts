// Existing web palette, extracted without changing color values.
export const webColors = {
        ink: {
          // Qorong'i rejimdagi SAHIFA/bo'lim foni (`dark:bg-ink-950`) va
          // yorug' rejimdagi sarlavha matni (`text-ink-950`). Bitta token
          // ikki rolda, lekin ular hech qachon bir vaqtda uchramaydi.
          950: '#07111C',
          // Yorug' rejimdagi asosiy matn; shuningdek `border-ink-900/10`,
          // `bg-ink-900/5` kabi nozik chegara va yuzalar shu rangning
          // shaffof ulushlaridan hosil bo'ladi.
          900: '#111827',
          // Qorong'i rejimdagi KARTOCHKA/panel yuzasi (`.card-surface`
          // dark holati).
          800: '#0D1826',
          // Qorong'i rejimdagi input va qo'shimcha yuzalar.
          700: '#101C2A',
        },
        // Yorug' rejimdagi sahifa foni VA qorong'i rejimdagi asosiy matn —
        // #F8FAFC ikkala rolga ham mos (deyarli oq, lekin sof oq emas).
        cream: '#F8FAFC',
        // Saytning yagona aksent rangi. Avval yashil edi; endi ko'k
        // tizimi. Nom ("gold") tarixiy — o'zgartirilsa yuzlab faylga
        // tegishga to'g'ri kelardi, shuning uchun faqat qiymati yangilandi.
        //   600 — yorug' rejimdagi aksent matn/narx va hover holati
        //   500 — asosiy (primary): tugma, badge, faol nuqta
        //   400 — qorong'i rejimdagi aksent matn/narx (to'q fonda yorqin)
        gold: {
          400: '#61C4FF',
          500: '#465FFF',
          600: '#354DE6',
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
          300: '#7CE7BA',
          400: '#56DBA2',
          500: '#147B4A',
          600: '#147B4A',
          700: '#0F5F39',
        },
        amber: {
          300: '#FFC583',
          400: '#FFAE56',
          500: '#A64B00',
          600: '#A64B00',
          700: '#8A3E00',
        },
        red: {
          300: '#FFB0B6',
          400: '#FF8C94',
          500: '#BD243B',
          600: '#BD243B',
          700: '#9C1B2F',
        },
      } as const;

export const brand = {
  name: 'Wardrobe Store',
  wordmark: 'Wardrobe',
  uiFont: 'Inter',
  wordmarkFont: 'Playfair Display',
} as const;

// Native logical pixels mirror the existing Tailwind four-pixel scale.
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 48,
} as const;

export const radius = {
  button: 5,
  headerControl: 10,
  card: 16,
  pill: 999,
} as const;

export const themeColors = {
  light: {
    background: webColors.cream,
    surface: '#ffffff',
    header: '#ffffff',
    input: '#f1f5f9',
    text: webColors.ink[950],
    bodyText: webColors.ink[900],
    mutedText: 'rgba(17, 24, 39, 0.55)',
    border: '#e2e8f0',
    accent: webColors.gold[500],
    accentText: webColors.gold[600],
    onAccent: '#ffffff',
    success: webColors.emerald[600],
    warning: webColors.amber[600],
    danger: webColors.red[600],
  },
  dark: {
    background: webColors.ink[950],
    surface: webColors.ink[800],
    header: webColors.ink[950],
    input: webColors.ink[700],
    text: webColors.cream,
    bodyText: webColors.cream,
    mutedText: 'rgba(248, 250, 252, 0.6)',
    border: 'rgba(148, 163, 184, 0.18)',
    accent: webColors.gold[500],
    accentText: webColors.gold[400],
    onAccent: '#ffffff',
    success: webColors.emerald[400],
    warning: webColors.amber[400],
    danger: webColors.red[400],
  },
} as const;

export type ThemeMode = keyof typeof themeColors;
export type ThemeColors = (typeof themeColors)[ThemeMode];
