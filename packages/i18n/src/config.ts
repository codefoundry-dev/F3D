import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import navEn from './locales/en/nav.json';
import usersEn from './locales/en/users.json';
import dashboardEn from './locales/en/dashboard.json';
import validationEn from './locales/en/validation.json';
import projectsEn from './locales/en/projects.json';
import rfqsEn from './locales/en/rfqs.json';
import purchaseOrdersEn from './locales/en/purchaseOrders.json';
import bulkOrdersEn from './locales/en/bulkOrders.json';
import invoicesEn from './locales/en/invoices.json';
import emailsEn from './locales/en/emails.json';
import profileEn from './locales/en/profile.json';
import companyEn from './locales/en/company.json';
import errorsEn from './locales/en/errors.json';
import vendorsEn from './locales/en/vendors.json';
import vendorUsersEn from './locales/en/vendorUsers.json';
import rolesEn from './locales/en/roles.json';
import docExtractionsEn from './locales/en/docExtractions.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    nav: navEn,
    users: usersEn,
    dashboard: dashboardEn,
    validation: validationEn,
    projects: projectsEn,
    rfqs: rfqsEn,
    purchaseOrders: purchaseOrdersEn,
    bulkOrders: bulkOrdersEn,
    invoices: invoicesEn,
    emails: emailsEn,
    profile: profileEn,
    company: companyEn,
    errors: errorsEn,
    vendors: vendorsEn,
    vendorUsers: vendorUsersEn,
    roles: rolesEn,
    docExtractions: docExtractionsEn,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
