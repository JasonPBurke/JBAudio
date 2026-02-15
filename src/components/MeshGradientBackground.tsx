import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import type {
  GradientColors,
  ArtworkColors,
} from '@/helpers/gradientColorSorter';
import { colorTokens } from '@/constants/tokens';

type MeshGradientBackgroundProps = {
  gradientColors: GradientColors;
  artworkColors: ArtworkColors | null;
};

const MeshGradientBackground = ({
  gradientColors,
  artworkColors,
}: MeshGradientBackgroundProps) => {
  // gradientColors mapping:
  // [0] = 2nd darkest, [1] = mid, [2] = lightest, [3] = darkest
  // const centerColor = artworkColors?.muted ?? gradientColors[1];
  const centerColor = artworkColors?.lightVibrant ?? gradientColors[1];

  return (
    <Svg style={StyleSheet.absoluteFillObject}>
      <Defs>
        {/* Upper-left radial blob */}
        <RadialGradient
          id='radialUL'
          cx='20%'
          cy='15%'
          rx='55%'
          ry='55%'
          fx='20%'
          fy='15%'
        >
          <Stop
            offset='0'
            stopColor={gradientColors[1]}
            stopOpacity='0.8'
          />
          <Stop offset='1' stopColor={gradientColors[1]} stopOpacity='0' />
        </RadialGradient>

        {/* Upper-right radial blob */}
        <RadialGradient
          id='radialUR'
          cx='80%'
          cy='25%'
          rx='50%'
          ry='50%'
          fx='80%'
          fy='25%'
        >
          <Stop
            offset='0'
            stopColor={gradientColors[2]}
            stopOpacity='0.7'
          />
          <Stop offset='1' stopColor={gradientColors[2]} stopOpacity='0' />
        </RadialGradient>

        {/* Center radial blob */}
        <RadialGradient
          id='radialCenter'
          cx='50%'
          cy='35%'
          rx='40%'
          ry='40%'
          fx='50%'
          fy='35%'
        >
          <Stop offset='0' stopColor={centerColor} stopOpacity='0.6' />
          <Stop offset='1' stopColor={centerColor} stopOpacity='0' />
        </RadialGradient>

        {/* Diagonal linear overlay — matches original gradient direction */}
        <LinearGradient
          id='diagonalOverlay'
          x1='0'
          y1='0'
          x2='50%'
          y2='100%'
        >
          <Stop
            offset='0'
            stopColor={gradientColors[0]}
            stopOpacity='0.15'
          />
          <Stop
            offset='0.5'
            stopColor={gradientColors[2]}
            stopOpacity='0.1'
          />
          <Stop
            offset='1'
            stopColor={gradientColors[3]}
            stopOpacity='0.2'
          />
        </LinearGradient>

        {/* Bottom dark fade — darkest color fading up ~40% from bottom */}
        <LinearGradient id='bottomFade' x1='0' y1='100%' x2='0' y2='0'>
          <Stop
            offset='0'
            stopColor={colorTokens.shared.darkText}
            stopOpacity='1'
          />
          <Stop
            offset='0.25'
            stopColor={colorTokens.shared.darkText}
            stopOpacity='0.7'
          />
          <Stop
            offset='0.4'
            stopColor={colorTokens.shared.darkText}
            stopOpacity='0'
          />
        </LinearGradient>
      </Defs>

      {/* Layer 1: Base fill */}
      <Rect width='100%' height='100%' fill={gradientColors[0]} />

      {/* Layer 2: Upper-left radial blob */}
      <Rect width='100%' height='100%' fill='url(#radialUL)' />

      {/* Layer 3: Upper-right radial blob */}
      <Rect width='100%' height='100%' fill='url(#radialUR)' />

      {/* Layer 4: Center radial blob for depth */}
      <Rect width='100%' height='100%' fill='url(#radialCenter)' />

      {/* Layer 5: Diagonal linear overlay */}
      <Rect width='100%' height='100%' fill='url(#diagonalOverlay)' />

      {/* Layer 6: Bottom dark fade */}
      <Rect width='100%' height='100%' fill='url(#bottomFade)' />
    </Svg>
  );
};

export default React.memo(MeshGradientBackground);
