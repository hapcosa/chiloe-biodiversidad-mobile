// El backend serializa los timestamps con el formato nativo de Postgres
// ("2026-08-04 18:55:08.259598+00"): espacio en vez de "T", microsegundos y
// offset sin minutos. Hermes no lo acepta en `new Date()` y devuelve Invalid
// Date, así que lo normalizamos a ISO 8601 antes de parsear.
const POSTGRES_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2})(?::?(\d{2}))?$/;

export function parseTimestamp(valor: string | null | undefined): Date | null {
  if (!valor) {
    return null;
  }

  const match = POSTGRES_TIMESTAMP.exec(valor.trim());
  const iso = match
    ? `${match[1]}T${match[2]}.${(match[3] ?? '0').slice(0, 3).padEnd(3, '0')}${
        match[4]
      }:${match[5] ?? '00'}`
    : valor;

  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatFechaCorta(valor: string | null | undefined): string {
  return parseTimestamp(valor)?.toLocaleDateString('es-CL') ?? '';
}
