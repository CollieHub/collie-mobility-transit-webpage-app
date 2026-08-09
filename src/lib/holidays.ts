/**
 * Lista de feriados nacionales oficiales de Argentina para el año 2026.
 * Utilizado para la correcta selección automática de horarios de tránsito locales.
 */
export const ARGENTINA_HOLIDAYS_2026: string[] = [
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-23', // Feriado puente turístico
  '2026-03-24', // Día de la Memoria
  '2026-04-02', // Día de Malvinas
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Revolución de Mayo
  '2026-06-15', // Güemes (Trasladable)
  '2026-06-20', // Belgrano
  '2026-07-09', // Día de la Independencia
  '2026-07-10', // Feriado puente turístico
  '2026-08-17', // San Martín (Trasladable)
  '2026-10-12', // Día de la Diversidad Cultural (Trasladable)
  '2026-11-23', // Día de la Soberanía Nacional (Trasladable al lunes 23)
  '2026-12-07', // Feriado puente turístico
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

/**
 * Verifica si una fecha dada en formato YYYY-MM-DD o como objeto Date es feriado.
 */
export function isHoliday(date: Date | string): boolean {
  let dateStr = '';
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  } else {
    dateStr = date;
  }
  return ARGENTINA_HOLIDAYS_2026.includes(dateStr);
}
