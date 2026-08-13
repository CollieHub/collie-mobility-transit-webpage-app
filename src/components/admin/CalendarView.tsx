import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Trash2, Plus, PartyPopper, Briefcase, Palmtree, AlertTriangle } from 'lucide-react';

interface Holiday {
  id?: string;
  date: string;
  name: string;
  type: 'inamovible' | 'trasladable' | 'turistico' | 'no_laborable';
}

interface CalendarException {
  id?: string;
  date: string;
  company: string;
  overrideDayType: string;
  description: string;
}

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: 'hol_2026_01_01', date: '2026-01-01', name: 'Año Nuevo', type: 'inamovible' },
  { id: 'hol_2026_02_16', date: '2026-02-16', name: 'Carnaval', type: 'inamovible' },
  { id: 'hol_2026_02_17', date: '2026-02-17', name: 'Carnaval', type: 'inamovible' },
  { id: 'hol_2026_03_23', date: '2026-03-23', name: 'Feriado con fines turísticos', type: 'turistico' },
  { id: 'hol_2026_03_24', date: '2026-03-24', name: 'Día Nacional de la Memoria por la Verdad y la Justicia', type: 'inamovible' },
  { id: 'hol_2026_04_02', date: '2026-04-02', name: 'Día del Veterano y de los Caídos en la Guerra de Malvinas', type: 'inamovible' },
  { id: 'hol_2026_04_03', date: '2026-04-03', name: 'Viernes Santo', type: 'inamovible' },
  { id: 'hol_2026_05_01', date: '2026-05-01', name: 'Día del Trabajador', type: 'inamovible' },
  { id: 'hol_2026_05_25', date: '2026-05-25', name: 'Día de la Revolución de Mayo', type: 'inamovible' },
  { id: 'hol_2026_06_15', date: '2026-06-15', name: 'Paso a la Inmortalidad del Gral. Güemes', type: 'trasladable' },
  { id: 'hol_2026_06_20', date: '2026-06-20', name: 'Paso a la Inmortalidad del Gral. Manuel Belgrano', type: 'inamovible' },
  { id: 'hol_2026_07_09', date: '2026-07-09', name: 'Día de la Independencia', type: 'inamovible' },
  { id: 'hol_2026_07_10', date: '2026-07-10', name: 'Feriado con fines turísticos', type: 'turistico' },
  { id: 'hol_2026_08_17', date: '2026-08-17', name: 'Paso a la Inmortalidad del Gral. San Martín', type: 'trasladable' },
  { id: 'hol_2026_10_12', date: '2026-10-12', name: 'Día del Respeto a la Diversidad Cultural', type: 'trasladable' },
  { id: 'hol_2026_11_23', date: '2026-11-23', name: 'Día de la Soberanía Nacional', type: 'trasladable' },
  { id: 'hol_2026_12_08', date: '2026-12-08', name: 'Inmaculada Concepción de María', type: 'inamovible' },
  { id: 'hol_2026_12_25', date: '2026-12-25', name: 'Navidad', type: 'inamovible' },
];

const TYPE_CONFIG: Record<Holiday['type'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  inamovible:   { label: 'Inamovible',   color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',   icon: <Calendar size={14} /> },
  trasladable:  { label: 'Trasladable',  color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  icon: <RefreshCw size={14} /> },
  turistico:    { label: 'Turístico',    color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)',  icon: <Palmtree size={14} /> },
  no_laborable: { label: 'No Laborable', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', icon: <Briefcase size={14} /> },
};

const OVERRIDE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  weekday:  { label: 'Lunes a Viernes', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  saturday: { label: 'Sábado',          color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  sunday:   { label: 'Domingos/Feriados', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  special:  { label: 'Especial / Invierno', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
};

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T12:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface CalendarViewProps {
  showNotification?: (type: 'success' | 'error', message: string) => void;
}

export default function CalendarView({ showNotification }: CalendarViewProps) {
  const [activeTab, setActiveTab] = useState<'holidays' | 'exceptions'>('holidays');

  // Holidays State
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [newHoliday, setNewHoliday] = useState<Holiday>({ date: '', name: '', type: 'inamovible' });

  // Exceptions State
  const [exceptions, setExceptions] = useState<CalendarException[]>([]);
  const [isLoadingExceptions, setIsLoadingExceptions] = useState<boolean>(false);
  const [showAddException, setShowAddException] = useState<boolean>(false);
  const [newExceptionForm, setNewExceptionForm] = useState({
    dateStart: '',
    dateEnd: '',
    company: 'SIT',
    overrideDayType: 'saturday',
    description: ''
  });

  const fetchHolidays = async () => {
    setIsLoadingHolidays(true);
    try {
      const res = await fetch('/v1/holidays');
      if (res.ok) {
        const text = await res.text();
        if (text) {
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : (data.rows || []);
          if (list.length > 0) setHolidays(list);
          setIsLoadingHolidays(false);
          return;
        }
      }
    } catch (error) {}

    try {
      const res = await fetch('/v1/admin/table/holidays?limit=500');
      if (res.ok) {
        const data = await res.json();
        if (data.rows && data.rows.length > 0) setHolidays(data.rows);
      }
    } catch (_) {}
    setIsLoadingHolidays(false);
  };

  const fetchExceptions = async () => {
    setIsLoadingExceptions(true);
    try {
      const res = await fetch('/v1/calendar_exceptions');
      if (res.ok) {
        const text = await res.text();
        if (text) {
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : (data.rows || []);
          setExceptions(list);
          setIsLoadingExceptions(false);
          return;
        }
      }
    } catch (error) {}

    try {
      const res = await fetch('/v1/admin/table/calendar_exceptions?limit=500');
      if (res.ok) {
        const data = await res.json();
        if (data.rows) setExceptions(data.rows);
      }
    } catch (_) {}
    setIsLoadingExceptions(false);
  };

  useEffect(() => {
    fetchHolidays();
    fetchExceptions();
  }, []);

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays]);

  const today = new Date().toISOString().slice(0, 10);
  const nextHoliday = useMemo(() => {
    return sortedHolidays.find(h => h.date >= today) || sortedHolidays[0];
  }, [sortedHolidays, today]);

  const pastCount = useMemo(() => {
    return sortedHolidays.filter(h => h.date < today).length;
  }, [sortedHolidays, today]);

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const holidaysInMonth = useMemo(() => {
    return holidays.filter(h => {
      const d = new Date(h.date + 'T12:00:00');
      return d.getMonth() === calendarMonth && d.getFullYear() === calendarYear;
    });
  }, [holidays, calendarMonth, calendarYear]);

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      showNotification?.('error', 'Completa la fecha y el nombre del feriado');
      return;
    }

    const createdItem: Holiday = {
      id: newHoliday.id || `hol_${Date.now()}`,
      date: newHoliday.date,
      name: newHoliday.name,
      type: newHoliday.type
    };

    setHolidays(prev => [...prev.filter(h => h.date !== createdItem.date), createdItem]);
    showNotification?.('success', 'Feriado guardado correctamente');
    setNewHoliday({ date: '', name: '', type: 'inamovible' });
    setShowAdd(false);

    try {
      let res = await fetch('/v1/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createdItem)
      });
      if (!res.ok) {
        await fetch('/v1/admin/table/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createdItem)
        });
      }
    } catch (_) {}
  };

  const handleDeleteHoliday = async (idOrDate: string) => {
    setHolidays(prev => prev.filter(h => h.id !== idOrDate && h.date !== idOrDate));
    showNotification?.('success', 'Feriado eliminado');

    try {
      let res = await fetch(`/v1/holidays/${encodeURIComponent(idOrDate)}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetch(`/v1/admin/table/holidays/${encodeURIComponent(idOrDate)}`, { method: 'DELETE' });
      }
    } catch (_) {}
  };

  const handleAddException = async () => {
    if (!newExceptionForm.dateStart || !newExceptionForm.dateEnd) {
      showNotification?.('error', 'Selecciona la fecha de inicio y fin para la excepción');
      return;
    }
    if (newExceptionForm.dateStart > newExceptionForm.dateEnd) {
      showNotification?.('error', 'La fecha de inicio no puede ser posterior a la de fin');
      return;
    }

    const start = new Date(newExceptionForm.dateStart + 'T12:00:00');
    const end = new Date(newExceptionForm.dateEnd + 'T12:00:00');
    let curr = new Date(start);
    const createdItems: CalendarException[] = [];

    while (curr <= end) {
      const dStr = curr.toISOString().split('T')[0];
      const item: CalendarException = {
        id: `cexc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: dStr,
        company: newExceptionForm.company,
        overrideDayType: newExceptionForm.overrideDayType,
        description: newExceptionForm.description || `Excepción de calendario para ${newExceptionForm.company}`
      };
      createdItems.push(item);
      curr.setDate(curr.getDate() + 1);
    }

    setExceptions(prev => [...prev.filter(e => !createdItems.some(c => c.date === e.date && c.company === e.company)), ...createdItems]);
    showNotification?.('success', `${createdItems.length} excepción(es) de calendario registrada(s)`);
    setNewExceptionForm({ dateStart: '', dateEnd: '', company: 'SIT', overrideDayType: 'saturday', description: '' });
    setShowAddException(false);

    for (const item of createdItems) {
      try {
        const payload = {
          date: item.date,
          company: item.company,
          override_day_type: item.overrideDayType,
          overrideDayType: item.overrideDayType,
          description: item.description
        };

        let res = await fetch('/v1/calendar_exceptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          await fetch('/v1/admin/table/calendar_exceptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      } catch (_) {}
    }
  };

  const handleDeleteException = async (id: string) => {
    setExceptions(prev => prev.filter(e => e.id !== id));
    showNotification?.('success', 'Excepción eliminada');

    try {
      let res = await fetch(`/v1/calendar_exceptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetch(`/v1/admin/table/calendar_exceptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }
    } catch (_) {}
  };

  const byType = (type: Holiday['type']) => holidays.filter(h => h.type === type).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#f3f4f6' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .cal-day-cell { transition: transform 0.15s ease, border-color 0.15s ease; }
        .cal-day-cell:hover { transform: scale(1.08); z-index: 2; }
        .cal-row { transition: background-color 0.15s ease; }
        .cal-row:hover { background-color: rgba(255, 255, 255, 0.03) !important; }
      `}} />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.25rem' }}>
        <button
          onClick={() => setActiveTab('holidays')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: activeTab === 'holidays' ? '#38bdf8' : '#9ca3af',
            fontWeight: activeTab === 'holidays' ? 700 : 500,
            fontSize: '0.95rem',
            padding: '0.65rem 1.25rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'holidays' ? '2px solid #38bdf8' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          📅 Feriados Nacionales ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab('exceptions')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: activeTab === 'exceptions' ? '#38bdf8' : '#9ca3af',
            fontWeight: activeTab === 'exceptions' ? 700 : 500,
            fontSize: '0.95rem',
            padding: '0.65rem 1.25rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'exceptions' ? '2px solid #38bdf8' : '2px solid transparent',
            transition: 'all 0.15s ease'
          }}
        >
          ⚙️ Excepciones de Cronogramas ({exceptions.length})
        </button>
      </div>

      {/* HOLIDAYS TAB */}
      {activeTab === 'holidays' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Gestión de feriados nacionales y días no laborables oficiales.
            </span>
            <button
              onClick={() => setShowAdd(!showAdd)}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '0.6rem 1.25rem',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <Plus size={16} /> Agregar Feriado
            </button>
          </div>

          {/* Add Holiday Form */}
          {showAdd && (
            <div style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Fecha</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ flex: '2 1 260px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Nombre del feriado</label>
                <input
                  type="text"
                  placeholder="Ej. Día de la Independencia"
                  value={newHoliday.name}
                  onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Tipo</label>
                <select
                  value={newHoliday.type}
                  onChange={e => setNewHoliday({ ...newHoliday, type: e.target.value as Holiday['type'] })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAddHoliday}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Guardar
              </button>
            </div>
          )}

          {/* Stats Cards & Next Holiday Countdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Counts Breakdown */}
            <div style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{cfg.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: cfg.color }}>{byType(k as Holiday['type'])}</div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#9ca3af'
              }}>
                <span>Total: <strong style={{ color: '#ffffff' }}>{holidays.length}</strong> feriados</span>
                <span>Pasados: <strong>{pastCount}</strong> • Restantes: <strong>{holidays.length - pastCount}</strong></span>
              </div>
            </div>

            {/* Next Holiday Card */}
            {nextHoliday && (
              <div style={{
                backgroundColor: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: TYPE_CONFIG[nextHoliday.type].bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: TYPE_CONFIG[nextHoliday.type].color,
                  flexShrink: 0
                }}>
                  <PartyPopper size={26} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próximo feriado</div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.15rem', color: '#ffffff' }}>{nextHoliday.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.15rem' }}>{formatDate(nextHoliday.date)}</div>
                </div>

                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: TYPE_CONFIG[nextHoliday.type].color, lineHeight: 1 }}>
                    {daysUntil(nextHoliday.date)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', marginTop: '0.2rem' }}>días</div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Calendar Grid */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <button
                onClick={() => {
                  if (calendarMonth > 0) setCalendarMonth(calendarMonth - 1);
                  else { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </h2>

              <button
                onClick={() => {
                  if (calendarMonth < 11) setCalendarMonth(calendarMonth + 1);
                  else { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', textAlign: 'center' }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                  {d}
                </div>
              ))}

              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const holiday = holidaysInMonth.find(h => h.date === dateStr);
                const isToday = dateStr === today;
                const d = new Date(calendarYear, calendarMonth, day);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                return (
                  <div
                    key={day}
                    className="cal-day-cell"
                    title={holiday ? `${holiday.name} (${TYPE_CONFIG[holiday.type].label})` : undefined}
                    style={{
                      padding: '0.65rem 0.25rem',
                      borderRadius: '10px',
                      position: 'relative',
                      backgroundColor: holiday ? TYPE_CONFIG[holiday.type].bg : isToday ? 'rgba(56, 189, 248, 0.15)' : '#1f2937',
                      border: isToday ? '2px solid #38bdf8' : holiday ? `1px solid ${TYPE_CONFIG[holiday.type].color}50` : '1px solid rgba(255, 255, 255, 0.03)',
                      color: holiday ? TYPE_CONFIG[holiday.type].color : isWeekend ? '#6b7280' : '#ffffff',
                      fontWeight: holiday || isToday ? 700 : 400,
                      fontSize: '0.85rem'
                    }}
                  >
                    {day}
                    {holiday && (
                      <div style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: TYPE_CONFIG[holiday.type].color,
                        margin: '0.2rem auto 0'
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Holidays List */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            overflow: 'hidden'
          }}>
            {sortedHolidays.map((h, idx) => {
              const isPast = h.date < today;
              const cfg = TYPE_CONFIG[h.type];
              return (
                <div
                  key={h.id || `${h.date}-${idx}`}
                  className="cal-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '150px 1fr 140px 48px',
                    alignItems: 'center',
                    padding: '0.85rem 1.25rem',
                    borderBottom: idx < sortedHolidays.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                    opacity: isPast ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: '#ffffff' }}>
                      {formatDate(h.date).split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>{h.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatDate(h.date)}</div>
                  </div>

                  <div>
                    <span style={{
                      backgroundColor: cfg.bg,
                      color: cfg.color,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteHoliday(h.id || h.date)}
                      title="Eliminar Feriado"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        opacity: 0.7
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXCEPTIONS TAB */}
      {activeTab === 'exceptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Define excepciones para días específicos (ej. feriados puente con horarios de Sábado).
            </span>
            <button
              onClick={() => setShowAddException(!showAddException)}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '0.6rem 1.25rem',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <Plus size={16} /> Agregar Excepción
            </button>
          </div>

          {/* Add Exception Form */}
          {showAddException && (
            <div style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Desde</label>
                <input
                  type="date"
                  value={newExceptionForm.dateStart}
                  onChange={e => setNewExceptionForm({ ...newExceptionForm, dateStart: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Hasta</label>
                <input
                  type="date"
                  value={newExceptionForm.dateEnd}
                  onChange={e => setNewExceptionForm({ ...newExceptionForm, dateEnd: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Empresa / Línea</label>
                <select
                  value={newExceptionForm.company}
                  onChange={e => setNewExceptionForm({ ...newExceptionForm, company: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="SIT">SIT (Zárate)</option>
                  <option value="all">Todas las Líneas (Global)</option>
                </select>
              </div>

              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Cronograma a Usar</label>
                <select
                  value={newExceptionForm.overrideDayType}
                  onChange={e => setNewExceptionForm({ ...newExceptionForm, overrideDayType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  {Object.entries(OVERRIDE_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '2 1 240px' }}>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Descripción / Motivo</label>
                <input
                  type="text"
                  placeholder="Ej. Feriado puente con horario de sábado"
                  value={newExceptionForm.description}
                  onChange={e => setNewExceptionForm({ ...newExceptionForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <button
                onClick={handleAddException}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Guardar
              </button>
            </div>
          )}

          {/* Exceptions List */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            overflow: 'hidden'
          }}>
            {isLoadingExceptions ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                Cargando excepciones de calendario...
              </div>
            ) : exceptions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                <AlertTriangle size={32} style={{ margin: '0 auto 0.75rem', color: '#f59e0b' }} />
                No hay excepciones de calendario vigentes configuradas.
              </div>
            ) : (
              exceptions.map((exc, idx) => {
                const isPast = exc.date < today;
                const cfg = OVERRIDE_CONFIG[exc.overrideDayType] || OVERRIDE_CONFIG.saturday;
                return (
                  <div
                    key={exc.id || idx}
                    className="cal-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '150px 130px 1fr 180px 48px',
                      alignItems: 'center',
                      padding: '0.85rem 1.25rem',
                      borderBottom: idx < exceptions.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                      opacity: isPast ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color }} />
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: '#ffffff' }}>
                        {formatDate(exc.date).split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>

                    <div>
                      <span style={{
                        backgroundColor: exc.company === 'all' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                        color: exc.company === 'all' ? '#a78bfa' : '#ffffff',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        🏢 {exc.company === 'all' ? 'Global' : exc.company}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>{exc.description}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatDate(exc.date)}</div>
                    </div>

                    <div>
                      <span style={{
                        backgroundColor: cfg.bg,
                        color: cfg.color,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        ⚙️ Horario: {cfg.label}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => exc.id && handleDeleteException(exc.id)}
                        title="Eliminar Excepción"
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          opacity: 0.7
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
