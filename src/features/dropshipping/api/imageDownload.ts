import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

function getImageExtension(imageUrl: string): string {
  try {
    const extension = new URL(imageUrl).pathname.split('.').pop()?.toLowerCase();
    return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
  } catch {
    return 'jpg';
  }
}

export async function downloadDropshippingImage(
  productId: string,
  imageUrl: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('ছবিটি ডাউনলোড করা যায়নি।');
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${productId}.${getImageExtension(imageUrl)}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const file = new File(
    Paths.cache,
    `dropshipping-${productId}.${getImageExtension(imageUrl)}`
  );
  const downloadedFile = file.exists
    ? file
    : await File.downloadFileAsync(imageUrl, file, { idempotent: true });

  if (!downloadedFile.exists) {
    throw new Error('ছবিটি ডিভাইসে ডাউনলোড করা যায়নি।');
  }
  const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (permission.status !== 'granted') {
    throw new Error('গ্যালারিতে ছবি সংরক্ষণ করতে Photos অনুমতি দিন।');
  }
  await MediaLibrary.createAssetAsync(downloadedFile.uri);
}
