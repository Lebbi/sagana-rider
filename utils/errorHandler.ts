// utils/errorHandler.ts
import Toast from 'react-native-toast-message';

/**
 * Provides user-friendly error messages for different error types
 */
export const getErrorMessage = (error: any): { title: string; message: string } => {
  // Network errors
  if (error.message === 'Network Error' || !error.response) {
    return {
      title: 'Connection Error',
      message: 'Please check your internet connection and try again',
    };
  }

  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;

  // HTTP status code based errors
  switch (status) {
    case 400:
      return {
        title: 'Invalid Request',
        message: serverMessage || 'The information provided is invalid. Please check and try again',
      };
    
    case 401:
      return {
        title: 'Authentication Required',
        message: 'Please log in to continue',
      };
    
    case 403:
      return {
        title: 'Access Denied',
        message: serverMessage || 'You don\'t have permission to perform this action',
      };
    
    case 404:
      return {
        title: 'Not Found',
        message: serverMessage || 'The requested information could not be found',
      };
    
    case 409:
      return {
        title: 'Conflict',
        message: serverMessage || 'This action conflicts with the current state',
      };
    
    case 422:
      return {
        title: 'Validation Error',
        message: serverMessage || 'Please check the information you provided',
      };
    
    case 429:
      return {
        title: 'Too Many Requests',
        message: 'You\'re doing that too often. Please wait a moment and try again',
      };
    
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        title: 'Server Error',
        message: 'Something went wrong on our end. Please try again later',
      };
    
    default:
      return {
        title: 'Error',
        message: serverMessage || 'Something went wrong. Please try again',
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
    text2: customMessage || errorMsg.message,
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
