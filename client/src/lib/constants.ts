export const BILL_TYPES = ['חשמל', 'מים', 'גז', 'ארנונה', 'ועד בית', 'אינטרנט', 'טלוויזיה', 'ביטוח', 'אחר'];

export const BILL_STATUSES = {
  PAID: 'paid',
  WAITING: 'waiting',
  PARTIAL: 'partial'
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'חשמל': '#FFB74D',   // Amber
  'מים': '#4facfe',    // Blue
  'גז': '#FF416C',     // Reddish
  'ארנונה': '#A18CD1', // Purple
  'ועד בית': '#08A677',// Green
  'אינטרנט': '#2196f3',// Blue variant
  'טלוויזיה': '#ef4444',// Red
  'ביטוח': '#64748b',  // Slate
  'אחר': '#94a3b8'     // Slate light
};

export const BILL_ICONS: Record<string, string> = {
  'חשמל': '⚡', 'מים': '💧', 'גז': '🔥', 'ארנונה': '🏛️',
  'ועד בית': '🏢', 'אינטרנט': '🌐', 'טלוויזיה': '📺',
  'ביטוח': '🛡️', 'אחר': '📄',
};

export const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const APP_MESSAGES = {
  OCR_GENERIC_ERROR: 'שגיאה בעיבוד הקובץ — ניתן להזין נתונים ידנית',
  SAVE_ERROR: 'אירעה שגיאה בשמירת החשבון',
  LOGIN_ERROR: 'שגיאה בהתחברות. אנא בדוק את אמינות הפרטים שלך.',
  GENERIC_ERROR: 'אירעה שגיאה. אנא נסה/י שוב מאוחר יותר..',
};
