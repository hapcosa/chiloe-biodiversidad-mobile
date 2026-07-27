import React from 'react';
import {requireNativeComponent, type ViewStyle} from 'react-native';

interface NativeCameraPreviewProps {
  sessionId: number;
  style?: ViewStyle;
}

const NativeCameraPreview = requireNativeComponent<NativeCameraPreviewProps>(
  'ChiloeCameraPreviewView',
);

interface CameraPreviewProps {
  sessionId: number;
  style?: ViewStyle;
}

export const CameraPreview = ({sessionId, style}: CameraPreviewProps): React.JSX.Element => (
  <NativeCameraPreview sessionId={sessionId} style={style} />
);
