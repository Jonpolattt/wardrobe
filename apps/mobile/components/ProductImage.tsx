import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { imageUrl } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { Body, Skeleton } from './ui';
import { radius, typography } from '@wardrobe/theme';

interface ProductImageProps {
  src?: string | null;
  label?: string;
  style?: StyleProp<ViewStyle>;
  aspectRatio?: number;
}

export function ProductImage({
  src,
  label,
  style,
  aspectRatio = 0.75,
}: ProductImageProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const uri = imageUrl(src);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [uri]);

  return (
    <View style={[styles.container, { aspectRatio, backgroundColor: colors.input }, style]}>
      {uri && !failed ? (
        <>
          {!loaded && (
            <View style={StyleSheet.absoluteFill}>
              <Skeleton height="100%" />
            </View>
          )}
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
            accessibilityLabel={label}
            onLoadEnd={() => setLoaded(true)}
            onError={() => setFailed(true)}
            recyclingKey={uri}
          />
        </>
      ) : (
        <View
          accessibilityRole="image"
          accessibilityLabel={label}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <Body style={[styles.fallbackMark, { color: colors.mutedText }]}>W</Body>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: radius.card },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackMark: { fontFamily: typography.wordmark, fontSize: 40 },
});
