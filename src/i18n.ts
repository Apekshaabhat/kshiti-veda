import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Sensor Network": "Sensor Network",
      "Farm Health": "Farm Health",
      "Water & Irrigation": "Water & Irrigation",
      "Weather": "Weather",
      "Reports": "Reports",
      "Settings": "Settings",
      "Market": "Market",
      "Add Farm": "Add Farm",
      "Connected": "Connected",
      "Analytics": "Analytics",
      "Automation": "Automation"
    }
  },
  hi: {
    translation: {
      "Dashboard": "डैशबोर्ड",
      "Sensor Network": "सेंसर नेटवर्क",
      "Farm Health": "खेत का स्वास्थ्य",
      "Water & Irrigation": "सिंचाई",
      "Weather": "मौसम",
      "Reports": "रिपोर्ट्स",
      "Settings": "सेटिंग्स",
      "Market": "बाज़ार",
      "Add Farm": "खेत जोड़ें",
      "Connected": "जुड़ा हुआ",
      "Analytics": "विश्लेषण",
      "Automation": "स्वचालन"
    }
  },
  mr: {
    translation: {
      "Dashboard": "डॅशबोर्ड",
      "Sensor Network": "सेन्सर नेटवर्क",
      "Farm Health": "शेतीचे आरोग्य",
      "Water & Irrigation": "पाणी आणि सिंचन",
      "Weather": "हवामान",
      "Reports": "अहवाल",
      "Settings": "सेटिंग्ज",
      "Market": "बाजार",
      "Add Farm": "शेत जोडा",
      "Connected": "जोडलेले",
      "Analytics": "अॅनालिटिक्स",
      "Automation": "ऑटोमेशन"
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
      escapeValue: false
    }
  });

export default i18n;
