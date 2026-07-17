import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {appConfig} from '../config/appConfig';

let configured = false;

export const configureGoogleSignIn = (): void => {
  if (configured || appConfig.googleWebClientId.trim() === '') {
    return;
  }

  GoogleSignin.configure({
    webClientId: appConfig.googleWebClientId,
    offlineAccess: false,
  });
  configured = true;
};

export const requestGoogleIdToken = async (): Promise<string> => {
  configureGoogleSignIn();

  if (appConfig.googleWebClientId.trim() === '') {
    throw new Error('Google Sign-In no está configurado');
  }

  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

  try {
    const userInfo = await GoogleSignin.signIn();
    const token =
      'data' in userInfo && userInfo.data
        ? userInfo.data.idToken
        : (userInfo as {idToken?: string}).idToken;

    if (!token) {
      throw new Error('Google no devolvió idToken');
    }

    return token;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      throw new Error('Inicio con Google cancelado');
    }

    throw error;
  }
};

