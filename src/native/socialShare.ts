import {NativeModules} from 'react-native';

export type ShareTarget = 'instagram' | 'facebook' | 'chooser';

interface NativeSocialShare {
  shareToStory: (localPath: string) => Promise<ShareTarget>;
}

const getNativeModule = (): NativeSocialShare => {
  const module = NativeModules.SocialShare as NativeSocialShare | undefined;
  if (!module) {
    throw new Error('SocialShare native module is not registered');
  }
  return module;
};

// Comparte una foto local de un encuentro a Instagram/Facebook Stories (o a
// un selector genérico si ninguna app está instalada). Puramente cliente:
// no sube nada a un servidor propio.
export const shareEncuentroToStory = (localPath: string): Promise<ShareTarget> =>
  getNativeModule().shareToStory(localPath);
