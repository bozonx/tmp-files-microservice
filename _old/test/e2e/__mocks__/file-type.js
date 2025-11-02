/**
 * Мок для библиотеки file-type в E2E тестах
 * Предоставляет простую реализацию для тестирования
 */

/**
 * Мок функции fileTypeFromBuffer
 * @param {Buffer} buffer Буфер с данными файла
 * @returns {Promise<{ext: string, mime: string} | undefined>} Информация о типе файла
 */
async function fileTypeFromBuffer(buffer) {
  // Простая логика определения типа файла по содержимому
  if (!buffer || buffer.length === 0) {
    return undefined;
  }

  // Проверяем PNG заголовок
  if (buffer.length >= 8) {
    const pngHeader = buffer.slice(0, 8);
    if (
      pngHeader[0] === 0x89 &&
      pngHeader[1] === 0x50 &&
      pngHeader[2] === 0x4e &&
      pngHeader[3] === 0x47
    ) {
      return { ext: 'png', mime: 'image/png' };
    }
  }

  // Проверяем JPEG заголовок
  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
  }

  // Проверяем PDF заголовок
  if (buffer.length >= 4) {
    const pdfHeader = buffer.slice(0, 4);
    if (pdfHeader.toString() === '%PDF') {
      return { ext: 'pdf', mime: 'application/pdf' };
    }
  }

  // Проверяем JSON
  try {
    const text = buffer.toString('utf8');
    JSON.parse(text);
    return { ext: 'json', mime: 'application/json' };
  } catch {
    // Не JSON
  }

  // Проверяем HTML
  const text = buffer.toString('utf8').toLowerCase();
  if (text.includes('<html') || text.includes('<!doctype')) {
    return { ext: 'html', mime: 'text/html' };
  }

  // Проверяем CSS
  if (
    text.includes('{') &&
    (text.includes('color:') || text.includes('font-') || text.includes('margin'))
  ) {
    return { ext: 'css', mime: 'text/css' };
  }

  // Проверяем JavaScript
  if (
    text.includes('function') ||
    text.includes('const ') ||
    text.includes('let ') ||
    text.includes('var ')
  ) {
    return { ext: 'js', mime: 'application/javascript' };
  }

  // По умолчанию считаем текстовым файлом
  return { ext: 'txt', mime: 'text/plain' };
}

module.exports = {
  fileTypeFromBuffer,
};
