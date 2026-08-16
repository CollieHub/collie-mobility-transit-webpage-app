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

export const formatSpecialLabel = (id: string) => {
  if (!id) return 'Lunes a Viernes';
  const clean = id.trim().toLowerCase();
  if (clean === 'weekday' || clean === 'lunes_a_viernes' || clean.startsWith('lunes_a_viernes_') || clean.startsWith('weekday_') || clean === 'lunes a viernes') return 'Lunes a Viernes';
  if (clean === 'saturday' || clean === 'sabado' || clean === 'sabados' || clean.startsWith('sabados_') || clean.startsWith('saturday_') || clean === 'sábados' || clean === 'sábado') return 'Sábado';
  if (clean === 'sunday_holiday' || clean === 'sunday' || clean === 'holiday' || clean === 'domingos_feriados' || clean.startsWith('domingos_feriados_') || clean.startsWith('sunday_') || clean === 'domingos y feriados') return 'Domingos y Feriados';
  if (clean === 'special' || clean === 'especial' || clean.startsWith('especial_') || clean.startsWith('special_')) return 'Especial (Horario Extraordinario / Invierno)';
  return id;
};

export const getTodayDayLabel = (routeObjToUse?: any, calendarExceptions: any[] = []) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  let companyName = 'SIT';
  if (routeObjToUse) {
    const code = routeObjToUse.code || '';
    const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
    if (!isSIT) {
      companyName = routeObjToUse.company || 'Otras';
    }
  }

  const matchedException = (calendarExceptions || []).find(
    (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all' || exc.company === 'SIT' || !exc.company)
  );

  if (matchedException) {
    const override = matchedException.overrideDayType || matchedException.override_day_type;
    if (override === 'weekday' || override === 'lunes_a_viernes') return 'Lunes a Viernes';
    if (override === 'saturday' || override === 'sabados' || override === 'sabado') return 'Sábado';
    if (override === 'sunday' || override === 'sunday_holiday' || override === 'domingos_feriados') return 'Domingos y Feriados';
    return formatSpecialLabel(override);
  }

  if (isHoliday(now)) {
    return 'Domingos y Feriados';
  }
  const day = now.getDay();
  if (day === 0) return 'Domingos y Feriados';
  if (day === 6) return 'Sábado';
  return 'Lunes a Viernes';
};

const CONTROL_POINT_ALIASES: Record<string, string> = {
  // RZ01
  "ameghino": "Burgar",
  "rio colorado": "Terminal NK",
  "río colorado": "Terminal NK",
  "c. 6": "Burgar",
  
  // RZ02
  "escalada": "Escalada",
  "pitrau": "Lavalle y Pitrau",
  "perito moreno": "Lavalle y Perito Moreno",
  "san martin": "San Martín",
  "san martín": "San Martín",
  "cencerro": "El Cencerro",
  "larrea": "Los Ceibos",
  "ceibos": "Los Ceibos",

  // RZ03
  "evaristo carriego": "Cementerio",
  "fonavi": "Fonavi",
  "3101-3299": "Fonavi",

  // RZ04
  "tala": "Hospital",
  "florestano": "Hospital",

  // RZ07 / RZ11
  "km103": "Km 103",
  "druvich": "Bº Bosch",
  "baradero": "Lima",
  "las palmas": "Las Palmas",
};

export const cleanControlPointHeader = (raw: string): string => {
  if (!raw) return '';
  const cleanedLower = raw.trim().toLowerCase();

  for (const [key, alias] of Object.entries(CONTROL_POINT_ALIASES)) {
    if (cleanedLower.includes(key)) {
      return alias;
    }
  }

  let cleaned = raw.trim();
  // Strip PlusCodes like "RVVP+45 " or "87XW+22 "
  cleaned = cleaned.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}\s*/i, '');
  // Strip trailing street/house numbers like " 821", " 4807", " 3216"
  cleaned = cleaned.replace(/\s+\d{1,5}$/, '');
  return cleaned.trim() || raw;
};

const TIMETABLE_MEMORY_CACHE = new Map<string, any>();

function hasValidSchedules(obj: any): boolean {
  return !!(obj && obj.schedules && typeof obj.schedules === 'object' && Object.keys(obj.schedules).length > 0);
}

export default function TimetableModal({ routeCode, onClose, routeData, isLoadingDetail, routeObj, calendarExceptions = [] }: TimetableModalProps) {
  const isMobile = useIsMobile();
  const [activeDirection, setActiveDirection] = useState<'ida' | 'vuelta'>('ida');

  const param = routeObj?.id || routeObj?.code || routeCode || '';

  const preloadedData = useMemo(() => {
    if (hasValidSchedules(routeData)) return routeData;
    if (hasValidSchedules(routeObj)) return routeObj;
    if (param && TIMETABLE_MEMORY_CACHE.has(param)) return TIMETABLE_MEMORY_CACHE.get(param);
    return null;
  }, [routeData, routeObj, param]);

  const [internalRouteData, setInternalRouteData] = useState<any>(preloadedData);
  const [internalLoading, setInternalLoading] = useState<boolean>(!preloadedData);

  useEffect(() => {
    if (!param) {
      setInternalLoading(false);
      return;
    }

    if (hasValidSchedules(routeData)) {
      TIMETABLE_MEMORY_CACHE.set(param, routeData);
    }
    if (hasValidSchedules(routeObj)) {
      TIMETABLE_MEMORY_CACHE.set(param, routeObj);
    }

    const cached = TIMETABLE_MEMORY_CACHE.get(param) || (hasValidSchedules(routeData) ? routeData : (hasValidSchedules(routeObj) ? routeObj : null));

    if (cached) {
      setInternalRouteData(cached);
      setInternalLoading(false);
    } else {
      setInternalLoading(true);
    }

    fetch(`/v1/catalog/public/timetables?route_id=${encodeURIComponent(param)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.length > 0) {
          let consolidated: any = routeObj
            ? { ...routeObj, schedules: {} }
            : { id: param, code: param, schedules: {} };

          json.data.forEach((item: any) => {
            if (item.schedules) {
              consolidated.schedules = {
                ...consolidated.schedules,
                ...item.schedules
              };
            }
          });
          if (hasValidSchedules(consolidated)) {
            TIMETABLE_MEMORY_CACHE.set(param, consolidated);
            setInternalRouteData(consolidated);
          }
        }
      })
      .catch(err => console.warn('TimetableModal self-fetch error:', err))
      .finally(() => setInternalLoading(false));
  }, [param, routeCode, routeObj, routeData]);

  const effectiveRouteData = useMemo(() => {
    if (hasValidSchedules(internalRouteData)) return internalRouteData;
    if (hasValidSchedules(routeData)) return routeData;
    if (hasValidSchedules(routeObj)) return routeObj;
    return internalRouteData || routeObj || routeData;
  }, [routeData, routeObj, internalRouteData]);

  const effectiveLoading = isLoadingDetail || (internalLoading && !hasValidSchedules(effectiveRouteData));

  const routeObjToUse = useMemo(() => {
    if (routeObj) return routeObj;
    if (effectiveRouteData && effectiveRouteData.route) return effectiveRouteData.route;
    return null;
  }, [effectiveRouteData, routeObj]);

  const data = useMemo(() => {
    if (effectiveRouteData) return effectiveRouteData;
    return routeObjToUse;
  }, [effectiveRouteData, routeObjToUse]);

  const [dayTypes, setDayTypes] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    return getTodayDayLabel(routeObjToUse || routeObj || routeData?.route, calendarExceptions);
  });

  useEffect(() => {
    const computedToday = getTodayDayLabel(routeObjToUse || routeObj || routeData?.route, calendarExceptions);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    let companyName = 'SIT';
    if (routeObjToUse) {
      const code = routeObjToUse.code || '';
      const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
      if (!isSIT) companyName = routeObjToUse.company || 'Otras';
    }

    const hasException = (calendarExceptions || []).some(
      (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all' || exc.company === 'SIT' || !exc.company)
    );

    if (hasException) {
      setSelectedDay(computedToday);
    } else if (data?.currentDayTypeName) {
      setSelectedDay(formatSpecialLabel(data.currentDayTypeName));
    } else if (data?.currentDayType) {
      setSelectedDay(formatSpecialLabel(data.currentDayType));
    } else {
      setSelectedDay(computedToday);
    }
  }, [calendarExceptions, data?.currentDayType, data?.currentDayTypeName, routeObjToUse]);

  const activeIdaRowRef = useRef<HTMLTableRowElement>(null);
  const activeVueltaRowRef = useRef<HTMLTableRowElement>(null);

  const activeExceptionMsg = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    let companyName = 'SIT';
    if (routeObjToUse) {
      const code = routeObjToUse.code || '';
      const isSIT = code.toLowerCase().startsWith('rz') || routeObjToUse.id?.toLowerCase().includes('sit');
      if (!isSIT) companyName = routeObjToUse.company || 'Otras';
    }

    const matchedException = (calendarExceptions || []).find(
      (exc: any) => exc.date === dateStr && (exc.company === companyName || exc.company === 'all' || exc.company === 'SIT' || !exc.company)
    );

    return matchedException?.description || null;
  }, [calendarExceptions, routeObjToUse]);

  // Scroll suave único diferido para evitar parpadeos y saltos
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      if (activeIdaRowRef.current) {
        activeIdaRowRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
      if (activeVueltaRowRef.current) {
        activeVueltaRowRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedDay, data]);

  useEffect(() => {
    if (!data || !data.schedules) {
      setDayTypes([]);
      return;
    }

    const todayLabel = data.currentDayTypeName || (data.currentDayType ? formatSpecialLabel(data.currentDayType) : getTodayDayLabel(routeObjToUse, calendarExceptions));
    const types = new Set<string>();

    Object.entries(data.schedules).forEach(([key, s]: [string, any]) => {
      if (!s) return;
      const rawLabel = s.dayTypeName || s.name || s.dayType || s.dayTypesId || key;
      const label = formatSpecialLabel(rawLabel);
      if (label) {
        types.add(label);
      }
    });

    const DAY_ORDER = ['Lunes a Viernes', 'Sábado', 'Domingos y Feriados', 'Especial (Horario Extraordinario / Invierno)'];
    
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

    setDayTypes(options);
    if (options.length > 0) {
      setSelectedDay(prev => (prev && options.includes(prev) ? prev : (options.includes(todayLabel) ? todayLabel : options[0])));
    } else {
      setSelectedDay(todayLabel);
    }
  }, [data, calendarExceptions, routeObjToUse]);

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

  if (effectiveLoading) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', backdropFilter: 'blur(5px)'
      }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          padding: '40px', textAlign: 'center', color: 'var(--text-primary)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Cargando horarios...</div>
        </div>
      </div>
    );
  }

  const getScheduleForDayAndDirection = (dayLabel: string, direction: 'ida' | 'vuelta') => {
    if (!data || !data.schedules) return null;

    let targetCode = 'lunes_a_viernes';
    if (dayLabel === 'Lunes a Viernes') targetCode = 'lunes_a_viernes';
    else if (dayLabel === 'Sábado' || dayLabel === 'Sábados') targetCode = 'sabados';
    else if (dayLabel === 'Domingos y Feriados') targetCode = 'domingos_feriados';
    else if (dayLabel.startsWith('Especial')) targetCode = 'especial';

    // 1. Buscar coincidencia exacta por clave de la schedule (e.g. lunes_a_viernes_ida, domingos_feriados_vuelta)
    const exactKey = `${targetCode}_${direction}`;
    if (data.schedules[exactKey]) return data.schedules[exactKey];

    // 2. Buscar por dayType/dayTypeName coincidente
    for (const [key, sch] of Object.entries(data.schedules) as [string, any][]) {
      if (!key.endsWith(`_${direction}`) && sch.direction !== direction) continue;
      const formatted = formatSpecialLabel(sch.dayTypeName || sch.dayType || sch.dayTypesId || key);
      if (formatted === dayLabel) {
        return sch;
      }
    }

    // 3. Fallbacks compatibles con AWS legacy (weekday, saturday, sunday_holiday)
    if (dayLabel === 'Lunes a Viernes') {
      if (data.schedules[`weekday_${direction}`]) return data.schedules[`weekday_${direction}`];
    } else if (dayLabel === 'Sábado') {
      if (data.schedules[`saturday_${direction}`]) return data.schedules[`saturday_${direction}`];
    } else if (dayLabel === 'Domingos y Feriados') {
      if (data.schedules[`sunday_holiday_${direction}`]) return data.schedules[`sunday_holiday_${direction}`];
      if (data.schedules[`sunday_${direction}`]) return data.schedules[`sunday_${direction}`];
      if (data.schedules[`holiday_${direction}`]) return data.schedules[`holiday_${direction}`];
    }

    // No utilizar fallbacks cruzados entre días distintos
    return null;
  };

  const scheduleIda = getScheduleForDayAndDirection(selectedDay, 'ida');
  const scheduleVuelta = getScheduleForDayAndDirection(selectedDay, 'vuelta');

  const currentIdaTimetables: string[][] = scheduleIda?.rows || scheduleIda?.matrix || [];
  const currentVueltaTimetables: string[][] = scheduleVuelta?.rows || scheduleVuelta?.matrix || [];
  const rawIdaHeaders: string[] = scheduleIda?.headers || scheduleIda?.aliases || scheduleIda?.addresses || scheduleIda?.stop_addresses || [];
  const rawVueltaHeaders: string[] = scheduleVuelta?.headers || scheduleVuelta?.aliases || scheduleVuelta?.addresses || scheduleVuelta?.stop_addresses || [];

  const idaHeaders = rawIdaHeaders.map((h: string, i: number) => {
    const alias = scheduleIda?.aliases?.[i];
    if (alias && alias.trim() !== '' && !alias.startsWith('stop-') && !alias.startsWith('Punto ')) {
      return cleanControlPointHeader(alias);
    }
    if (h && !h.startsWith('Punto ')) return cleanControlPointHeader(h);
    const addr = scheduleIda?.addresses?.[i] || scheduleIda?.stop_addresses?.[i];
    if (addr && !addr.startsWith('Punto ')) return cleanControlPointHeader(addr);
    return `Punto ${i + 1}`;
  });

  const vueltaHeaders = rawVueltaHeaders.map((h: string, i: number) => {
    const alias = scheduleVuelta?.aliases?.[i];
    if (alias && alias.trim() !== '' && !alias.startsWith('stop-') && !alias.startsWith('Punto ')) {
      return cleanControlPointHeader(alias);
    }
    if (h && !h.startsWith('Punto ')) return cleanControlPointHeader(h);
    const addr = scheduleVuelta?.addresses?.[i] || scheduleVuelta?.stop_addresses?.[i];
    if (addr && !addr.startsWith('Punto ')) return cleanControlPointHeader(addr);
    return `Punto ${i + 1}`;
  });

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

  const idaTitle = (originTitle && destTitle) ? `${originTitle} a ${destTitle}` : cleanIdaHeader;
  const vueltaTitle = (originTitle && destTitle) ? `${destTitle} a ${originTitle}` : cleanVueltaHeader;

  const activeSchedule = activeDirection === 'ida' ? scheduleIda : scheduleVuelta;
  const activeTimetables = activeDirection === 'ida' ? currentIdaTimetables : currentVueltaTimetables;
  const activeHeaders = activeDirection === 'ida' ? idaHeaders : vueltaHeaders;
  const activeTitle = activeDirection === 'ida' ? idaTitle : vueltaTitle;
  const activeRowRef = activeDirection === 'ida' ? activeIdaRowRef : activeVueltaRowRef;
  const isSelectedException = selectedDay === getTodayDayLabel(routeObjToUse, calendarExceptions) && activeExceptionMsg;

  const getDayTypeOptionLabel = (dayLabel: string) => {
    const todayLabel = getTodayDayLabel(routeObjToUse, calendarExceptions);
    if (dayLabel === todayLabel && activeExceptionMsg) {
      return `${dayLabel} (${activeExceptionMsg})`;
    }
    return dayLabel;
  };

  if (isMobile) {
    const hasIda = currentIdaTimetables.length > 0;
    const hasVuelta = currentVueltaTimetables.length > 0;

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(5px)'
      }}>
        {/* Mobile Header */}
        <div style={{
          padding: '16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '12px', userSelect: 'none', WebkitUserSelect: 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                background: routeObjToUse?.color ? `#${routeObjToUse.color}` : 'var(--accent)', 
                color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 800 
              }}>
                {getDisplayName()}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Horarios
              </span>
            </div>
            <button onClick={onClose} style={{ 
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', 
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
                      {getDayTypeOptionLabel(d)}
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
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Sin horarios disponibles</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '300px' }}>
                No hay horarios registrados para <strong>{selectedDay}</strong>.
              </p>
            </div>
        )}

        {(hasIda || hasVuelta) && (
          <div style={{ 
            display: 'flex', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
            padding: '4px 8px', gap: '8px', userSelect: 'none', WebkitUserSelect: 'none'
          }}>
            {hasIda && (
              <button 
                onClick={() => setActiveDirection('ida')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: '8px', border: 'none',
                  background: activeDirection === 'ida' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: activeDirection === 'ida' ? '#3b82f6' : 'var(--text-muted)',
                  fontWeight: activeDirection === 'ida' ? 700 : 500, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                <span>➡️</span> {idaTitle}
              </button>
            )}
            {hasVuelta && (
              <button 
                onClick={() => setActiveDirection('vuelta')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: '8px', border: 'none',
                  background: activeDirection === 'vuelta' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  color: activeDirection === 'vuelta' ? '#a855f7' : 'var(--text-muted)',
                  fontWeight: activeDirection === 'vuelta' ? 700 : 500, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                <span>⬅️</span> {vueltaTitle}
              </button>
            )}
          </div>
        )}

        {/* Mobile Content */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-card)', position: 'relative' }}>
          {activeTimetables.length > 0 ? (
            <div style={{ overflowX: 'auto', minWidth: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: activeDirection === 'ida' ? '#e1effe' : '#f3e8ff', boxShadow: '0 1px 0 var(--border)' }}>
                  <tr>
                    <th style={{ padding: '10px 6px', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '30px', color: 'var(--text-muted)' }}>#</th>
                    {activeHeaders.map((s: string, i: number) => (
                      <th key={i} style={{ 
                        padding: '10px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)', 
                        whiteSpace: 'normal', minWidth: '85px', maxWidth: '120px', wordWrap: 'break-word', lineHeight: '1.2', color: 'var(--text-primary)'
                      }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTimetables.map((row, r_idx) => {
                    const isCorrectDay = selectedDay === getTodayDayLabel(routeObjToUse, calendarExceptions);
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
      background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '95vw', maxWidth: '1400px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
              <Clock size={20} color="#0284c7" /> Horarios Completos
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 30px', fontWeight: 500 }}>
              {routeObjToUse ? (routeObjToUse.title || routeObjToUse.name) : (data?.title || data?.name)}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {/* Desktop Select */}
            {dayTypes.length > 0 && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '10px', 
                background: isSelectedException ? '#fff3cd' : '#f8fafc', 
                padding: '6px 12px', 
                borderRadius: '8px', 
                border: isSelectedException ? '1px solid #ffeeba' : '1px solid #e2e8f0',
                color: isSelectedException ? '#856404' : '#0f172a'
              }}>
                {isSelectedException ? <span title={activeExceptionMsg}>⚠️</span> : <CalendarDays size={16} color="#64748b" />}
                <select 
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', color: isSelectedException ? '#856404' : '#0f172a',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600,
                    outline: 'none', cursor: 'pointer', appearance: 'none', paddingRight: '15px'
                  }}
                >
                  {dayTypes.map(d => (
                    <option key={d} value={d} style={{ color: '#0f172a', background: '#ffffff' }}>
                      {getDayTypeOptionLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
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
                        const isCorrectDay = selectedDay === getTodayDayLabel(routeObjToUse, calendarExceptions);
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
                        const isCorrectDay = selectedDay === getTodayDayLabel(routeObjToUse, calendarExceptions);
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
