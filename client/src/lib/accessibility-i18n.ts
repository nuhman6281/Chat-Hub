/**
 * Accessibility & Internationalization System
 * Comprehensive support for accessibility features and multi-language support
 */

export enum SupportedLanguage {
  ENGLISH = "en",
  SPANISH = "es",
  FRENCH = "fr",
  GERMAN = "de",
  ITALIAN = "it",
  PORTUGUESE = "pt",
  RUSSIAN = "ru",
  CHINESE_SIMPLIFIED = "zh-CN",
  CHINESE_TRADITIONAL = "zh-TW",
  JAPANESE = "ja",
  KOREAN = "ko",
  ARABIC = "ar",
  HINDI = "hi",
  DUTCH = "nl",
  SWEDISH = "sv",
}

export enum AccessibilityMode {
  NORMAL = "normal",
  HIGH_CONTRAST = "high_contrast",
  SCREEN_READER = "screen_reader",
  REDUCED_MOTION = "reduced_motion",
  LARGE_TEXT = "large_text",
  KEYBOARD_ONLY = "keyboard_only",
}

export interface AccessibilitySettings {
  mode: AccessibilityMode;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  audioDescriptions: boolean;
  captionsEnabled: boolean;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  colorBlindnessSupport: "none" | "protanopia" | "deuteranopia" | "tritanopia";
}

export interface LanguageSettings {
  primary: SupportedLanguage;
  fallback: SupportedLanguage;
  rtl: boolean;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  currencyFormat: string;
  timezone: string;
}

export interface TranslationKey {
  key: string;
  namespace: string;
  context?: string;
  pluralization?: boolean;
}

export interface Translation {
  key: string;
  language: SupportedLanguage;
  value: string;
  context?: string;
  pluralForms?: Record<string, string>;
  lastUpdated: Date;
}

export interface AccessibilityAudit {
  id: string;
  timestamp: Date;
  issues: AccessibilityIssue[];
  score: number;
  recommendations: string[];
}

export interface AccessibilityIssue {
  type: "error" | "warning" | "info";
  rule: string;
  description: string;
  element?: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  fix?: string;
}

class AccessibilityI18nService {
  private currentLanguage: SupportedLanguage = SupportedLanguage.ENGLISH;
  private accessibilitySettings: AccessibilitySettings;
  private languageSettings: LanguageSettings;
  private translations: Map<string, Map<SupportedLanguage, Translation>> =
    new Map();
  private rtlLanguages = new Set([SupportedLanguage.ARABIC]);

  constructor() {
    this.accessibilitySettings = this.getDefaultAccessibilitySettings();
    this.languageSettings = this.getDefaultLanguageSettings();
    this.loadTranslations();
    this.loadUserSettings();
    this.initializeAccessibility();
  }

  /**
   * Set current language
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    try {
      this.currentLanguage = language;
      this.languageSettings.primary = language;
      this.languageSettings.rtl = this.rtlLanguages.has(language);

      // Update document direction
      document.documentElement.dir = this.languageSettings.rtl ? "rtl" : "ltr";
      document.documentElement.lang = language;

      // Save to server
      await this.saveLanguageSettings();

      // Trigger language change event
      window.dispatchEvent(
        new CustomEvent("languageChanged", { detail: { language } })
      );
    } catch (error) {
      console.error("Failed to set language:", error);
      throw error;
    }
  }

  /**
   * Get translation
   */
  translate(
    key: string,
    options?: {
      namespace?: string;
      context?: string;
      variables?: Record<string, string | number>;
      count?: number;
    }
  ): string {
    const fullKey = options?.namespace ? `${options.namespace}.${key}` : key;
    const translationMap = this.translations.get(fullKey);

    if (!translationMap) {
      console.warn(`Translation not found for key: ${fullKey}`);
      return key;
    }

    let translation = translationMap.get(this.currentLanguage);

    // Fallback to default language
    if (!translation) {
      translation = translationMap.get(this.languageSettings.fallback);
    }

    if (!translation) {
      console.warn(
        `Translation not found for key: ${fullKey} in language: ${this.currentLanguage}`
      );
      return key;
    }

    let value = translation.value;

    // Handle pluralization
    if (options?.count !== undefined && translation.pluralForms) {
      const pluralKey = this.getPluralKey(options.count, this.currentLanguage);
      value = translation.pluralForms[pluralKey] || value;
    }

    // Replace variables
    if (options?.variables) {
      Object.entries(options.variables).forEach(([variable, replacement]) => {
        value = value.replace(
          new RegExp(`{{${variable}}}`, "g"),
          String(replacement)
        );
      });
    }

    return value;
  }

  /**
   * Update accessibility settings
   */
  async updateAccessibilitySettings(
    settings: Partial<AccessibilitySettings>
  ): Promise<void> {
    try {
      this.accessibilitySettings = {
        ...this.accessibilitySettings,
        ...settings,
      };

      // Apply settings to DOM
      this.applyAccessibilitySettings();

      // Save to server
      await this.saveAccessibilitySettings();

      // Trigger settings change event
      window.dispatchEvent(
        new CustomEvent("accessibilitySettingsChanged", {
          detail: { settings: this.accessibilitySettings },
        })
      );
    } catch (error) {
      console.error("Failed to update accessibility settings:", error);
      throw error;
    }
  }

  /**
   * Get current accessibility settings
   */
  getAccessibilitySettings(): AccessibilitySettings {
    return { ...this.accessibilitySettings };
  }

  /**
   * Get current language settings
   */
  getLanguageSettings(): LanguageSettings {
    return { ...this.languageSettings };
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Array<{
    code: SupportedLanguage;
    name: string;
    nativeName: string;
  }> {
    return [
      {
        code: SupportedLanguage.ENGLISH,
        name: "English",
        nativeName: "English",
      },
      {
        code: SupportedLanguage.SPANISH,
        name: "Spanish",
        nativeName: "Español",
      },
      {
        code: SupportedLanguage.FRENCH,
        name: "French",
        nativeName: "Français",
      },
      { code: SupportedLanguage.GERMAN, name: "German", nativeName: "Deutsch" },
      {
        code: SupportedLanguage.ITALIAN,
        name: "Italian",
        nativeName: "Italiano",
      },
      {
        code: SupportedLanguage.PORTUGUESE,
        name: "Portuguese",
        nativeName: "Português",
      },
      {
        code: SupportedLanguage.RUSSIAN,
        name: "Russian",
        nativeName: "Русский",
      },
      {
        code: SupportedLanguage.CHINESE_SIMPLIFIED,
        name: "Chinese (Simplified)",
        nativeName: "简体中文",
      },
      {
        code: SupportedLanguage.CHINESE_TRADITIONAL,
        name: "Chinese (Traditional)",
        nativeName: "繁體中文",
      },
      {
        code: SupportedLanguage.JAPANESE,
        name: "Japanese",
        nativeName: "日本語",
      },
      { code: SupportedLanguage.KOREAN, name: "Korean", nativeName: "한국어" },
      { code: SupportedLanguage.ARABIC, name: "Arabic", nativeName: "العربية" },
      { code: SupportedLanguage.HINDI, name: "Hindi", nativeName: "हिन्दी" },
      {
        code: SupportedLanguage.DUTCH,
        name: "Dutch",
        nativeName: "Nederlands",
      },
      {
        code: SupportedLanguage.SWEDISH,
        name: "Swedish",
        nativeName: "Svenska",
      },
    ];
  }

  /**
   * Format date according to current locale
   */
  formatDate(date: Date, format?: string): string {
    const locale = this.getLocaleString();
    const options = this.getDateFormatOptions(format);
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  /**
   * Format number according to current locale
   */
  formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    const locale = this.getLocaleString();
    return new Intl.NumberFormat(locale, options).format(number);
  }

  /**
   * Format currency according to current locale
   */
  formatCurrency(amount: number, currency: string = "USD"): string {
    const locale = this.getLocaleString();
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  }

  /**
   * Run accessibility audit
   */
  async runAccessibilityAudit(): Promise<AccessibilityAudit> {
    try {
      const response = await fetch("/api/accessibility/audit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to run accessibility audit");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to run accessibility audit:", error);
      throw error;
    }
  }

  /**
   * Add translation
   */
  async addTranslation(
    key: string,
    language: SupportedLanguage,
    value: string,
    options?: {
      namespace?: string;
      context?: string;
      pluralForms?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      const fullKey = options?.namespace ? `${options.namespace}.${key}` : key;

      const response = await fetch("/api/translations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          key: fullKey,
          language,
          value,
          context: options?.context,
          pluralForms: options?.pluralForms,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add translation");
      }

      // Update local cache
      if (!this.translations.has(fullKey)) {
        this.translations.set(fullKey, new Map());
      }

      this.translations.get(fullKey)!.set(language, {
        key: fullKey,
        language,
        value,
        context: options?.context,
        pluralForms: options?.pluralForms,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Failed to add translation:", error);
      throw error;
    }
  }

  /**
   * Enable screen reader mode
   */
  enableScreenReaderMode(): void {
    this.updateAccessibilitySettings({
      screenReaderOptimized: true,
      keyboardNavigation: true,
      focusIndicators: true,
      reducedMotion: true,
    });
  }

  /**
   * Enable high contrast mode
   */
  enableHighContrastMode(): void {
    this.updateAccessibilitySettings({
      highContrast: true,
      mode: AccessibilityMode.HIGH_CONTRAST,
    });
  }

  /**
   * Enable keyboard navigation
   */
  enableKeyboardNavigation(): void {
    this.updateAccessibilitySettings({
      keyboardNavigation: true,
      focusIndicators: true,
    });

    // Add keyboard event listeners
    this.setupKeyboardNavigation();
  }

  /**
   * Get default accessibility settings
   */
  private getDefaultAccessibilitySettings(): AccessibilitySettings {
    return {
      mode: AccessibilityMode.NORMAL,
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReaderOptimized: false,
      keyboardNavigation: false,
      focusIndicators: true,
      audioDescriptions: false,
      captionsEnabled: false,
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 0,
      colorBlindnessSupport: "none",
    };
  }

  /**
   * Get default language settings
   */
  private getDefaultLanguageSettings(): LanguageSettings {
    return {
      primary: SupportedLanguage.ENGLISH,
      fallback: SupportedLanguage.ENGLISH,
      rtl: false,
      dateFormat: "MM/dd/yyyy",
      timeFormat: "12h",
      numberFormat: "en-US",
      currencyFormat: "USD",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Apply accessibility settings to DOM
   */
  private applyAccessibilitySettings(): void {
    const root = document.documentElement;

    // Apply font size
    root.style.setProperty(
      "--base-font-size",
      `${this.accessibilitySettings.fontSize}px`
    );
    root.style.setProperty(
      "--line-height",
      String(this.accessibilitySettings.lineHeight)
    );
    root.style.setProperty(
      "--letter-spacing",
      `${this.accessibilitySettings.letterSpacing}em`
    );

    // Apply high contrast
    root.classList.toggle(
      "high-contrast",
      this.accessibilitySettings.highContrast
    );

    // Apply reduced motion
    root.classList.toggle(
      "reduced-motion",
      this.accessibilitySettings.reducedMotion
    );

    // Apply large text
    root.classList.toggle("large-text", this.accessibilitySettings.largeText);

    // Apply color blindness support
    root.classList.remove("protanopia", "deuteranopia", "tritanopia");
    if (this.accessibilitySettings.colorBlindnessSupport !== "none") {
      root.classList.add(this.accessibilitySettings.colorBlindnessSupport);
    }

    // Update meta viewport for accessibility
    if (this.accessibilitySettings.largeText) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0, maximum-scale=5.0"
        );
      }
    }
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    // Skip to main content
    const skipLink = document.createElement("a");
    skipLink.href = "#main-content";
    skipLink.textContent = "Skip to main content";
    skipLink.className = "skip-link";
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 9999;
      transition: top 0.3s;
    `;

    skipLink.addEventListener("focus", () => {
      skipLink.style.top = "6px";
    });

    skipLink.addEventListener("blur", () => {
      skipLink.style.top = "-40px";
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    // Keyboard shortcuts
    document.addEventListener(
      "keydown",
      this.handleKeyboardShortcuts.bind(this)
    );
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Alt + 1: Skip to main content
    if (event.altKey && event.key === "1") {
      event.preventDefault();
      const mainContent = document.getElementById("main-content");
      if (mainContent) {
        mainContent.focus();
      }
    }

    // Alt + 2: Skip to navigation
    if (event.altKey && event.key === "2") {
      event.preventDefault();
      const navigation = document.querySelector("nav");
      if (navigation) {
        navigation.focus();
      }
    }

    // Escape: Close modals/dropdowns
    if (event.key === "Escape") {
      const openModal = document.querySelector(
        '[role="dialog"][aria-hidden="false"]'
      );
      if (openModal) {
        const closeButton = openModal.querySelector('[aria-label="Close"]');
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
      }
    }
  }

  /**
   * Get plural key for language
   */
  private getPluralKey(count: number, language: SupportedLanguage): string {
    // Simplified pluralization rules
    if (language === SupportedLanguage.ENGLISH) {
      return count === 1 ? "one" : "other";
    }

    // Add more language-specific pluralization rules as needed
    return count === 1 ? "one" : "other";
  }

  /**
   * Get locale string for current language
   */
  private getLocaleString(): string {
    return this.currentLanguage;
  }

  /**
   * Get date format options
   */
  private getDateFormatOptions(format?: string): Intl.DateTimeFormatOptions {
    if (format === "short") {
      return { year: "numeric", month: "short", day: "numeric" };
    }
    if (format === "long") {
      return {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      };
    }
    return { year: "numeric", month: "numeric", day: "numeric" };
  }

  /**
   * Initialize accessibility features
   */
  private initializeAccessibility(): void {
    // Detect user preferences
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.accessibilitySettings.reducedMotion = true;
    }

    if (window.matchMedia("(prefers-contrast: high)").matches) {
      this.accessibilitySettings.highContrast = true;
    }

    // Apply initial settings
    this.applyAccessibilitySettings();

    // Listen for preference changes
    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", (e) => {
        this.updateAccessibilitySettings({ reducedMotion: e.matches });
      });

    window
      .matchMedia("(prefers-contrast: high)")
      .addEventListener("change", (e) => {
        this.updateAccessibilitySettings({ highContrast: e.matches });
      });
  }

  /**
   * Load translations from server
   */
  private async loadTranslations(): Promise<void> {
    try {
      const response = await fetch("/api/translations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const translations: Translation[] = await response.json();
        this.translations.clear();

        translations.forEach((translation) => {
          if (!this.translations.has(translation.key)) {
            this.translations.set(translation.key, new Map());
          }
          this.translations
            .get(translation.key)!
            .set(translation.language, translation);
        });
      }
    } catch (error) {
      console.error("Failed to load translations:", error);
    }
  }

  /**
   * Load user settings from server
   */
  private async loadUserSettings(): Promise<void> {
    try {
      const response = await fetch("/api/user/settings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const settings = await response.json();
        if (settings.accessibility) {
          this.accessibilitySettings = {
            ...this.accessibilitySettings,
            ...settings.accessibility,
          };
        }
        if (settings.language) {
          this.languageSettings = {
            ...this.languageSettings,
            ...settings.language,
          };
          this.currentLanguage = settings.language.primary;
        }
      }
    } catch (error) {
      console.error("Failed to load user settings:", error);
    }
  }

  /**
   * Save accessibility settings to server
   */
  private async saveAccessibilitySettings(): Promise<void> {
    try {
      await fetch("/api/user/settings/accessibility", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(this.accessibilitySettings),
      });
    } catch (error) {
      console.error("Failed to save accessibility settings:", error);
    }
  }

  /**
   * Save language settings to server
   */
  private async saveLanguageSettings(): Promise<void> {
    try {
      await fetch("/api/user/settings/language", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(this.languageSettings),
      });
    } catch (error) {
      console.error("Failed to save language settings:", error);
    }
  }
}

// Export singleton instance
export const accessibilityI18nService = new AccessibilityI18nService();
export default accessibilityI18nService;
