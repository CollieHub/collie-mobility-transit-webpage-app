import React, { useState, useEffect, useRef, useMemo } from 'react';
import TimetableModal from '../TimetableModal';
import {
  SaveIcon,
  WandIcon,
  RefreshIcon,
  PlusIcon,
  TrashIcon,
  SettingsIcon,
  CheckIcon,
  BusIcon,
  BranchIcon,
  CalendarDayIcon,
  ClockIcon,
  ExternalLinkIcon,
  XIcon
} from './Icons';

interface RamalScheduleEditorProps {
  linesList: any[];
  branchesList: any[];
  dayTypesList: any[];
  showNotification: (type: 'success' | 'error', message: string) => void;
  onRefreshData?: () => void;
}

// 🔤 Helper de Corrección de Ortografía y Acentuación Local
function correctSpellingAndCapitalization(text: string): string {
  if (!text) return '';
  const corrections: { [key: string]: string } = {
    'estacion': 'Estación',
    'estación': 'Estación',
    'bolivar': 'Bolívar',
    'bolívar': 'Bolívar',
    'peron': 'Perón',
    'perón': 'Perón',
    'colon': 'Colón',
    'colón': 'Colón',
    'san martin': 'San Martín',
    'san martín': 'San Martín',
    'yrigoyen': 'Yrigoyen',
    'hipolito': 'Hipólito',
    'belgrano': 'Belgrano',
    'pellegrini': 'Pellegrini',
    'pelegrini': 'Pellegrini',
    'terminal': 'Terminal',
    'fonavi': 'Fonavi',
    'espana': 'España',
    'españa': 'España',
    'carriego': 'Carriego',
    'avellaneda': 'Avellaneda',
    'gonzalez': 'González',
    'rodriguez': 'Rodríguez',
    'lopez': 'López',
    'perez': 'Pérez',
    'gomez': 'Gómez',
    'sanchez': 'Sánchez',
    'diaz': 'Díaz',
    'martinez': 'Martínez',
    'herrera': 'Herrera',
    'gutierrez': 'Gutiérrez',
    'vargas': 'Vargas',
    'castro': 'Castro',
    'ortiz': 'Ortiz',
    'ramirez': 'Ramírez',
    'ruiz': 'Ruiz',
    'nunez': 'Núñez',
    'núñez': 'Núñez',
    'recorrido': 'Recorrido',
    'horario': 'Horario',
    'paradas': 'Paradas',
    'colectivo': 'Colectivo',
    'linea': 'Línea',
    'línea': 'Línea',
    'ramal': 'Ramal',
    'empresa': 'Empresa',
    'provincia': 'Provincia',
    'nacion': 'Nación',
    'nación': 'Nación'
  };

  // 1. Capitalizar primera letra de cada palabra y el resto en minúscula
  let formattedText = text.replace(/([a-zA-ZÀ-ÿ\d]+)/gu, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });

  // 2. Aplicar correcciones ortográficas del diccionario sobre palabras completas
  Object.keys(corrections).forEach(word => {
    const regex = new RegExp(`(?<=^|[^a-zA-ZÀ-ÿ\d])${word}(?=[^a-zA-ZÀ-ÿ\d]|$)`, 'gi');
    formattedText = formattedText.replace(regex, corrections[word]);
  });

  // 3. Forzar que la letra "y" de conjunción (aislada) quede en minúscula
  formattedText = formattedText.replace(/\bY\b/g, 'y');

  return formattedText;
}

export function getBranchDirectionLabel(branch: any, dir: 'ida' | 'vuelta'): string {
  if (!branch) return dir === 'ida' ? 'Ida' : 'Vuelta';

  const explicitLabel = dir === 'ida' ? branch.direction_ida_label : branch.direction_vuelta_label;
  if (explicitLabel && explicitLabel.trim() !== '' && explicitLabel.toLowerCase() !== dir) {
    return explicitLabel.trim();
  }

  const branchName = branch.name || '';
  if (branchName && (branchName.includes('-') || branchName.includes('–') || branchName.includes('—'))) {
    let cleanTitle = branchName;
    if (branch.code && cleanTitle.startsWith(branch.code)) {
      cleanTitle = cleanTitle.replace(branch.code, '').trim();
    }
    const parts = cleanTitle.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      let rawDest = dir === 'ida' ? parts[parts.length - 1].trim() : parts[0].trim();
      if (dir === 'vuelta') {
        rawDest = rawDest.replace(/^(COMUN|DIRECTO|EXPRESO|DIFERENCIAL|LOCAL)\s+/i, '').trim();
      }
      if (rawDest) {
        return rawDest.replace(/\s*\(.*?\)/g, '').trim();
      }
    }
  }

  return dir === 'ida' ? 'Ida' : 'Vuelta';
}

export default function RamalScheduleEditor({
  linesList,
  branchesList,
  dayTypesList,
  showNotification,
  onRefreshData
}: RamalScheduleEditorProps) {
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [direction, setDirection] = useState<'ida' | 'vuelta'>('ida');
  const [selectedDayTypeCode, setSelectedDayTypeCode] = useState<string>('lunes_a_viernes');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isProcessingSpelling, setIsProcessingSpelling] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewRouteData, setPreviewRouteData] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [branchStops, setBranchStops] = useState<any[]>([]);

  // Modal de Nuevo Tipo de Día
  const [isDayTypeModalOpen, setIsDayTypeModalOpen] = useState<boolean>(false);
  const [newDayTypeCode, setNewDayTypeCode] = useState<string>('');
  const [newDayTypeName, setNewDayTypeName] = useState<string>('');
  const [newDayTypeOrder, setNewDayTypeOrder] = useState<number>(1);
  const [isCreatingDayType, setIsCreatingDayType] = useState<boolean>(false);

  // Intervalo de minutos e historial de secuencia por fila
  const [rowIntervalMinutes, setRowIntervalMinutes] = useState<Record<number, string>>({});
  const [activeSequenceState, setActiveSequenceState] = useState<{
    sourceRowIdx: number;
    lastRowIdxInserted: number;
    lastDepartureMins: number;
    delays: number[];
    count: number;
  } | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletingGrid, setIsDeletingGrid] = useState<boolean>(false);
  const [rowToDeleteIdx, setRowToDeleteIdx] = useState<number | null>(null);
  const [colToDeleteIdx, setColToDeleteIdx] = useState<number | null>(null);

  // Modal y Estado de Procesar Imagen (OCR)
  const [isImageProcessModalOpen, setIsImageProcessModalOpen] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isUploadingOCR, setIsUploadingOCR] = useState<boolean>(false);
  const [isPasteAreaFocused, setIsPasteAreaFocused] = useState<boolean>(false);
  const [backupRawText, setBackupRawText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelection = (file: File) => {
    setSelectedImageFile(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageSelection(file);
          break;
        }
      }
    }
  };

  const submitImageOCR = async () => {
    if (!selectedImageFile) return;
    setIsUploadingOCR(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedImageFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const res = await fetch('/v1/admin/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64 })
      });

      const data = await res.json();

      if (data.success) {
        setBackupRawText(csvText);

        let newHeaders: string[] = data.headers || [];
        const newMatrix = data.matrix || [];

        // 🔤 Ejecutar automáticamente la corrección de ortografía en los encabezados recién importados
        if (newHeaders.length > 0) {
          newHeaders = newHeaders.map(h => correctSpellingAndCapitalization(h));
          setHeaders(newHeaders);
          setHeaderAliases(newHeaders.map(() => ''));
          setStopAddresses(newHeaders.map(() => ''));
        }
        if (newMatrix.length > 0) {
          setMatrixRows(newMatrix);
        }

        const formattedText = [
          newHeaders.join(';'),
          ...newMatrix.map((r: string[]) => r.join(';'))
        ].join('\n');
        setCsvText(formattedText);

        showNotification('success', 'Imagen procesada correctamente por IA');
        setIsImageProcessModalOpen(false);
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
      } else {
        showNotification('error', data.error || 'No se pudo procesar la imagen');
      }
    } catch (err: any) {
      showNotification('error', `Error al subir la imagen: ${err.message}`);
    } finally {
      setIsUploadingOCR(false);
    }
  };

  const handleConfirmDeleteGrid = async () => {
    if (!selectedBranchId) {
      showNotification('error', 'No hay ningún ramal seleccionado');
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeletingGrid(true);
    try {
      if (scheduleId) {
        await fetch(`/v1/admin/table/schedules/${scheduleId}`, {
          method: 'DELETE'
        });
      }
      
      setMatrixRows([]);
      setCsvText('');
      setHeaders([]);
      setHeaderAliases([]);
      setStopAddresses([]);
      setScheduleId(null);
      
      await fetch('/v1/admin/cache/purge');
      
      showNotification('success', 'Grilla de horarios eliminada exitosamente');
      onRefreshData?.();
    } catch (err: any) {
      showNotification('error', `Error al eliminar la grilla: ${err.message}`);
    } finally {
      setIsDeletingGrid(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleOpenDayTypeModal = () => {
    const maxOrder = dayTypesList.reduce((max, dt) => {
      const ord = typeof dt.display_order === 'number' ? dt.display_order : parseInt(dt.display_order || '0', 10);
      return !isNaN(ord) && ord > max ? ord : max;
    }, 0);

    setNewDayTypeOrder(maxOrder + 1);
    setNewDayTypeCode('');
    setNewDayTypeName('');
    setIsDayTypeModalOpen(true);
  };

  const handleNameChange = (nameVal: string) => {
    setNewDayTypeName(nameVal);
    const slug = nameVal
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setNewDayTypeCode(slug);
  };

  const handleSaveDayType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDayTypeName.trim()) {
      showNotification('error', 'Por favor ingresa un nombre para el Tipo de Día');
      return;
    }

    const code = newDayTypeCode.trim() || newDayTypeName.toLowerCase().replace(/\s+/g, '_');

    setIsCreatingDayType(true);
    try {
      const res = await fetch('/v1/admin/table/day_types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name: newDayTypeName.trim(),
          display_order: newDayTypeOrder
        })
      });

      const resJson = await res.json();
      if (resJson.success) {
        await fetch('/v1/admin/cache/purge');
        showNotification('success', `Tipo de Día "${newDayTypeName.trim()}" creado correctamente`);
        setIsDayTypeModalOpen(false);
        if (onRefreshData) onRefreshData();
        setSelectedDayTypeCode(code);
      } else {
        showNotification('error', `Error al crear: ${resJson.error || 'Error desconocido'}`);
      }
    } catch (err: any) {
      showNotification('error', `Error de red: ${err.message}`);
    } finally {
      setIsCreatingDayType(false);
    }
  };

  // Datos del Horario
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerAliases, setHeaderAliases] = useState<string[]>([]);
  const [stopAddresses, setStopAddresses] = useState<string[]>([]);
  const [matrixRows, setMatrixRows] = useState<string[][]>([]);
  const [csvText, setCsvText] = useState<string>('');

  const availableBranches = branchesList.filter(b => {
    if (!selectedLineId) return false;
    return b.line_id === selectedLineId;
  });

  useEffect(() => {
    if (!selectedBranchId) {
      setScheduleId(null);
      setHeaders([]);
      setHeaderAliases([]);
      setStopAddresses([]);
      setMatrixRows([]);
      setCsvText('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const url = `/v1/admin/table/schedules?limit=500`;
    fetch(url)
      .then(res => res.json())
      .then(async data => {
        if (data.success && data.rows) {
          const DAY_TYPE_ID_FALLBACKS: Record<string, string> = {
            'lunes_a_viernes': '88f18fc3-ba8e-521a-a093-07db0825cf3a',
            'sabados': '26453d08-1d87-57ea-910e-1e14de95a162',
            'domingos_feriados': 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e',
            'especial': '4dd8ea7a-abb2-552e-b6da-1bb945d7c515'
          };

          const activeDayTypeObj = dayTypesList.find(dt => dt.code === selectedDayTypeCode || dt.id === selectedDayTypeCode);
          const targetDayTypeId = activeDayTypeObj?.id || DAY_TYPE_ID_FALLBACKS[selectedDayTypeCode] || selectedDayTypeCode;

          const matchingSched = data.rows.find((s: any) => {
            if (s.branch_id !== selectedBranchId) return false;
            if (s.direction?.toLowerCase() !== direction?.toLowerCase()) return false;
            
            const sDayId = (s.day_types_id || '').toLowerCase();
            const targetIdLower = targetDayTypeId.toLowerCase();
            const targetCodeLower = selectedDayTypeCode.toLowerCase();

            return sDayId === targetIdLower || sDayId === targetCodeLower;
          });

          if (matchingSched) {
            setScheduleId(matchingSched.id);
            
            let hList: string[] = [];
            try {
              hList = typeof matchingSched.headers_json === 'string'
                ? JSON.parse(matchingSched.headers_json)
                : matchingSched.headers_json || [];
            } catch (_) {}

            let aList: string[] = [];
            try {
              aList = typeof matchingSched.header_aliases_json === 'string'
                ? JSON.parse(matchingSched.header_aliases_json)
                : matchingSched.header_aliases_json || [];
            } catch (_) {}

            let addrList: string[] = [];
            try {
              addrList = typeof matchingSched.stop_addresses_json === 'string'
                ? JSON.parse(matchingSched.stop_addresses_json)
                : matchingSched.stop_addresses_json || [];
            } catch (_) {}

            if (hList.length === 0) {
              hList = ['BARRIO BOSCH', 'TERMINAL (fonavi)', 'JUSTA LIMA Y DORREGO', 'BOLIVAR Y AVELLANEDA', 'ESTACION', 'CARRIEGO Y FRENCH', 'BARRIO ESPAÑA'];
            }

            setHeaders(hList);
            setHeaderAliases(aList.length === hList.length ? aList : Array(hList.length).fill(''));
            setStopAddresses(addrList.length === hList.length ? addrList : Array(hList.length).fill(''));

            fetch(`/v1/admin/table/schedule_items?limit=500`)
              .then(r => r.json())
              .then(itemsData => {
                if (itemsData.success && itemsData.rows) {
                  const filteredItems = itemsData.rows
                    .filter((item: any) => item.schedule_id === matchingSched.id)
                    .sort((a: any, b: any) => (a.dispatch_order || 0) - (b.dispatch_order || 0));

                  const mRows: string[][] = [];
                  filteredItems.forEach((item: any) => {
                    let tripTimes: string[] = [];
                    try {
                      tripTimes = typeof item.trip_times_json === 'string'
                        ? JSON.parse(item.trip_times_json)
                        : item.trip_times_json || [];
                    } catch (_) {}

                    if (tripTimes.length > 0) {
                      mRows.push(tripTimes);
                    }
                  });

                  if (mRows.length === 0) {
                    mRows.push(['04:35', '04:40', '04:49', '04:57', '05:03', '05:09', '05:20']);
                    mRows.push(['05:55', '06:00', '06:12', '06:22', '06:29', '06:35', '06:50']);
                    mRows.push(['06:10', '06:15', '06:27', '06:37', '06:44', '06:50', '07:05']);
                  }

                  setMatrixRows(mRows);
                  buildCsvFromState(hList, mRows);
                }
                setIsLoading(false);
              })
              .catch(() => setIsLoading(false));

          } else {
            setScheduleId(null);
            const defaultH = ['BARRIO BOSCH', 'TERMINAL (fonavi)', 'JUSTA LIMA Y DORREGO', 'BOLIVAR Y AVELLANEDA', 'ESTACION', 'CARRIEGO Y FRENCH', 'BARRIO ESPAÑA'];
            const defaultRows = [
              ['04:35', '04:40', '04:49', '04:57', '05:03', '05:09', '05:20'],
              ['05:55', '06:00', '06:12', '06:22', '06:29', '06:35', '06:50'],
              ['06:10', '06:15', '06:27', '06:37', '06:44', '06:50', '07:05']
            ];
            setHeaders(defaultH);
            setHeaderAliases(Array(defaultH.length).fill(''));
            setStopAddresses(Array(defaultH.length).fill(''));
            setMatrixRows(defaultRows);
            buildCsvFromState(defaultH, defaultRows);
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false));
  }, [selectedBranchId, direction, selectedDayTypeCode, refreshTrigger]);

  useEffect(() => {
    if (!selectedBranchId) {
      setBranchStops([]);
      return;
    }

    fetch('/v1/admin/table/stops?limit=500')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.rows)) {
          const filtered = data.rows
            .filter((s: any) => s.branch_id === selectedBranchId && (!s.direction || s.direction.toLowerCase() === direction.toLowerCase()))
            .sort((a: any, b: any) => (a.stop_order || 0) - (b.stop_order || 0));
          setBranchStops(filtered);
        }
      })
      .catch(() => setBranchStops([]));
  }, [selectedBranchId, direction]);

  const handleAutoAssociateStops = () => {
    if (headers.length === 0) {
      showNotification('error', 'No hay encabezados en la grilla');
      return;
    }
    if (branchStops.length === 0) {
      showNotification('error', 'No hay paradas registradas para este ramal y sentido');
      return;
    }

    const cleanStr = (str: string) => str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ').trim();

    let matchCount = 0;
    const updatedAddresses = headers.map((header) => {
      const headerClean = cleanStr(header);
      if (!headerClean) return '';

      // 1. Coincidencia exacta
      const exact = branchStops.find(s => cleanStr(s.name) === headerClean);
      if (exact) {
        matchCount++;
        return exact.name;
      }

      // 2. Contención parcial
      const partial = branchStops.find(s => {
        const sClean = cleanStr(s.name);
        return sClean.includes(headerClean) || headerClean.includes(sClean);
      });
      if (partial) {
        matchCount++;
        return partial.name;
      }

      // 3. Coincidencia por palabra relevante
      const words = headerClean.split(' ').filter(w => w.length > 2);
      if (words.length > 0) {
        const wordMatch = branchStops.find(s => {
          const sClean = cleanStr(s.name);
          return words.some(w => sClean.includes(w));
        });
        if (wordMatch) {
          matchCount++;
          return wordMatch.name;
        }
      }

      return '';
    });

    setStopAddresses(updatedAddresses);
    if (matchCount > 0) {
      showNotification('success', `Se auto-asociaron ${matchCount} paradas automáticamente`);
    } else {
      showNotification('error', 'No se encontraron coincidencias automáticas de paradas');
    }
  };

  const buildCsvFromState = (hList: string[], rowsList: string[][]) => {
    const lines: string[] = [];
    lines.push(hList.join(';'));
    rowsList.forEach(r => {
      lines.push(r.join(';'));
    });
    setCsvText(lines.join('\n'));
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);

    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length > 0) {
      const newHeaders = rawLines[0].split(';').map(h => h.trim());
      setHeaders(newHeaders);

      const newRows: string[][] = [];
      for (let i = 1; i < rawLines.length; i++) {
        const rowVals = rawLines[i].split(';').map(v => v.trim());
        newRows.push(rowVals);
      }
      setMatrixRows(newRows);
    }
  };

  const formatTimeMask = (val: string, prevVal: string = ''): string => {
    if (!val) return '';

    if (prevVal.endsWith(':') && val === prevVal.slice(0, -1)) {
      return val.slice(0, 2);
    }

    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) return '';

    if (digits.length === 1) {
      return digits;
    }
    if (digits.length === 2) {
      if (val.length < prevVal.length && !val.includes(':')) {
        return digits;
      }
      return `${digits}:`;
    }
    if (digits.length === 3) {
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  };

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    setActiveSequenceState(null);
    const prevVal = matrixRows[rIdx]?.[cIdx] || '';
    const maskedVal = formatTimeMask(val, prevVal);

    const newRows = [...matrixRows];
    newRows[rIdx] = [...newRows[rIdx]];
    newRows[rIdx][cIdx] = maskedVal;
    setMatrixRows(newRows);
    buildCsvFromState(headers, newRows);
  };

  const timeToMins = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const minsToTime = (totalMins: number): string => {
    const normalized = ((totalMins % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const m = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const calculateRowDelays = (row: string[]): number[] => {
    const delays: number[] = [0];
    const firstMins = timeToMins(row[0]);
    if (firstMins === null) return delays;

    for (let col = 1; col < headers.length; col++) {
      const colMins = timeToMins(row[col]);
      if (colMins !== null) {
        let diff = colMins - firstMins;
        if (diff < 0) diff += 1440;
        delays.push(diff);
      } else {
        delays.push(0);
      }
    }
    return delays;
  };

  const handleAddRow = () => {
    setActiveSequenceState(null);
    const emptyRow = Array(headers.length).fill('');
    const newRows = [...matrixRows, emptyRow];
    setMatrixRows(newRows);
    buildCsvFromState(headers, newRows);
  };

  const handleAddRowWithInterval = (rIdx: number) => {
    const intervalStr = rowIntervalMinutes[rIdx] || '';
    const intervalMins = parseInt(intervalStr, 10);

    if (isNaN(intervalMins) || intervalMins <= 0) {
      setActiveSequenceState(null);
      const emptyRow = Array(headers.length).fill('');
      const newRows = [...matrixRows];
      newRows.splice(rIdx + 1, 0, emptyRow);
      setMatrixRows(newRows);
      buildCsvFromState(headers, newRows);
      return;
    }

    if (activeSequenceState && activeSequenceState.sourceRowIdx === rIdx) {
      const { lastRowIdxInserted, lastDepartureMins, delays, count } = activeSequenceState;
      const nextDepartureMins = lastDepartureMins + intervalMins;

      const newRow = delays.map(delay => minsToTime(nextDepartureMins + delay));
      const newRows = [...matrixRows];
      const insertIdx = lastRowIdxInserted + 1;
      newRows.splice(insertIdx, 0, newRow);

      setMatrixRows(newRows);
      buildCsvFromState(headers, newRows);

      setActiveSequenceState({
        sourceRowIdx: rIdx,
        lastRowIdxInserted: insertIdx,
        lastDepartureMins: nextDepartureMins,
        delays,
        count: count + 1
      });
    } else {
      const sourceRow = matrixRows[rIdx];
      if (!sourceRow) return;

      const baseDepartureMins = timeToMins(sourceRow[0]);
      if (baseDepartureMins === null) {
        showNotification('error', 'Cargá un horario en la primera columna antes de agregar la secuencia de minutos (ej: 04:50).');
        return;
      }

      const delays = calculateRowDelays(sourceRow);
      const nextDepartureMins = baseDepartureMins + intervalMins;
      const newRow = delays.map(delay => minsToTime(nextDepartureMins + delay));

      const newRows = [...matrixRows];
      const insertIdx = rIdx + 1;
      newRows.splice(insertIdx, 0, newRow);

      setMatrixRows(newRows);
      buildCsvFromState(headers, newRows);

      setActiveSequenceState({
        sourceRowIdx: rIdx,
        lastRowIdxInserted: insertIdx,
        lastDepartureMins: nextDepartureMins,
        delays,
        count: 1
      });
    }
  };

  // 🪄 HANDLER: Autocompletar Secuencia de Horarios para la Fila
  const applySequenceToRow = (rowIndex: number) => {
    const row = matrixRows[rowIndex];
    if (!row) return;

    const firstColVal = row[0];
    if (!firstColVal || !/^\d{1,2}:\d{2}/.test(firstColVal)) {
      showNotification('error', 'Ingresa un horario en la primera columna antes de autocompletar.');
      return;
    }

    const colCount = headers.length;
    if (colCount <= 1) return;

    const timeToMinutes = (timeStr: string): number | null => {
      if (!timeStr || !timeStr.includes(':')) return null;
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const delays: number[] = new Array(colCount).fill(0);
    for (let col = 1; col < colCount; col++) {
      let sumDiff = 0;
      let count = 0;

      matrixRows.forEach((r, idx) => {
        if (idx === rowIndex) return;

        const prevTime = timeToMinutes(r[col - 1]);
        const currTime = timeToMinutes(r[col]);

        if (prevTime !== null && currTime !== null) {
          let diff = currTime - prevTime;
          if (diff < 0) {
            diff += 1440;
          }
          sumDiff += diff;
          count++;
        }
      });

      delays[col] = count > 0 ? Math.round(sumDiff / count) : 10;
    }

    const updatedRow = [...row];
    let currentMins = timeToMinutes(firstColVal) || 0;

    for (let col = 1; col < colCount; col++) {
      currentMins = (currentMins + delays[col]) % 1440;
      const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
      const m = (currentMins % 60).toString().padStart(2, '0');
      updatedRow[col] = `${h}:${m}`;
    }

    const updatedRows = [...matrixRows];
    updatedRows[rowIndex] = updatedRow;
    setMatrixRows(updatedRows);
    buildCsvFromState(headers, updatedRows);

    showNotification('success', 'Secuencia de horarios autocompletada correctamente.');
  };

  const handleAddColumn = (cIdx: number) => {
    const newHeaderName = `NUEVA PARADA ${headers.length + 1}`;

    const newHeaders = [...headers];
    newHeaders.splice(cIdx, 0, newHeaderName);
    setHeaders(newHeaders);

    const newAliases = [...headerAliases];
    newAliases.splice(cIdx, 0, '');
    setHeaderAliases(newAliases);

    const newAddresses = [...stopAddresses];
    newAddresses.splice(cIdx, 0, '');
    setStopAddresses(newAddresses);

    const newRows = matrixRows.map(row => {
      const r = [...row];
      r.splice(cIdx, 0, '');
      return r;
    });
    setMatrixRows(newRows);

    buildCsvFromState(newHeaders, newRows);
    showNotification('success', `Columna "${newHeaderName}" agregada en posición ${cIdx + 1}`);
  };

  const handleDeleteColumn = (cIdx: number) => {
    if (headers.length <= 1) {
      showNotification('error', 'La grilla debe mantener al menos una columna');
      return;
    }

    const colName = headers[cIdx] || `Columna ${cIdx + 1}`;

    const newHeaders = headers.filter((_, idx) => idx !== cIdx);
    setHeaders(newHeaders);

    const newAliases = headerAliases.filter((_, idx) => idx !== cIdx);
    setHeaderAliases(newAliases);

    const newAddresses = stopAddresses.filter((_, idx) => idx !== cIdx);
    setStopAddresses(newAddresses);

    const newRows = matrixRows.map(row => row.filter((_, idx) => idx !== cIdx));
    setMatrixRows(newRows);

    buildCsvFromState(newHeaders, newRows);
    showNotification('success', `Columna "${colName}" eliminada correctamente`);
  };

  const handleDeleteRow = (rIdx: number) => {
    const newRows = matrixRows.filter((_, idx) => idx !== rIdx);
    setMatrixRows(newRows);
    buildCsvFromState(headers, newRows);
  };

  // 🔤 HANDLER 1: Corregir Encabezado Actual
  const handleCorrectCurrentHeaderSpelling = () => {
    if (headers.length === 0) {
      showNotification('error', 'No hay encabezados cargados para corregir');
      return;
    }
    const corrected = headers.map(h => correctSpellingAndCapitalization(h));
    setHeaders(corrected);

    const textLines = csvText.split('\n');
    if (textLines.length > 0) {
      textLines[0] = corrected.join(';');
      setCsvText(textLines.join('\n'));
    }
    showNotification('success', 'Encabezado actual corregido correctamente');
  };

  // 🔤 HANDLER 2: Corregir Horarios del Ramal
  const handleCorrectBranchSchedulesSpelling = async () => {
    if (!selectedBranchId) {
      showNotification('error', 'Selecciona un ramal primero');
      return;
    }

    setIsProcessingSpelling(true);
    try {
      const res = await fetch(`/v1/admin/table/schedules?limit=500`);
      const data = await res.json();
      if (data.success && data.rows) {
        const branchSchedules = data.rows.filter((s: any) => s.branch_id === selectedBranchId);
        let correctedCount = 0;

        for (const sched of branchSchedules) {
          let hList: string[] = [];
          try {
            hList = typeof sched.headers_json === 'string'
              ? JSON.parse(sched.headers_json)
              : sched.headers_json || [];
          } catch (_) {}

          if (hList.length > 0) {
            const corrected = hList.map(h => correctSpellingAndCapitalization(h));
            await fetch(`/v1/admin/table/schedules/${sched.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...sched, headers_json: JSON.stringify(corrected) })
            });
            correctedCount++;
          }
        }

        const currentCorrected = headers.map(h => correctSpellingAndCapitalization(h));
        setHeaders(currentCorrected);
        const textLines = csvText.split('\n');
        if (textLines.length > 0) {
          textLines[0] = currentCorrected.join(';');
          setCsvText(textLines.join('\n'));
        }

        await fetch('/v1/admin/cache/purge');
        showNotification('success', `Todos los encabezados de este ramal fueron corregidos (${correctedCount} grillas)`);
      }
    } catch (err: any) {
      showNotification('error', `Error al corregir ramal: ${err.message}`);
    } finally {
      setIsProcessingSpelling(false);
    }
  };

  // 🔤 HANDLER 3: Corregir Todos los Recorridos
  const handleCorrectAllSchedulesSpelling = async () => {
    setIsProcessingSpelling(true);
    try {
      const res = await fetch(`/v1/admin/table/schedules?limit=500`);
      const data = await res.json();
      if (data.success && data.rows) {
        let correctedCount = 0;

        for (const sched of data.rows) {
          let hList: string[] = [];
          try {
            hList = typeof sched.headers_json === 'string'
              ? JSON.parse(sched.headers_json)
              : sched.headers_json || [];
          } catch (_) {}

          if (hList.length > 0) {
            const corrected = hList.map(h => correctSpellingAndCapitalization(h));
            if (JSON.stringify(hList) !== JSON.stringify(corrected)) {
              await fetch(`/v1/admin/table/schedules/${sched.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...sched, headers_json: JSON.stringify(corrected) })
              });
              correctedCount++;
            }
          }
        }

        const currentCorrected = headers.map(h => correctSpellingAndCapitalization(h));
        setHeaders(currentCorrected);
        const textLines = csvText.split('\n');
        if (textLines.length > 0) {
          textLines[0] = currentCorrected.join(';');
          setCsvText(textLines.join('\n'));
        }

        await fetch('/v1/admin/cache/purge');
        showNotification('success', `Se corrigieron los encabezados de ${correctedCount} grillas en el sistema`);
      }
    } catch (err: any) {
      showNotification('error', `Error en corrección masiva: ${err.message}`);
    } finally {
      setIsProcessingSpelling(false);
    }
  };

  const handleOpenPreview = async () => {
    const branch = branchesList.find(b => b.id === selectedBranchId);
    if (!selectedBranchId || !branch) {
      showNotification('error', 'Por favor selecciona un ramal válido');
      return;
    }

    try {
      const dayCode = selectedDayTypeCode || 'lunes_a_viernes';
      const liveKey = `${dayCode}_${direction}`;
      const fallbackKey = `${dayCode === 'lunes_a_viernes' ? 'weekday' : dayCode}_${direction}`;

      const activeDayTypeObj = dayTypesList.find(dt => dt.code === dayCode);
      const activeDayTypeName = activeDayTypeObj?.name || (dayCode === 'lunes_a_viernes' ? 'Lunes a Viernes' : dayCode === 'sabados' ? 'Sábado' : 'Domingos y Feriados');

      const resolvedHeaders = headers.map((h, i) => {
        const alias = headerAliases[i];
        if (alias && alias.trim() !== '') return alias.trim();
        const addr = stopAddresses[i];
        if (addr && addr.trim() !== '') return addr.trim();
        return h;
      });

      const liveSchedule = {
        id: scheduleId || liveKey,
        dayType: dayCode,
        dayTypeName: activeDayTypeName,
        headers: resolvedHeaders.length > 0 ? resolvedHeaders : headers,
        aliases: headerAliases,
        addresses: stopAddresses,
        matrix: matrixRows,
        rows: matrixRows,
        direction: direction
      };

      let consolidatedSchedules: Record<string, any> = {
        [liveKey]: liveSchedule,
        [fallbackKey]: liveSchedule
      };

      try {
        const param = branch.id || branch.code;
        const res = await fetch(`/v1/catalog/public/timetables?route_id=${encodeURIComponent(param)}`);
        const json = await res.json();
        if (json.success && json.data) {
          json.data.forEach((item: any) => {
            if (item.schedules) {
              consolidatedSchedules = { ...item.schedules, ...consolidatedSchedules };
            }
          });
        }
      } catch (_) {}

      consolidatedSchedules[liveKey] = liveSchedule;
      consolidatedSchedules[fallbackKey] = liveSchedule;

      const fullRouteObj = {
        ...branch,
        code: branch.code,
        name: branch.name,
        schedules: consolidatedSchedules
      };

      setPreviewRouteData(fullRouteObj);
      setIsPreviewOpen(true);
    } catch (e: any) {
      showNotification('error', `Error al generar vista previa: ${e.message}`);
    }
  };

  // 🕒 HANDLER: Ordenar Horarios Cronológicamente
  const handleSortSchedules = () => {
    if (matrixRows.length === 0) {
      showNotification('error', 'No hay horarios cargados para ordenar');
      return;
    }

    let referenceMinutes = 240; // 04:00 por defecto
    for (const row of matrixRows) {
      const firstColVal = row[0];
      if (firstColVal && /^\d{1,2}:\d{2}/.test(firstColVal)) {
        const [h, m] = firstColVal.split(':').map(Number);
        referenceMinutes = h * 60 + m;
        break;
      }
    }

    const timeToValue = (timeStr: string): number => {
      if (!timeStr || !timeStr.includes(':')) return 999999;
      const [h, m] = timeStr.split(':').map(Number);
      let mins = h * 60 + m;
      if (mins < referenceMinutes) {
        mins += 1440;
      }
      return mins;
    };

    const sorted = [...matrixRows].sort((rowA, rowB) => {
      const valA = timeToValue(rowA[0]);
      const valB = timeToValue(rowB[0]);
      return valA - valB;
    });

    setMatrixRows(sorted);
    buildCsvFromState(headers, sorted);
    showNotification('success', 'Horarios ordenados cronológicamente');
  };

  // ❌ HANDLER: Cancelar y Recargar Datos desde la Base de Datos
  const handleCancelChanges = () => {
    if (!selectedBranchId) return;
    setRefreshTrigger(prev => prev + 1);
    showNotification('success', 'Se descartaron los cambios no guardados y se recargó la grilla desde la base de datos');
  };

  const handleSaveChanges = async () => {
    if (!selectedBranchId) {
      showNotification('error', 'Por favor selecciona un Ramal válido');
      return;
    }

    setIsSaving(true);
    try {
      const DAY_TYPE_ID_FALLBACKS: Record<string, string> = {
        'lunes_a_viernes': '88f18fc3-ba8e-521a-a093-07db0825cf3a',
        'sabados': '26453d08-1d87-57ea-910e-1e14de95a162',
        'domingos_feriados': 'ce073f89-6031-5bb6-8d6a-fc16e1b3ca1e',
        'especial': '4dd8ea7a-abb2-552e-b6da-1bb945d7c515'
      };

      const activeDayType = dayTypesList.find(dt => dt.code === selectedDayTypeCode || dt.id === selectedDayTypeCode);
      const fallbackId = DAY_TYPE_ID_FALLBACKS[selectedDayTypeCode] || selectedDayTypeCode;
      const activeDayTypeId = activeDayType?.id || fallbackId;

      const items = matrixRows.map((r, i) => ({
        departure_time: r[0] || '00:00',
        dispatch_order: i + 1,
        trip_times_json: JSON.stringify(r)
      }));

      const payload = {
        schedule: {
          id: scheduleId,
          branch_id: selectedBranchId,
          direction,
          day_types_id: activeDayTypeId,
          name: `Grilla ${activeDayType?.name || selectedDayTypeCode} (${direction})`,
          headers_json: JSON.stringify(headers),
          header_aliases_json: JSON.stringify(headerAliases),
          stop_addresses_json: JSON.stringify(stopAddresses)
        },
        items
      };

      const res = await fetch('/v1/admin/schedules/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (resJson.success) {
        if (resJson.scheduleId) {
          setScheduleId(resJson.scheduleId);
        }
        showNotification('success', 'Grilla de Horarios guardada correctamente');
        if (onRefreshData) onRefreshData();
      } else {
        throw new Error(resJson.error || 'Error al guardar la grilla');
      }
    } catch (err: any) {
      showNotification('error', `Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentBranch = branchesList.find(b => b.id === selectedBranchId);

  const idaLabel = useMemo(() => {
    return getBranchDirectionLabel(currentBranch, 'ida');
  }, [currentBranch]);

  const vueltaLabel = useMemo(() => {
    return getBranchDirectionLabel(currentBranch, 'vuelta');
  }, [currentBranch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 💾 BOTONES SUPERIORES (VISTA PREVIA + CANCELAR + GUARDAR) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
        <button
          type="button"
          onClick={handleOpenPreview}
          style={{
            padding: '0.75rem 1.35rem',
            backgroundColor: '#1f2937',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#f3f4f6',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <ExternalLinkIcon size={16} />
          <span>Vista Previa</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          disabled={isLoading || isSaving || isDeletingGrid}
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '12px',
            color: '#fca5a5',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: (isLoading || isSaving || isDeletingGrid) ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
          title="Eliminar completamente la grilla de horarios actual"
        >
          <TrashIcon size={16} color="#ef4444" />
          <span>Eliminar Grilla</span>
        </button>

        <button
          type="button"
          onClick={handleCancelChanges}
          disabled={isLoading || isSaving}
          style={{
            padding: '0.75rem 1.35rem',
            backgroundColor: '#374151',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#f3f4f6',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: (isLoading || isSaving) ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease'
          }}
        >
          <XIcon size={16} color="#9ca3af" />
          <span>Cancelar</span>
        </button>

        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={isSaving}
          style={{
            padding: '0.75rem 1.75rem',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isSaving ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.15s ease'
          }}
        >
          <SaveIcon size={16} color="#ffffff" />
          <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
        </button>
      </div>

      {/* 🔮 TOOLBAR 1: ORTOGRAFÍA & HERRAMIENTAS */}
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Fila 1: Ortografía */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ORTOGRAFÍA:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCorrectCurrentHeaderSpelling}
              disabled={isProcessingSpelling}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: '#d1d5db',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: isProcessingSpelling ? 'wait' : 'pointer'
              }}
            >
              Corregir Encabezado Actual
            </button>

            <button
              type="button"
              onClick={handleCorrectBranchSchedulesSpelling}
              disabled={isProcessingSpelling}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: '#d1d5db',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: isProcessingSpelling ? 'wait' : 'pointer'
              }}
            >
              Corregir Horarios del Ramal
            </button>

            <button
              type="button"
              onClick={handleCorrectAllSchedulesSpelling}
              disabled={isProcessingSpelling}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: '#d1d5db',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: isProcessingSpelling ? 'wait' : 'pointer'
              }}
            >
              Corregir Todos los Recorridos
            </button>
          </div>
        </div>

        {/* Fila 2: Herramientas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            HERRAMIENTAS:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsImageProcessModalOpen(true)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#34d399',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <PlusIcon size={14} />
              <span>Procesar Imagen</span>
            </button>
            {backupRawText !== null && (
              <button
                type="button"
                onClick={() => {
                  setCsvText(backupRawText);
                  const delimiter = backupRawText.includes(';') ? ';' : '\t';
                  const allRows = backupRawText.split('\n').filter(r => r.trim()).map(r => r.split(delimiter).map(c => c.trim()));
                  if (allRows.length > 0) {
                    const firstRowIsHeaders = !allRows[0].some(c => /^\d{1,2}:\d{2}/.test(c));
                    if (firstRowIsHeaders) {
                      setHeaders(allRows[0]);
                      setHeaderAliases(allRows[0].map(() => ''));
                      setStopAddresses(allRows[0].map(() => ''));
                      setMatrixRows(allRows.slice(1));
                    } else {
                      setMatrixRows(allRows);
                    }
                  } else {
                    setMatrixRows([]);
                  }
                  setBackupRawText(null);
                  showNotification('success', 'Cambios deshechos');
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Deshacer
              </button>
            )}
            <button type="button" style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0b0f19', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
              Rotar Horarios
            </button>
            <button
              type="button"
              onClick={handleAutoAssociateStops}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Auto-asociar paradas físicas por similitud de nombre con las cabeceras"
            >
              <WandIcon size={14} />
              <span>Auto-asociar Paradas</span>
            </button>
            <button
              type="button"
              onClick={handleSortSchedules}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0b0f19', color: '#d1d5db', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}
            >
              Ordenar Horarios
            </button>
            <button type="button" style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#0b0f19', color: '#d1d5db', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
              Copiar a otros Días
            </button>
          </div>
        </div>
      </div>

      {/* 🎛️ PANEL SELECTOR DE SENTIDO Y LÍNEA / RAMAL */}
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Selector de Sentido (Pills) */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0b0f19', borderRadius: '10px', padding: '0.2rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={() => setDirection('ida')}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: direction === 'ida' ? '#1f2937' : 'transparent',
              color: direction === 'ida' ? '#38bdf8' : '#9ca3af',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>➔</span>
            <span>{idaLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setDirection('vuelta')}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: direction === 'vuelta' ? '#1f2937' : 'transparent',
              color: direction === 'vuelta' ? '#38bdf8' : '#9ca3af',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>➔</span>
            <span>{vueltaLabel}</span>
          </button>
        </div>

        {/* Combos de Selección: Línea, Ramal y Tipo de Día */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>Línea:</span>
            <select
              value={selectedLineId}
              onChange={(e) => {
                setSelectedLineId(e.target.value);
                setSelectedBranchId('');
              }}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: '#0b0f19',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '10px',
                color: selectedLineId ? '#ffffff' : '#9ca3af',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Seleccione Línea</option>
              {linesList.map(line => (
                <option key={line.id} value={line.id}>
                  Línea {line.code} ({line.name})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>Ramal:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={!selectedLineId}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: '#0b0f19',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '10px',
                color: selectedBranchId ? '#ffffff' : '#9ca3af',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: selectedLineId ? 'pointer' : 'not-allowed',
                opacity: selectedLineId ? 1 : 0.6
              }}
            >
              <option value="">Seleccione Ramal</option>
              {availableBranches.map(b => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedDayTypeCode}
            onChange={(e) => setSelectedDayTypeCode(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              backgroundColor: '#0b0f19',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {dayTypesList && dayTypesList.length > 0 ? (
              dayTypesList
                .slice()
                .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                .map(dt => (
                  <option key={dt.id || dt.code} value={dt.code}>
                    {dt.name}
                  </option>
                ))
            ) : (
              <>
                <option value="lunes_a_viernes">Lunes a Viernes</option>
                <option value="sabados">Sábados</option>
                <option value="domingos_feriados">Domingos y Feriados</option>
                <option value="especial">Especial (Invierno)</option>
              </>
            )}
          </select>

          <button
            type="button"
            onClick={handleOpenDayTypeModal}
            title="Agregar nuevo Tipo de Día"
            style={{
              padding: '0.55rem 0.65rem',
              backgroundColor: '#0b0f19',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>



      {!selectedBranchId ? (
        <div style={{
          backgroundColor: '#111827',
          borderRadius: '16px',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          padding: '4rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '2.5rem', opacity: 0.6 }}>🚍</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
            Selecciona una Línea y un Ramal
          </div>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', maxWidth: '420px', margin: 0 }}>
            Para visualizar, editar o crear la grilla de horarios, selecciona primero la Línea y el Ramal correspondientes en el panel superior.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 📍 LINEA TIMELINE HORIZONTAL DE PARADAS (IDA / VUELTA) */}
          <div style={{
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>PARADAS (➔ {direction === 'ida' ? idaLabel : vueltaLabel}) - {currentBranch ? `[${currentBranch.code}] ${currentBranch.name}` : ''}</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          scrollbarWidth: 'thin'
        }}>
          {headers.map((hName, idx) => {
            const alias = stopAddresses[idx] || `${idx * 12 + 1}. Punto de control`;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', textAlign: 'center', minWidth: '120px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#ec4899',
                    border: '2px solid #ffffff'
                  }} />

                  <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
                    {hName}
                  </div>

                  <select
                    value={stopAddresses[idx] || ''}
                    onChange={(e) => {
                      const updated = [...stopAddresses];
                      updated[idx] = e.target.value;
                      setStopAddresses(updated);
                    }}
                    style={{
                      fontSize: '0.675rem',
                      fontWeight: 600,
                      color: stopAddresses[idx] ? '#34d399' : '#9ca3af',
                      backgroundColor: '#0b0f19',
                      padding: '0.2rem 0.45rem',
                      borderRadius: '6px',
                      border: `1px solid ${stopAddresses[idx] ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
                      maxWidth: '145px',
                      outline: 'none',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    title="Seleccionar Parada Física / Punto de Control"
                  >
                    <option value="">-- Sin asignar --</option>
                    {branchStops.map((st: any, sIdx: number) => (
                      <option key={st.id || sIdx} value={st.name}>
                        {sIdx + 1}. {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {idx < headers.length - 1 && (
                  <div style={{ width: '30px', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📄 ÁREA DE TEXTAREA CSV DE COPIA / PEGA DE EXCEL */}
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af' }}>
            Editor CSV Semicolon (Formato Excel):
          </span>
          <span style={{ fontSize: '0.725rem', color: '#38bdf8' }}>
            {matrixRows.length} filas | {headers.length} columnas
          </span>
        </div>

        <textarea
          rows={5}
          value={csvText}
          onChange={handleCsvChange}
          placeholder="Encabezados separadas por punto y coma;&#10;04:35;04:40;04:49..."
          style={{
            width: '100%',
            padding: '0.85rem',
            backgroundColor: '#0b0f19',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            color: '#38bdf8',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'vertical'
          }}
        />
      </div>

      {/* 📊 TABLA MATRIZ DE HORARIOS INTERACTIVA */}
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        overflow: 'hidden'
      }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
            Cargando grilla de horarios...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0b0f19', color: '#9ca3af', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.85rem', width: '45px', fontWeight: 600 }}>#</th>
                  {headers.map((h, cIdx) => (
                    <th key={cIdx} style={{ padding: '0.85rem 0.6rem', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleAddColumn(cIdx)}
                          title="Agregar nueva columna de parada a la izquierda"
                          style={{
                            padding: '0.25rem 0.4rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            color: '#34d399',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <PlusIcon size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setColToDeleteIdx(cIdx)}
                          title="Eliminar columna de parada"
                          style={{
                            padding: '0.25rem 0.4rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <TrashIcon size={12} />
                        </button>

                        <span>{h}</span>

                        {cIdx === headers.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleAddColumn(cIdx + 1)}
                            title="Agregar nueva columna de parada a la derecha"
                            style={{
                              padding: '0.25rem 0.4rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '6px',
                              color: '#34d399',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <PlusIcon size={12} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '0.85rem', textAlign: 'center', width: '90px', fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((r, rIdx) => {
                  const isSequenceNewRow = Boolean(
                    activeSequenceState &&
                    activeSequenceState.count > 0 &&
                    rIdx > activeSequenceState.sourceRowIdx &&
                    rIdx <= activeSequenceState.lastRowIdxInserted
                  );

                  return (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isSequenceNewRow
                          ? 'rgba(16, 185, 129, 0.12)'
                          : (rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'),
                        boxShadow: isSequenceNewRow ? 'inset 3px 0 0 #10b981' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '0.6rem', color: isSequenceNewRow ? '#34d399' : '#6b7280', fontWeight: isSequenceNewRow ? 700 : 600 }}>
                        {rIdx + 1}
                      </td>

                      {headers.map((_, cIdx) => {
                        const cellVal = r[cIdx] || '';
                        return (
                          <td key={cIdx} style={{ padding: '0.4rem 0.3rem' }}>
                            <input
                              type="text"
                              value={cellVal}
                              placeholder="hh:mm"
                              maxLength={5}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              style={{
                                width: '76px',
                                padding: '0.4rem 0.35rem',
                                textAlign: 'center',
                                backgroundColor: isSequenceNewRow ? 'rgba(16, 185, 129, 0.18)' : '#0b0f19',
                                border: isSequenceNewRow ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '6px',
                                color: isSequenceNewRow ? '#6ee7b7' : '#ffffff',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                          </td>
                        );
                      })}

                    <td style={{ padding: '0.4rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="number"
                          placeholder="min"
                          value={rowIntervalMinutes[rIdx] || ''}
                          onChange={(e) => {
                            setRowIntervalMinutes({ ...rowIntervalMinutes, [rIdx]: e.target.value });
                            if (activeSequenceState?.sourceRowIdx === rIdx) {
                              setActiveSequenceState(null);
                            }
                          }}
                          style={{
                            width: '65px',
                            padding: '0.25rem 0.35rem',
                            textAlign: 'center',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            borderRadius: '6px',
                            color: '#34d399',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          title="Minutos de intervalo para agregar siguiente fila"
                        />

                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={() => handleAddRowWithInterval(rIdx)}
                            title="Agregar fila abajo (con o sin intervalo de minutos)"
                            style={{
                              padding: '0.3rem 0.45rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '6px',
                              color: '#34d399',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <PlusIcon size={12} />
                          </button>

                          {activeSequenceState?.sourceRowIdx === rIdx && activeSequenceState.count > 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '-7px',
                                right: '-7px',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                borderRadius: '10px',
                                padding: '1px 5px',
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                border: '1px solid #ffffff',
                                zIndex: 5
                              }}
                              title={`Agregados en secuencia: ${activeSequenceState.count}`}
                            >
                              {activeSequenceState.count}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveSequenceState(null);
                            applySequenceToRow(rIdx);
                          }}
                          title="Autocompletar secuencia de horarios"
                          style={{
                            padding: '0.3rem 0.45rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '6px',
                            color: '#34d399',
                            cursor: 'pointer'
                          }}
                        >
                          <WandIcon size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setRowToDeleteIdx(rIdx)}
                          title="Eliminar Fila"
                          style={{
                            padding: '0.3rem 0.45rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            color: '#fca5a5',
                            cursor: 'pointer'
                          }}
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* 🔮 MODAL DE CREACIÓN DE NUEVO TIPO DE DÍA */}
      {isDayTypeModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Nuevo Tipo de Día
              </h3>
              <button
                type="button"
                onClick={() => setIsDayTypeModalOpen(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDayType} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.35rem' }}>
                  code
                </label>
                <input
                  type="text"
                  value={newDayTypeCode}
                  onChange={(e) => setNewDayTypeCode(e.target.value)}
                  placeholder="ej: lunes_a_sabados"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0b0f19',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.35rem' }}>
                  name
                </label>
                <input
                  type="text"
                  value={newDayTypeName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="ej: Lunes a Sábados"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0b0f19',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.35rem' }}>
                  display_order
                </label>
                <input
                  type="number"
                  value={newDayTypeOrder}
                  onChange={(e) => setNewDayTypeOrder(parseInt(e.target.value, 10) || 1)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#0b0f19',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isCreatingDayType}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    backgroundColor: '#0284c7',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isCreatingDayType ? 'wait' : 'pointer'
                  }}
                >
                  {isCreatingDayType ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDayTypeModalOpen(false)}
                  style={{
                    padding: '0.7rem 1.25rem',
                    backgroundColor: '#374151',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#f3f4f6',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE GRILLA */}
      {isDeleteModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <TrashIcon size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  ¿Eliminar grilla de horarios?
                </h3>
                <span style={{ fontSize: '0.775rem', color: '#9ca3af' }}>
                  Sentido: <strong style={{ color: '#38bdf8' }}>{direction.toUpperCase()}</strong>
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Esta acción eliminará <strong>todas las filas y horarios</strong> de la grilla actual para este sentido y ramal en la base de datos. ¿Estás seguro de que deseas continuar?
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                style={{
                  padding: '0.6rem 1.1rem',
                  backgroundColor: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#e5e7eb',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGrid}
                disabled={isDeletingGrid}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: isDeletingGrid ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>{isDeletingGrid ? 'Eliminando...' : 'Sí, Eliminar Grilla'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE FILA */}
      {rowToDeleteIdx !== null && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setRowToDeleteIdx(null)}
        >
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <TrashIcon size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  ¿Eliminar Fila #{rowToDeleteIdx + 1}?
                </h3>
                <span style={{ fontSize: '0.775rem', color: '#9ca3af' }}>
                  Horario inicial: <strong style={{ color: '#38bdf8' }}>{matrixRows[rowToDeleteIdx]?.[0] || 'Sin especificar'}</strong>
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Esta acción eliminará la fila <strong>#{rowToDeleteIdx + 1}</strong> de la tabla de horarios actual. ¿Estás seguro de que deseas continuar?
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRowToDeleteIdx(null)}
                style={{
                  padding: '0.6rem 1.1rem',
                  backgroundColor: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#e5e7eb',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSequenceState(null);
                  handleDeleteRow(rowToDeleteIdx);
                  setRowToDeleteIdx(null);
                }}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <TrashIcon size={14} />
                <span>Sí, Eliminar Fila</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE COLUMNA */}
      {colToDeleteIdx !== null && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setColToDeleteIdx(null)}
        >
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <TrashIcon size={22} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  ¿Eliminar Parada?
                </h3>
                <span style={{ fontSize: '0.775rem', color: '#9ca3af' }}>
                  Parada: <strong style={{ color: '#38bdf8' }}>{headers[colToDeleteIdx]}</strong>
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Esta acción eliminará la columna <strong>"{headers[colToDeleteIdx]}"</strong> y todos los horarios asociados en este ramal. ¿Estás seguro de que deseas continuar?
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setColToDeleteIdx(null)}
                style={{
                  padding: '0.6rem 1.1rem',
                  backgroundColor: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#e5e7eb',
                  fontSize: '0.825rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteColumn(colToDeleteIdx);
                  setColToDeleteIdx(null);
                }}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <TrashIcon size={14} />
                <span>Sí, Eliminar Parada</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👁️ MODAL DE VISTA PREVIA DE HORARIOS */}
      {isPreviewOpen && previewRouteData && (
        <TimetableModal
          routeCode={previewRouteData.code || previewRouteData.name || 'RAMAL'}
          routeObj={previewRouteData}
          routeData={previewRouteData}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* 🖼️ MODAL DE PROCESAR IMAGEN / OCR (WORKERS AI) */}
      {isImageProcessModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: '#111827', borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '28px', maxWidth: '560px', width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Procesar Imagen de Horarios</h3>
              </div>
              <button onClick={() => setIsImageProcessModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div
              onPaste={handlePasteImage}
              style={{
                border: selectedImagePreview ? 'none' : (isPasteAreaFocused ? '2px dashed #38bdf8' : '2px dashed rgba(255,255,255,0.2)'),
                borderRadius: '12px',
                padding: selectedImagePreview ? '0' : '36px 20px',
                textAlign: 'center',
                outline: 'none',
                cursor: selectedImagePreview ? 'default' : 'pointer',
                background: selectedImagePreview ? 'transparent' : (isPasteAreaFocused ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.02)'),
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '160px',
                transition: 'all 0.2s ease'
              }}
            >
              {!selectedImagePreview && (
                <textarea
                  autoFocus
                  onPaste={(e) => { e.preventDefault(); handlePasteImage(e as any); }}
                  onKeyDown={(e) => e.preventDefault()}
                  value=""
                  onChange={() => {}}
                  onFocus={() => setIsPasteAreaFocused(true)}
                  onBlur={() => setIsPasteAreaFocused(false)}
                  title="Haz clic derecho o Cmd+V / Ctrl+V para pegar"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'pointer', resize: 'none', zIndex: 10
                  }}
                />
              )}

              {selectedImagePreview ? (
                <div style={{ position: 'relative', display: 'inline-block', zIndex: 20 }}>
                  <img src={selectedImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.2)' }} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedImageFile(null); setSelectedImagePreview(null); }}
                    style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '26px', height: '26px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 }}>
                  <p style={{ color: '#f3f4f6', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>Haz clic o usa Cmd+V / Ctrl+V para pegar la imagen</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.825rem', marginBottom: '16px' }}>Capturas de pantalla, planillas o fotos de paradas</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#ffffff',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    📁 Seleccionar Archivo
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setSelectedImageFile(null); setSelectedImagePreview(null); setIsImageProcessModalOpen(false); }}
                disabled={isUploadingOCR}
                style={{
                  padding: '0.6rem 1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px',
                  color: '#9ca3af', fontSize: '0.825rem', fontWeight: 600, cursor: isUploadingOCR ? 'not-allowed' : 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitImageOCR}
                disabled={!selectedImageFile || isUploadingOCR}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: (!selectedImageFile || isUploadingOCR) ? '#374151' : '#0284c7',
                  color: '#ffffff', border: 'none', borderRadius: '10px',
                  fontSize: '0.825rem', fontWeight: 600,
                  cursor: (!selectedImageFile || isUploadingOCR) ? 'not-allowed' : 'pointer',
                  boxShadow: (!selectedImageFile || isUploadingOCR) ? 'none' : '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}
              >
                {isUploadingOCR ? 'Procesando con IA...' : '⚡ Procesar Imagen'}
              </button>
            </div>

            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageSelection(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
