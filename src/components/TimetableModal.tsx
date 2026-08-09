import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Clock, CalendarDays } from 'lucide-react';
import { isHoliday } from '../lib/holidays';

interface TimetableModalProps {
  routeCode: string;
  onClose: () => void;
  routeData?: any;
  isLoadingDetail?: boolean;
  routeObj?: any;
  calendarExceptions?: any[];
}

const isRowInRange = (row: string[]) => {
  const validTimes = row.filter(t => t && t.trim() !== '' && t.includes(':'));
  if (validTimes.length < 2) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const parseToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };
  
  const startMinutes = parseToMinutes(validTimes[0]);
  const endMinutes = parseToMinutes(validTimes[validTimes.length - 1]);
  
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

function useIsMobile() {
  const width = useWindowWidth();
  return width < 768;
}

export default function TimetableModal({ routeCode, onClose, routeData, isLoadingDetail, routeObj, calendarExceptions = [] }: TimetableModalProps) {
  const isMobile = useIsMobile();
  const [activeDirection, setActiveDirection] = useState<'ida' | 'vuelta'>('ida');

  const routeObjToUse = useMemo(() => {
    if (routeObj) return routeObj;
    if (routeData && routeData.route) return routeData.route;
    return null;
  }, [routeData, routeObj]);

  // Find route in the backend data
  const data = useMemo(() => {
    if (routeData) return routeData;
    return routeObjToUse;
  }, [routeData, routeObjToUse]);

  const [dayTypes, setDayTypes] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const activeIdaRowRef = useRef<HTMLTableRowElement>(null);
  const activeVueltaRowRef = useRef<HTMLTableRowElement>(null);

  const activeExceptionMsg = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    let companyName = 'Otras';
    if (routeObjToUse) {
      const code = routeObjToUse.code || '';
      const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
      if (isSIT) companyName = 'SIT';
      else companyName = routeObjToUse.company || 'Otras';
    }

    const matchedException = calendarExceptions.find(
      (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all')
    );

    return matchedException?.description || null;
  }, [calendarExceptions, routeObjToUse]);

  useEffect(() => {
    if (activeIdaRowRef.current) {
      activeIdaRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (activeVueltaRowRef.current) {
      activeVueltaRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedDay, data]);

  const formatSpecialLabel = (id: string) => {
    if (id === 'weekday' || id === 'lunes_a_viernes') return 'Lunes a Viernes';
    if (id === 'saturday' || id === 'sabado' || id === 'sabados') return 'Sábado';
    if (id === 'sunday_holiday' || id === 'sunday' || id === 'holiday' || id === 'domingos_feriados') return 'Domingos y Feriados';
    if (id === 'special' || id === 'especial') return 'Especial (Horario Extraordinario / Invierno)';
    if (id.startsWith('special_')) {
      return id.replace('special_', '').replace(/_/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return id;
  };

  const getTodayDayLabel = () => {
    const now = new Date();
    
    // Formatear fecha actual como YYYY-MM-DD
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Resolver empresa del ramal
    let companyName = 'Otras';
    if (routeObjToUse) {
      const code = routeObjToUse.code || '';
      const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
      if (isSIT) {
        companyName = 'SIT';
      } else {
        companyName = routeObjToUse.company || 'Otras';
      }
    }

    // Buscar excepción activa
    const matchedException = calendarExceptions.find(
      (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all')
    );

    if (matchedException) {
      console.log(`💡 [TimetableModal] Aplicando excepción de calendario para ${companyName} hoy (${dateStr}): ${matchedException.overrideDayType}`);
      if (matchedException.overrideDayType === 'weekday') return 'Lunes a Viernes';
      if (matchedException.overrideDayType === 'saturday') return 'Sábado';
      if (matchedException.overrideDayType === 'sunday') return 'Domingos y Feriados';
      return formatSpecialLabel(matchedException.overrideDayType);
    }

    if (isHoliday(now)) {
      return 'Domingos y Feriados';
    }
    const day = now.getDay(); // 0 = Domingo, 6 = Sábado, 1-5 = Lunes a Viernes
    if (day === 0) return 'Domingos y Feriados';
    if (day === 6) return 'Sábado';

    return 'Lunes a Viernes';
  };

  useEffect(() => {
    if (!data) return;

    const todayLabel = getTodayDayLabel();

    if (data.schedules) {
      const types = new Set<string>();
      Object.entries(data.schedules).forEach(([key, s]: [string, any]) => {
        if (!s) return;
        let dayType = s.dayType || s.dayTypesId;
        if (!dayType) {
          if (key.startsWith('weekday_') || key === 'weekday' || key.startsWith('lunes_')) dayType = 'weekday';
          else if (key.startsWith('saturday_') || key === 'saturday' || key.startsWith('sabado_') || key.startsWith('sabados_')) dayType = 'saturday';
          else if (key.startsWith('sunday_') || key.startsWith('holiday_') || key.startsWith('sunday_holiday_') || key.startsWith('domingo_') || key.startsWith('domingos_feriados_')) dayType = 'sunday_holiday';
          else if (key.startsWith('especial_') || key.startsWith('special_')) dayType = 'especial';
          else {
            const parts = key.split('_');
            if (parts.length > 0 && parts[0]) dayType = parts[0];
          }
        }
        if (dayType === 'weekday' || dayType === 'lunes_a_viernes') types.add('Lunes a Viernes');
        else if (dayType === 'saturday' || dayType === 'sabado' || dayType === 'sabados') types.add('Sábado');
        else if (dayType === 'sunday_holiday' || dayType === 'domingos_feriados' || dayType === 'sunday' || dayType === 'holiday') {
          types.add('Domingos y Feriados');
        } else if (dayType === 'especial' || dayType === 'special') {
          types.add('Especial (Horario Extraordinario / Invierno)');
        } else if (dayType) {
          types.add(formatSpecialLabel(dayType));
        }
      });
      const DAY_ORDER = ['Lunes a Viernes', 'Sábado', 'Domingos y Feriados', 'Especial (Horario Extraordinario / Invierno)'];
      
      // Si la excepcion forzó un dayType custom y no existen horarios configurados, 
      // lo agregamos igual para que el modal indique el día y no falle silenciosamente al Lunes a Viernes regular
      if (todayLabel !== 'Lunes a Viernes' && todayLabel !== 'Sábado' && todayLabel !== 'Domingos y Feriados') {
        types.add(todayLabel);
      }

      const options = Array.from(types).sort((a, b) => {
        const iA = DAY_ORDER.indexOf(a);
        const iB = DAY_ORDER.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b);
      });

      if (options.length > 0) {
        setDayTypes(options);
        setSelectedDay(options.includes(todayLabel) ? todayLabel : options[0]);
      } else {
        setDayTypes(['Lunes a Viernes']);
        setSelectedDay(todayLabel);
      }
    } else {
      setDayTypes([]);
      setSelectedDay(todayLabel);
    }
  }, [data, calendarExceptions]);

  const getDisplayName = () => {
    if (routeObjToUse) {
      const code = routeObjToUse.code || '';
      const name = routeObjToUse.name || '';
      const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
      if (isSIT) {
        return `SIT ${code} - ${name}`;
      }
      return `${code} - ${name}`;
    }

    const rawCode = data?.code || routeCode;
    if (!rawCode) return 'Línea';
    if (rawCode.startsWith('redsube-')) {
      return `Línea ${rawCode.replace('redsube-', '')}`;
    }
    if (/^l[ií]nea\s+/i.test(rawCode)) {
      return rawCode.replace(/^l[ií]nea\s+/i, 'Línea ');
    }
    return `Línea ${rawCode}`;
  };

  if (isLoadingDetail) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', backdropFilter: 'blur(5px)'
      }}>
        <div style={{ color: 'white', fontSize: '1.2rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Clock size={24} className="animate-spin" /> Cargando horarios...
        </div>
      </div>
    );
  }

  if (!data || !data.schedules) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', backdropFilter: 'blur(5px)'
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', color: 'var(--text-primary)' }}>
          <h3>No hay horarios disponibles</h3>
          <p>Los horarios de la {getDisplayName()} no se encuentran en el sistema.</p>
          <button onClick={onClose} style={{ marginTop: '10px', padding: '8px 16px', background: 'var(--accent)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    );
  }

  const getScheduleForDayAndDirection = (dayLabel: string, direction: string) => {
    if (!data?.schedules) return null;
    let dayType = '';
    if (dayLabel === 'Lunes a Viernes') dayType = 'weekday';
    else if (dayLabel === 'Sábado') dayType = 'saturday';
    else if (dayLabel === 'Domingos y Feriados') {
      const mainKey = `sunday_holiday_${direction}`;
      if (data.schedules[mainKey]) return data.schedules[mainKey];
      const sundayKey = `sunday_${direction}`;
      if (data.schedules[sundayKey]) return data.schedules[sundayKey];
      const holidayKey = `holiday_${direction}`;
      if (data.schedules[holidayKey]) return data.schedules[holidayKey];
      dayType = 'sunday_holiday';
    } else {
      for (const key of Object.keys(data.schedules)) {
        if (!key.endsWith(`_${direction}`)) continue;
        const sch = data.schedules[key];
        if (!sch) continue;
        const scheduleDayType = sch.dayType || '';
        const formattedSchedule = formatSpecialLabel(scheduleDayType).toLowerCase();
        const dayLabelLower = dayLabel.toLowerCase();
        if (
          scheduleDayType === dayLabel || 
          formattedSchedule === dayLabelLower ||
          (dayLabelLower.includes('invierno') && (key.toLowerCase().includes('invierno') || scheduleDayType.toLowerCase().includes('invierno'))) ||
          (dayLabelLower.includes('especial') && (scheduleDayType.toLowerCase().startsWith('special') || key.toLowerCase().includes('special')))
        ) {
           return sch;
        }
      }
      dayType = dayLabel; 
    }

    const key = `${dayType}_${direction}`;
    if (data.schedules[key]) return data.schedules[key];
    
    // Fallback 1: buscar cualquier clave que termine en _direction y coincida parcialmente con el nombre del día
    for (const k of Object.keys(data.schedules)) {
      if (k.endsWith(`_${direction}`) && (k.toLowerCase().includes(dayType.toLowerCase()) || dayType.toLowerCase().includes(k.toLowerCase()))) {
        return data.schedules[k];
      }
    }

    // Fallback 2: si es un período especial/excepción de Lunes a Viernes (ej. Invierno), caer al horario regular Lunes a Viernes (weekday)
    const lowerDay = dayLabel.toLowerCase();
    if (lowerDay.includes('weekday') || lowerDay.includes('lunes') || lowerDay.includes('invierno') || lowerDay.includes('especial')) {
      // Primero intentar con claves special_* que contengan la dirección
      for (const k of Object.keys(data.schedules)) {
        if (k.endsWith(`_${direction}`) && k.toLowerCase().includes('special')) {
          return data.schedules[k];
        }
      }
      if (data.schedules[`weekday_${direction}`]) return data.schedules[`weekday_${direction}`];
      if (data.schedules[`lunes_a_viernes_${direction}`]) return data.schedules[`lunes_a_viernes_${direction}`];
    } else if (lowerDay.includes('saturday') || lowerDay.includes('sabado')) {
      if (data.schedules[`saturday_${direction}`]) return data.schedules[`saturday_${direction}`];
    } else if (lowerDay.includes('sunday') || lowerDay.includes('domingo') || lowerDay.includes('feriado')) {
      if (data.schedules[`sunday_holiday_${direction}`]) return data.schedules[`sunday_holiday_${direction}`];
      if (data.schedules[`sunday_${direction}`]) return data.schedules[`sunday_${direction}`];
      if (data.schedules[`holiday_${direction}`]) return data.schedules[`holiday_${direction}`];
    }

    // Fallback 3: retornar cualquier horario disponible para esa dirección
    for (const k of Object.keys(data.schedules)) {
      if (k.endsWith(`_${direction}`)) {
        return data.schedules[k];
      }
    }

    return null;
  };

  const scheduleIda = getScheduleForDayAndDirection(selectedDay, 'ida');
  const scheduleVuelta = getScheduleForDayAndDirection(selectedDay, 'vuelta');

  const currentIdaTimetables: string[][] = scheduleIda?.rows || scheduleIda?.matrix || [];
  const currentVueltaTimetables: string[][] = scheduleVuelta?.rows || scheduleVuelta?.matrix || [];
  const idaHeaders: string[] = scheduleIda?.headers || [];
  const vueltaHeaders: string[] = scheduleVuelta?.headers || [];

  const routeSubtitle = routeObjToUse ? (routeObjToUse.title || routeObjToUse.name) : (data?.title || data?.name);
  let originTitle = '';
  let destTitle = '';

  if (routeSubtitle && (routeSubtitle.includes(' - ') || routeSubtitle.includes(' – '))) {
    const parts = routeSubtitle.split(/\s*[-–]\s*/);
    if (parts.length >= 2) {
      originTitle = parts[0].replace(/\s*\(.*?\)/g, '').trim();
      destTitle = parts[1].replace(/\s*\(.*?\)/g, '').trim();
    }
  }

  const cleanIdaHeader = idaHeaders && idaHeaders.length > 1 
    ? `${idaHeaders[0].replace(/\s*\(.*?\)/g, '').trim()} a ${idaHeaders[idaHeaders.length - 1].replace(/\s*\(.*?\)/g, '').trim()}` 
    : 'Trayecto de Ida';
  const cleanVueltaHeader = vueltaHeaders && vueltaHeaders.length > 1 
    ? `${vueltaHeaders[0].replace(/\s*\(.*?\)/g, '').trim()} a ${vueltaHeaders[vueltaHeaders.length - 1].replace(/\s*\(.*?\)/g, '').trim()}` 
    : 'Trayecto de Vuelta';

  const idaTitle = originTitle && destTitle ? `${originTitle} a ${destTitle}` : cleanIdaHeader;
  const vueltaTitle = originTitle && destTitle ? `${destTitle} a ${originTitle}` : cleanVueltaHeader;
  
  const isSelectedException = selectedDay === getTodayDayLabel() && activeExceptionMsg;

  if (isMobile) {
    const activeSchedule = activeDirection === 'ida' ? scheduleIda : scheduleVuelta;
    const activeTimetables: string[][] = activeSchedule?.rows || activeSchedule?.matrix || [];
    const activeHeaders: string[] = activeSchedule?.headers || [];
    const activeRowRef = activeDirection === 'ida' ? activeIdaRowRef : activeVueltaRowRef;
    const hasIda = currentIdaTimetables.length > 0;
    const hasVuelta = currentVueltaTimetables.length > 0;

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--bg-card)', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        userSelect: 'none', WebkitUserSelect: 'none'
      }}>
        {/* Mobile Premium Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  background: routeObjToUse?.color ? `#${routeObjToUse.color}` : 'var(--accent)', 
                  color: 'white', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontSize: '0.8rem',
                  fontWeight: 800 
                }}>
                  {routeObjToUse?.code || routeCode}
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Horarios de Ramal</h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500, paddingLeft: '4px' }}>
                {routeObjToUse ? (routeObjToUse.title || routeObjToUse.name) : (data?.title || data?.name)}
              </p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', cursor: 'pointer'
            }}>
              <X size={18} />
            </button>
          </div>

          {/* Day Type Selector */}
          {activeExceptionMsg && (
            <div style={{ background: '#fff3cd', color: '#856404', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #ffeeba' }}>
              <span>⚠️</span> {activeExceptionMsg}
            </div>
          )}
          {dayTypes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isSelectedException ? '#fff3cd' : 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px', border: isSelectedException ? '1px solid #ffeeba' : '1px solid var(--border)', width: 'fit-content' }}>
              <CalendarDays size={14} color={isSelectedException ? '#856404' : "var(--text-muted)"} />
              <select 
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', color: isSelectedException ? '#856404' : 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600,
                  outline: 'none', cursor: 'pointer'
                }}
              >
                {dayTypes.map(d => (
                    <option key={d} value={d}>
                      {d === getTodayDayLabel() && activeExceptionMsg ? activeExceptionMsg : d}
                    </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Direction Tabs (Ida / Vuelta) */}
        {(!hasIda && !hasVuelta) && (
            <div style={{ 
              padding: '60px 24px', 
              textAlign: 'center', 
              color: 'var(--text-muted)', 
              background: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <CalendarDays size={40} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '4px' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Horarios no configurados</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.4', maxWidth: '280px', color: 'var(--text-muted)' }}>
                Este ramal aún no cuenta con una grilla de horarios activa para <strong>{selectedDay}</strong>.
              </p>
            </div>
        )}
        {(hasIda || hasVuelta) && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
            {hasIda && (
              <button 
                onClick={() => setActiveDirection('ida')}
                style={{
                  flex: 1, padding: '12px', background: 'transparent', border: 'none',
                  borderBottom: activeDirection === 'ida' ? '3px solid #3b82f6' : '3px solid transparent',
                  color: activeDirection === 'ida' ? '#3b82f6' : 'var(--text-muted)',
                  fontWeight: activeDirection === 'ida' ? 700 : 500, fontSize: '0.85rem', outline: 'none'
                }}
              >{idaTitle}</button>
            )}
            {hasVuelta && (
              <button 
                onClick={() => setActiveDirection('vuelta')}
                style={{
                  flex: 1, padding: '12px', background: 'transparent', border: 'none',
                  borderBottom: activeDirection === 'vuelta' ? '3px solid #a855f7' : '3px solid transparent',
                  color: activeDirection === 'vuelta' ? '#a855f7' : 'var(--text-muted)',
                  fontWeight: activeDirection === 'vuelta' ? 700 : 500, fontSize: '0.85rem', outline: 'none'
                }}
              >{vueltaTitle}</button>
            )}
          </div>
        )}

        {/* Content Table for Mobile */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px' }}>
          {activeTimetables.length > 0 ? (
            <div style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--border)', overflow: 'auto', clipPath: 'inset(0 round 12px)', position: 'relative' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'center' }}>
                <thead style={{
                  position: 'sticky', top: 0, zIndex: 10,
                  background: activeDirection === 'ida' ? '#e1effe' : '#f3e8ff',
                  boxShadow: '0 1px 0 var(--border)'
                }}>
                  <tr>
                    <th style={{ padding: '10px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '30px', color: 'var(--text-muted)' }}>#</th>
                    {activeHeaders.map((s: string, i: number) => (
                      <th key={i} style={{
                        padding: '10px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)',
                        whiteSpace: 'normal', minWidth: '75px', maxWidth: '120px', wordWrap: 'break-word',
                        lineHeight: '1.2', color: 'var(--text-primary)'
                      }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTimetables.map((row, r_idx) => {
                    const isCorrectDay = selectedDay === getTodayDayLabel();
                    const inRange = isCorrectDay && isRowInRange(row);
                    return (
                      <tr 
                        key={r_idx}
                        ref={inRange ? activeRowRef : null}
                        style={{ 
                          background: inRange ? 'rgba(34, 197, 94, 0.12)' : (r_idx % 2 === 0 ? 'transparent' : 'var(--bg-primary)'),
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <td style={{ 
                          padding: '8px', borderBottom: '1px solid var(--border)',
                          color: inRange ? '#22c55e' : 'var(--text-muted)', fontWeight: 600,
                          boxShadow: inRange ? 'inset 4px 0 0 #22c55e' : 'none'
                        }}>{r_idx + 1}</td>
                        {row.map((time, c_idx) => (
                          <td key={c_idx} style={{
                            padding: '8px', borderBottom: '1px solid var(--border)',
                            color: time ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: inRange ? '600' : 'normal'
                          }}>{time || '-'}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay horarios registrados para esta dirección.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        width: '95vw', maxWidth: '1400px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} color="var(--accent)" /> Horarios Completos
              <span style={{ 
                background: routeObjToUse?.color ? `#${routeObjToUse.color}` : 'var(--accent)', 
                color: 'white', 
                padding: '2px 10px', 
                borderRadius: '6px', 
                fontSize: '0.85rem',
                fontWeight: 700 
              }}>
                {getDisplayName()}
              </span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 30px' }}>
              {routeObjToUse ? (routeObjToUse.title || routeObjToUse.name) : (data?.title || data?.name)}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {/* Desktop Select */}
            {dayTypes.length > 0 && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '10px', 
                background: isSelectedException ? '#fff3cd' : 'rgba(0,0,0,0.03)', 
                padding: '6px 12px', 
                borderRadius: '8px', 
                border: isSelectedException ? '1px solid #ffeeba' : '1px solid var(--border)',
                color: isSelectedException ? '#856404' : 'inherit'
              }}>
                {isSelectedException ? <span title={activeExceptionMsg}>⚠️</span> : <CalendarDays size={16} color="var(--text-muted)" />}
                <select 
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', color: isSelectedException ? '#856404' : 'var(--text-primary)',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600,
                    outline: 'none', cursor: 'pointer', appearance: 'none', paddingRight: '15px'
                  }}
                >
                    {dayTypes.map(d => (
                      <option key={d} value={d}>
                        {d === getTodayDayLabel() && activeExceptionMsg ? activeExceptionMsg : d}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: '0.7rem', color: isSelectedException ? '#856404' : 'var(--text-muted)', marginLeft: '-5px', pointerEvents: 'none' }}>⌄</span>
              </div>
            )}
            
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {currentIdaTimetables.length === 0 && currentVueltaTimetables.length === 0 ? (
            <div style={{ 
              padding: '80px 20px', 
              textAlign: 'center', 
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              flex: 1
            }}>
              <CalendarDays size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Horarios no configurados</h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.5' }}>
                  Este recorrido no cuenta con una grilla de horarios registrada para el período de <strong>{selectedDay}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', flex: 1, minHeight: 0 }}>
            
              {/* IDA */}

            {currentIdaTimetables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h3 style={{
                  color: '#3b82f6', fontSize: '0.9rem', textTransform: 'none', 
                  letterSpacing: '0.5px', marginBottom: '12px', borderBottom: '2px solid #3b82f640', paddingBottom: '6px'
                }}>{idaTitle}</h3>
                <div style={{ overflow: 'auto', flex: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', clipPath: 'inset(0 round 12px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#e1effe', boxShadow: '0 1px 0 var(--border)' }}>
                      <tr>
                        <th style={{ 
                          padding: '10px 8px', 
                          fontWeight: 600, 
                          borderBottom: '1px solid var(--border)', 
                          width: '40px', 
                          color: 'var(--text-muted)'
                        }}>#</th>
                        {idaHeaders.map((s: string, i: number) => {
                          return (
                            <th 
                              key={i} 
                              style={{ 
                                padding: '10px 8px', 
                                fontWeight: 600, 
                                borderBottom: '1px solid var(--border)', 
                                whiteSpace: 'normal', 
                                minWidth: '80px', 
                                maxWidth: '130px', 
                                wordWrap: 'break-word', 
                                lineHeight: '1.2', 
                                color: 'var(--text-primary)'
                              }}
                            >
                              {s}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {currentIdaTimetables.map((row, r_idx) => {
                        const isCorrectDay = selectedDay === getTodayDayLabel();
                        const inRange = isCorrectDay && isRowInRange(row);
                        return (
                          <tr 
                            key={r_idx} 
                            ref={inRange ? activeIdaRowRef : null}
                            style={{ 
                              background: inRange 
                                ? 'rgba(34, 197, 94, 0.12)' 
                                : (r_idx % 2 === 0 ? 'transparent' : 'var(--bg-primary)'),
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {/* IMPORTANTE: NUNCA usar borderLeft en el <tr> para marcar la fila activa. 
                                Eso deforma el colapso de bordes (border-collapse: collapse) en tablas y 
                                provoca que la cabecera sticky (thead) tenga espacios y bordes blancos vacíos 
                                en la esquina superior izquierda. Se debe usar obligatoriamente boxShadow inset 
                                en este primer <td>. */}
                            <td style={{ 
                              padding: '8px', 
                              borderBottom: '1px solid var(--border)', 
                              color: inRange ? '#22c55e' : 'var(--text-muted)', 
                              fontWeight: 600,
                              boxShadow: inRange ? 'inset 4px 0 0 #22c55e' : 'none'
                            }}>{r_idx + 1}</td>
                            {row.map((time, c_idx) => (
                              <td key={c_idx} style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: time ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: inRange ? '600' : 'normal' }}>
                                {time || '-'}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VUELTA */}
            {currentVueltaTimetables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h3 style={{
                  color: '#a855f7', fontSize: '0.9rem', textTransform: 'none', 
                  letterSpacing: '0.5px', marginBottom: '12px', borderBottom: '2px solid #a855f740', paddingBottom: '6px'
                }}>{vueltaTitle}</h3>
                <div style={{ overflow: 'auto', flex: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', clipPath: 'inset(0 round 12px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f3e8ff', boxShadow: '0 1px 0 var(--border)' }}>
                      <tr>
                        <th style={{ 
                          padding: '10px 8px', 
                          fontWeight: 600, 
                          borderBottom: '1px solid var(--border)', 
                          width: '40px', 
                          color: 'var(--text-muted)'
                        }}>#</th>
                        {vueltaHeaders.map((s: string, i: number) => {
                          return (
                            <th 
                              key={i} 
                              style={{ 
                                padding: '10px 8px', 
                                fontWeight: 600, 
                                borderBottom: '1px solid var(--border)', 
                                whiteSpace: 'normal', 
                                minWidth: '80px', 
                                maxWidth: '130px', 
                                wordWrap: 'break-word', 
                                lineHeight: '1.2', 
                                color: 'var(--text-primary)'
                              }}
                            >
                              {s}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {currentVueltaTimetables.map((row, r_idx) => {
                        const isCorrectDay = selectedDay === getTodayDayLabel();
                        const inRange = isCorrectDay && isRowInRange(row);
                        return (
                          <tr 
                            key={r_idx} 
                            ref={inRange ? activeVueltaRowRef : null}
                            style={{ 
                              background: inRange 
                                ? 'rgba(34, 197, 94, 0.12)' 
                                : (r_idx % 2 === 0 ? 'transparent' : 'var(--bg-primary)'),
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {/* IMPORTANTE: NUNCA usar borderLeft en el <tr> para marcar la fila activa. 
                                Eso deforma el colapso de bordes (border-collapse: collapse) en tablas y 
                                provoca que la cabecera sticky (thead) tenga espacios y bordes blancos vacíos 
                                en la esquina superior izquierda. Se debe usar obligatoriamente boxShadow inset 
                                en este primer <td>. */}
                            <td style={{ 
                              padding: '8px', 
                              borderBottom: '1px solid var(--border)', 
                              color: inRange ? '#22c55e' : 'var(--text-muted)', 
                              fontWeight: 600,
                              boxShadow: inRange ? 'inset 4px 0 0 #22c55e' : 'none'
                            }}>{r_idx + 1}</td>
                            {row.map((time, c_idx) => (
                              <td key={c_idx} style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: time ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: inRange ? '600' : 'normal' }}>
                                {time || '-'}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
          )}
        </div>
      </div>
    </div>
  );
}
