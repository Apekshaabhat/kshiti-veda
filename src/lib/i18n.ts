import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
  en: {
    translation: {
      "dashboard.greeting": "Good morning",
      "dashboard.title": "Your farms are",
      "dashboard.title_highlight": "operating optimally",
      "dashboard.subtitle": "3 farms · 44.7 acres · last sync 2 seconds ago",
      "dashboard.export_report": "Export report",
      "dashboard.add_farm": "Add farm",
      "nav.dashboard": "Dashboard",
      "nav.sensors": "Sensors",
      "nav.crop_ai": "Crop AI",
      "nav.irrigation": "Irrigation",
      "nav.weather": "Weather",
      "nav.market": "Market Prices",
      "nav.expenses": "Expenses",
      "nav.analytics": "Analytics",
      "nav.devices": "Device Health",
      "nav.farm_health": "Farm Health",
      "nav.automation": "Automation",
      "nav.reports": "Reports",
      "nav.settings": "Settings",
    }
  },
  hi: {
    translation: {
      "dashboard.greeting": "सुप्रभात",
      "dashboard.title": "आपके खेत",
      "dashboard.title_highlight": "अनुकूल रूप से काम कर रहे हैं",
      "dashboard.subtitle": "३ खेत · ४४.७ एकड़ · अंतिम सिंक २ सेकंड पहले",
      "dashboard.export_report": "रिपोर्ट निर्यात करें",
      "dashboard.add_farm": "खेत जोड़ें",
      "nav.dashboard": "डैशबोर्ड",
      "nav.sensors": "सेंसर",
      "nav.crop_ai": "फसल AI",
      "nav.irrigation": "सिंचाई",
      "nav.weather": "मौसम",
      "nav.market": "बाजार भाव",
      "nav.expenses": "खर्च",
      "nav.analytics": "विश्लेषण",
      "nav.devices": "डिवाइस स्थिति",
      "nav.farm_health": "खेत का स्वास्थ्य",
      "nav.automation": "स्वचालन",
      "nav.reports": "रिपोर्ट",
      "nav.settings": "सेटिंग्स",
    }
  },
  mr: {
    translation: {
      "dashboard.greeting": "शुभ सकाळ",
      "dashboard.title": "तुमची शेते",
      "dashboard.title_highlight": "उत्तमरित्या काम करत आहेत",
      "dashboard.subtitle": "३ शेते · ४४.७ एकर · शेवटचे सिंक २ सेकंद पूर्वी",
      "dashboard.export_report": "अहवाल निर्यात करा",
      "dashboard.add_farm": "शेत जोडा",
      "nav.dashboard": "डॅशबोर्ड",
      "nav.sensors": "सेन्सर",
      "nav.crop_ai": "पीक AI",
      "nav.irrigation": "सिंचन",
      "nav.weather": "हवामान",
      "nav.market": "बाजार भाव",
      "nav.expenses": "खर्च",
      "nav.analytics": "विश्लेषण",
      "nav.devices": "डिव्हाइस स्थिती",
      "nav.farm_health": "शेतीचे आरोग्य",
      "nav.automation": "ऑटोमेशन",
      "nav.reports": "अहवाल",
      "nav.settings": "सेटिंग्ज",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('soilmatrix_lang') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
