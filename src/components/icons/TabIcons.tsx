import React from 'react';
import {Circle, Path, Svg} from 'react-native-svg';

// Trazos tomados del set Lucide (licencia ISC, https://lucide.dev): copiamos las
// siete siluetas que usamos en vez de instalar el paquete entero, porque Metro
// no hace tree-shaking y un `import {Home} from 'lucide-react-native'` arrastra
// el índice de más de mil íconos al bundle.

export interface TabIconProps {
  color: string;
  size: number;
  focused: boolean;
}

const Base = ({
  color,
  size,
  focused,
  children,
}: TabIconProps & {children: React.ReactNode}): React.JSX.Element => (
  <Svg
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={focused ? 2.2 : 1.6}
    viewBox="0 0 24 24"
    width={size}>
    {children}
  </Svg>
);

const Inicio = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <Path d="M9.5 21v-6.5h5V21" />
  </Base>
);

const Explorar = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="m20 20-3.9-3.9" />
  </Base>
);

const Capturar = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z" />
    <Circle cx="12" cy="13" r="3.5" />
  </Base>
);

const Mapa = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Path d="M9 3 3 5.8v15L9 18l6 3 6-2.8v-15L15 6z" />
    <Path d="M9 3v15" />
    <Path d="M15 6v15" />
  </Base>
);

const Comunidad = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Path d="M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 18.5V20" />
    <Circle cx="9.5" cy="8" r="3.5" />
    <Path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
    <Path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6" />
  </Base>
);

const Guardados = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Path d="M18 21l-6-4.2L6 21V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5z" />
  </Base>
);

const Perfil = (props: TabIconProps): React.JSX.Element => (
  <Base {...props}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M5 20.5v-1A4.5 4.5 0 0 1 9.5 15h5a4.5 4.5 0 0 1 4.5 4.5v1" />
  </Base>
);

export const tabIcons = {
  Home: Inicio,
  Explorar,
  Capturar,
  Mapa,
  Comunidad,
  Guardados,
  Perfil,
} as const;
