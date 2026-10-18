const DEFAULT_TIMEOUT_MS = 55_000;

/**
 * Call the same-origin Gemini endpoint. The timeout covers headers and the
 * response body, including JSON parsing, so a stalled body cannot hang UI.
 */
export async function requestGemini(payload, options = {}) {
  const {
    endpoint = '/api/gemini',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = options;

  if (typeof fetchImpl !== 'function') {
    throw createClientError('FETCH_UNAVAILABLE', 'Fetch tidak tersedia di perangkat ini.');
  }

  const controller = new AbortController();
  let timer;

  try {
    const operation = (async () => {
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw createClientError('TIMEOUT', 'Permintaan AI melebihi batas waktu.');
        }
        throw createClientError('NETWORK_ERROR', 'Koneksi ke layanan AI gagal.');
      }

      let body;
      try {
        body = await response.json();
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw createClientError('TIMEOUT', 'Permintaan AI melebihi batas waktu.');
        }
        throw createClientError('INVALID_JSON', 'Respons layanan AI tidak valid.');
      }

      if (!body || typeof body !== 'object') {
        throw createClientError('INVALID_RESPONSE', 'Format respons layanan AI tidak valid.');
      }

      if (!response.ok || body.ok === false) {
        const code = body.error?.code || `HTTP_${response.status}`;
        const message = body.error?.message || 'Layanan AI mengembalikan kesalahan.';
        throw createClientError(code, message, response.status);
      }

      if (body.ok !== true || !body.data || typeof body.data !== 'object') {
        throw createClientError('INVALID_RESPONSE', 'Data respons layanan AI tidak valid.');
      }
      return body.data;
    })();

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(createClientError('TIMEOUT', 'Permintaan AI melebihi batas waktu.'));
      }, timeoutMs);
    });
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function createClientError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status !== undefined) error.status = status;
  return error;
}

export { DEFAULT_TIMEOUT_MS };
