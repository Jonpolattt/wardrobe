// Xaridorning oxirgi qidiruv so'rovlari — faqat BRAUZERDA saqlanadi
// (localStorage), serverga hech narsa yuborilmaydi. Shu sababli hech
// qanday API, model yoki migratsiya kerak emas.
//
// localStorage maxfiy rejimda yoki sayt ma'lumotlari o'chirilganda
// xatolik berishi mumkin, shuning uchun har bir murojaat `try/catch`
// ichida: tarix ishlamasa ham qidiruvning o'zi normal ishlayveradi.

const STORAGE_KEY = 'wardrobe:search-history';
// Ro'yxatda shuncha so'nggi so'rov saqlanadi.
const MAX_ITEMS = 6;

export function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ehtiyot chorasi: qo'lda buzilgan ma'lumot sahifani sindirmasin.
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // jim o'tiladi — yuqoridagi izohga qarang
  }
  return list;
}

// Yangi so'rovni ro'yxat BOSHIGA qo'yadi. Takrorlanganda eski nusxasi
// olib tashlanadi (katta-kichik harf farqsiz), ya'ni bir xil so'rov
// ro'yxatni to'ldirib yubormaydi.
export function pushSearchHistory(query: string): string[] {
  const value = query.trim();
  if (typeof window === 'undefined' || value === '') return readSearchHistory();
  const lower = value.toLocaleLowerCase();
  const next = [value, ...readSearchHistory().filter((v) => v.toLocaleLowerCase() !== lower)].slice(0, MAX_ITEMS);
  return write(next);
}

export function removeSearchHistory(query: string): string[] {
  if (typeof window === 'undefined') return [];
  const lower = query.trim().toLocaleLowerCase();
  return write(readSearchHistory().filter((v) => v.toLocaleLowerCase() !== lower));
}

export function clearSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  return write([]);
}
