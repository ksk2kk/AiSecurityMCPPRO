import { Language, Translations } from './translations';
export declare class I18nManager {
    private static instance;
    private currentLanguage;
    private translations;
    private constructor();
    static getInstance(): I18nManager;
    private detectLanguage;
    getLanguage(): Language;
    setLanguage(language: Language): void;
    getTranslations(): Translations;
    t(key: string): string;
    format(template: string, ...args: unknown[]): string;
    isChinese(): boolean;
    isEnglish(): boolean;
    getSystemPromptLanguage(): string;
    getTimezoneInfo(): {
        timezone: string;
        language: string;
    };
}
export declare function getI18n(): I18nManager;
export declare function t(key: string): string;
export declare function format(template: string, ...args: unknown[]): string;
//# sourceMappingURL=index.d.ts.map