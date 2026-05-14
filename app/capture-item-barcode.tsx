import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BigButton } from '@/components/BigButton';
import { useCaptureStore } from '@/services/captureStore';
import {
  lookupBarcode,
  OpenFoodFactsError,
} from '@/services/openFoodFactsService';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { Direction } from '@/types/models';

const SUPPORTED_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

export default function CaptureItemBarcodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ direction?: string }>();
  const direction: Direction = params.direction === 'OUT' ? 'OUT' : 'IN';
  const stageItemDraft = useCaptureStore(s => s.stageItemDraft);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  // Two refs so we hard-debounce: scannedRef.current is true the instant a
  // first valid scan fires, so the rapid follow-up callbacks expo-camera
  // emits get ignored before they trigger anything else.
  const scannedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const goPhoto = useCallback(() => {
    router.replace({ pathname: '/capture-item-photo', params: { direction } });
  }, [direction, router]);

  const goManual = useCallback(
    (barcode?: string, lookupNote?: string) => {
      stageItemDraft({
        imageUri: null,
        direction,
        source: 'manual',
        barcode,
        lookupNote,
        parsed: {
          manufacturer: null,
          name: '',
          category: null,
          containerType: null,
          size: null,
        },
      });
      router.replace('/confirm-item');
    },
    [direction, router, stageItemDraft],
  );

  const handleScanned = useCallback(
    async ({ data, type }: { data: string; type: string }) => {
      if (scannedRef.current || !aliveRef.current) return;
      scannedRef.current = true;
      setScanning(false);
      setBusy(true);
      setStatusText(`Looking up product… (${type})`);

      try {
        const outcome = await lookupBarcode(data);
        if (!aliveRef.current) return;
        stageItemDraft({
          imageUri: null,
          direction,
          parsed: outcome.parsed,
          source: 'barcode',
          barcode: outcome.barcode,
          rawLookupJson: outcome.rawLookupJson,
        });
        router.replace('/confirm-item');
      } catch (err) {
        if (!aliveRef.current) return;
        const note =
          err instanceof OpenFoodFactsError
            ? err.kind === 'not_found' || err.kind === 'empty'
              ? `Barcode ${data} isn't in Open Food Facts. Fill in the details below.`
              : `Lookup failed (${err.kind}). You can fill in the details below or try a photo.`
            : `Lookup failed. You can fill in the details below or try a photo.`;
        // Route to confirm-item so the user can finish manually — never strand
        // them on the scanner screen with no path forward.
        goManual(data, note);
      } finally {
        if (aliveRef.current) {
          setBusy(false);
          setStatusText(null);
        }
      }
    },
    [direction, goManual, router, stageItemDraft],
  );

  if (!permission) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.title}>Camera permission needed</Text>
          <Text style={styles.subtitle}>
            Scanning a barcode uses the camera. You can also take a photo or
            enter the item manually.
          </Text>
          <BigButton label="Grant camera permission" variant="primary" onPress={() => requestPermission()} />
          <BigButton label="Take a photo instead" variant="secondary" onPress={goPhoto} />
          <BigButton label="Enter manually" variant="ghost" onPress={() => goManual()} />
          <BigButton label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan barcode</Text>
        <Text style={styles.subtitle}>Point at the product barcode.</Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning && !busy ? handleScanned : undefined}
          barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODES] }}
        />
        <View pointerEvents="none" style={styles.reticle} />
      </View>

      {busy ? (
        <View style={styles.busyBar}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.busyText}>{statusText ?? 'Looking up product…'}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <BigButton label="Take a photo instead" variant="secondary" onPress={goPhoto} disabled={busy} />
        <BigButton label="Enter manually" variant="ghost" onPress={() => goManual()} disabled={busy} />
        <BigButton label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

// Avoid an unused import warning for Alert in environments that strip JSX.
void Alert;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cameraWrap: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  reticle: {
    position: 'absolute',
    top: '30%',
    bottom: '30%',
    left: '10%',
    right: '10%',
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: radii.md,
  },
  busyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  busyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
