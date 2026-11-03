// utils/errorHandler.ts
import Toast from 'react-native-toast-message';

import { t } from '@/lib/i18n';

/**
 * Provides user-friendly error messages for different error types
 */
export const getErrorMessage = (error: any): { title: string; message: string } => {
  // Network errors
  if (error.message === 'Network Error' || !error.response) {
    return {
      title: t("errors.connectionTitle"),
      message: t("errors.connection"),
    };
  }

  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;

  if (error.response?.data?.error === 'ACCOUNT_SUSPENDED') {
    const reason = error.response.data.reason;
    return {
      title: t("errors.suspendedTitle"),
      message: reason ? t("errors.suspendedReason", { reason }) : t("errors.suspended"),
    };
  }

  // HTTP status code based errors
  switch (status) {
    case 400:
      return {
        title: t("errors.invalidTitle"),
        message: serverMessage || t("errors.invalid"),
      };
    
    case 401:
      return {
        title: t("errors.authTitle"),
        message: t("errors.auth"),
      };
    
    case 403:
      return {
        title: t("errors.deniedTitle"),
        message: serverMessage || t("errors.denied"),
      };
    
    case 404:
      return {
        title: t("errors.notFoundTitle"),
        message: serverMessage || t("errors.notFound"),
      };
    
    case 409:
      return {
        title: t("errors.conflictTitle"),
        message: serverMessage || t("errors.conflict"),
      };
    
    case 422:
      return {
        title: t("errors.validationTitle"),
        message: serverMessage || t("errors.validation"),
      };
    
    case 429:
      return {
        title: t("errors.rateTitle"),
        message: t("errors.rate"),
      };
    
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        title: t("errors.serverTitle"),
        message: t("errors.server"),
      };
    
    default:
      return {
        title: t("common.error"),
        message: serverMessage || t("errors.generic"),
      };
  }
};

/**
 * Handle API errors with toast notifications
 */
export const handleApiError = (error: any, customMessage?: string) => {
  const errorMsg = getErrorMessage(error);
  
  Toast.show({
    type: 'error',
    text1: errorMsg.title,
    // A suspension's reason matters more than the screen's own failure text.
    text2: error?.response?.data?.error === 'ACCOUNT_SUSPENDED'
      ? errorMsg.message
      : customMessage || errorMsg.message,
    visibilityTime: 4000,
  });
};

/**
 * Handle API success with toast notifications
 */
export const handleApiSuccess = (title: string, message: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    visibilityTime: 3000,
  });
};
