const BORDE_MAXIMO = 1600;
const CALIDAD = 0.72;
const YA_LIVIANA = 600_000;

function conTiempo<T>(tarea: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(mensaje)), ms);
    tarea.then(
      (valor) => {
        clearTimeout(reloj);
        resolve(valor);
      },
      (err) => {
        clearTimeout(reloj);
        reject(err);
      },
    );
  });
}

/** Achica la foto en el celular antes de subirla, para no dejar la pantalla en «Subiendo…». */
export async function prepararFoto(file: File): Promise<File> {
  const pareceImagen = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!pareceImagen) {
    throw new Error('Elija una foto JPG, PNG o WebP.');
  }
  if (file.type === 'image/jpeg' && file.size > 0 && file.size <= YA_LIVIANA) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await conTiempo(
      createImageBitmap(file, { imageOrientation: 'from-image' }),
      15000,
      'Esta foto tardó demasiado en prepararse. Tome otra más liviana.',
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('tardó')) throw err;
    throw new Error('No se pudo leer esta foto. Tómela de nuevo o elija un JPG.');
  }

  try {
    const escala = Math.min(1, BORDE_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * escala));
    const height = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la foto.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await conTiempo(
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', CALIDAD)),
      15000,
      'Esta foto tardó demasiado en prepararse. Tome otra más liviana.',
    );
    if (!blob) throw new Error('No se pudo preparar la foto.');
    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export async function prepararFotos(files: File[]): Promise<File[]> {
  const listas: File[] = [];
  for (const file of files) {
    listas.push(await prepararFoto(file));
  }
  return listas;
}
