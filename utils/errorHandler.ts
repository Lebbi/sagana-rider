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
 * Preorder-specific error messages
 */
export const getPreorderErrorMessage = (error: any, action: 'create' | 'cancel' | 'fulfill' | 'update'): { title: string; message: string } => {
  const baseError = getErrorMessage(error);
  const serverMessage = error.response?.data?.message;

  // Check for specific preorder errors
  if (serverMessage) {
    if (serverMessage.includes('not eligible')) {
      return {
        title: 'Not Eligible',
        message: 'This product is not currently available for preorder',
      };
    }
    
    if (serverMessage.includes('harvest date')) {
      return {
        title: 'Invalid Date',
        message: 'The harvest date must be in the future',
      };
    }
    
    if (serverMessage.includes('cannot be cancelled')) {
      return {
        title: 'Cannot Cancel',
        message: 'This preorder cannot be cancelled at this time',
      };
    }
    
    if (serverMessage.includes('cannot be fulfilled')) {
      return {
        title: 'Cannot Fulfill',
        message: 'This preorder is not ready to be fulfilled yet',
      };
    }
    
    if (serverMessage.includes('stock')) {
      return {
        title: 'Insufficient Stock',
        message: 'Not enough stock available to fulfill this preorder',
      };
    }
  }

  // Action-specific fallback messages
  switch (action) {
    case 'create':
      return {
        title: baseError.title,
        message: serverMessage || 'Failed to place preorder. Please try again',
      };
    
    case 'cancel':
      return {
        title: baseError.title,
        message: serverMessage || 'Failed to cancel preorder. Please try again',
      };
    
    case 'fulfill':
      return {
        title: baseError.title,
        message: serverMessage || 'Failed to fulfill preorder. Please try again',
      };
    
    case 'update':
      return {
        title: baseError.title,
        message: serverMessage || 'Failed to update preorder. Please try again',
      };
    
    default:
      return baseError;
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
