"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nManager = void 0;
exports.getI18n = getI18n;
exports.t = t;
exports.format = format;
const translations_1 = require("./translations");
class I18nManager {
    static instance;
    currentLanguage;
    translations;
    constructor() {
        this.currentLanguage = this.detectLanguage();
        this.translations = translations_1.translations[this.currentLanguage];
    }
    static getInstance() {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }
        return I18nManager.instance;
    }
    detectLanguage() {
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
        }
        catch {
            // Ignore timezone detection errors
        }
        // 3. Check system locale (browser-like Intl API)
        try {
            const locale = Intl.DateTimeFormat().resolvedOptions().locale;
            if (locale && locale.toLowerCase().startsWith('zh')) {
                return 'zh';
            }
        }
        catch {
            // Ignore
        }
        // 4. Default to English if in doubt
        return 'en';
    }
    getLanguage() {
        return this.currentLanguage;
    }
    setLanguage(language) {
        this.currentLanguage = language;
        this.translations = translations_1.translations[language];
    }
    getTranslations() {
        return this.translations;
    }
    t(key) {
        const parts = key.split('.');
        let value = this.translations;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            }
            else {
                return key;
            }
        }
        return typeof value === 'string' ? value : key;
    }
    format(template, ...args) {
        return template.replace(/\{(\d+)\}/g, (_, index) => {
            const i = parseInt(index, 10);
            return args[i] !== undefined ? String(args[i]) : `{${index}}`;
        });
    }
    isChinese() {
        return this.currentLanguage === 'zh';
    }
    isEnglish() {
        return this.currentLanguage === 'en';
    }
    getSystemPromptLanguage() {
        return this.isChinese() ? 'zh' : 'en';
    }
    getTimezoneInfo() {
        let timezone = 'Unknown';
        try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        catch {
            // Ignore
        }
        return {
            timezone,
            language: this.currentLanguage
        };
    }
}
exports.I18nManager = I18nManager;
function getI18n() {
    return I18nManager.getInstance();
}
function t(key) {
    return getI18n().t(key);
}
function format(template, ...args) {
    return getI18n().format(template, ...args);
}
//# sourceMappingURL=index.js.map