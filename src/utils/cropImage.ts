/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rognage d'image partagé (react-easy-crop) : produit un fichier image rogné à
 * partir d'une source et d'une zone de pixels. Utilisé pour l'avatar, la
 * bannière et les stickers.
 */

import type { Area } from 'react-easy-crop';

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

/** Rogne `imageSrc` à la zone `pixelCrop` et renvoie un File JPEG. */
export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'image.jpg'
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Impossible de préparer l'image rognée.");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  context.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Impossible de rogner l'image.")); return; }
      resolve(new File([blob], fileName, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}
