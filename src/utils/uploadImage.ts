export async function uploadImageToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('L’image ne doit pas dépasser 5 Mo.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'plume');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erreur pendant l’upload.');
  }

  return data.secure_url;
}
