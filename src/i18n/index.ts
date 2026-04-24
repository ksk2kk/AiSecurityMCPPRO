import { Language, Translations, translations } from './translations';

export class I18nManager {
  private static instance: I18nManager;
  private currentLanguage: Language;
  private translations: Translations;
  
  private constructor() {
    this.currentLanguage = this.detectLanguage();
    this.translations = translations[this.currentLanguage];
  }
  
  static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }
  
  private detectLanguage(): Language {
    // 1. Check environment variables
    const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;
    if (envLang) {
      if (envLang.toLowerCase().startsWith('zh')) {
        return 'zh';
      }
      if (envLang.toLowerCase().startsWith('en')) {
        return 'en';
      }
    }
    
    // 2. Check timezone for Chinese regions
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const chineseTimezones = [
        'Asia/Shanghai',
        'Asia/Chongqing',
        'Asia/Harbin',
        'Asia/Urumqi',
        'Asia/Hong_Kong',
        'Asia/Macau',
        'Asia/Taipei',
        'Asia/Singapore'
      ];
      
      if (chineseTimezones.includes(timezone)) {
        return 'zh';
      }
    } catch {
      // Ignore timezone detection errors
    }
    
    // 3. Check system locale (browser-like Intl API)
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (locale && locale.toLowerCase().startsWith('zh')) {
        return 'zh';
      }
    } catch {
      // Ignore
    }
    
    // 4. Default to English if in doubt
    return 'en';
  }
  
  getLanguage(): Language {
    return this.currentLanguage;
  }
  
  setLanguage(language: Language): void {
    this.currentLanguage = language;
    this.translations = translations[language];
  }
  
  getTranslations(): Translations {
    return this.translations;
  }
  
  t(key: string): string {
    const parts = key.split('.');
    let value: unknown = this.translations;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  }
  
  format(template: string, ...args: unknown[]): string {
    return template.replace(/\{(\d+)\}/g, (_, index) => {
      const i = parseInt(index, 10);
      return args[i] !== undefined ? String(args[i]) : `{${index}}`;
    });
  }
  
  isChinese(): boolean {
    return this.currentLanguage === 'zh';
  }
  
  isEnglish(): boolean {
    return this.currentLanguage === 'en';
  }
  
  getSystemPromptLanguage(): string {
    return this.isChinese() ? 'zh' : 'en';
  }
  
  getTimezoneInfo(): { timezone: string; language: string } {
    let timezone = 'Unknown';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Ignore
    }
    
    return {
      timezone,
      language: this.currentLanguage
    };
  }
}

export function getI18n(): I18nManager {
  return I18nManager.getInstance();
}

export function t(key: string): string {
  return getI18n().t(key);
}

export function format(template: string, ...args: unknown[]): string {
  return getI18n().format(template, ...args);
}
