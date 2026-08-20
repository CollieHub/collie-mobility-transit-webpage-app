import React, { useState, useEffect, useRef, useCallback } from 'react';
import RamalScheduleEditor from './RamalScheduleEditor';
import CalendarView from './CalendarView';
import RadarView from './RadarView';
import RedSubeVehicleOverridesPanel from './RedSubeVehicleOverridesPanel';
import { getBranchColor } from './RedSubeV3Panel';
import allGtfsLines from '../../lib/redsube/all_gtfs_lines.json';
import agenciesMap from '../../lib/redsube/agencies_map.json';
import {
  BuildingIcon,
  BusIcon,
  BranchIcon,
  CalendarIcon,
  ClockIcon,
  CalendarDayIcon,
  AlertIcon,
  ActivityIcon,
  MapPinIcon,
  RouteIcon,
  MegaphoneIcon,
  ShieldIcon,
  LogOutIcon,
  RefreshIcon,
  ExternalLinkIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon
} from './Icons';

interface TableMeta {
  label: string;
  primaryKey: string;
  fields: string[];
}

interface AdminDashboardProps {
  onLogout: () => void;
  onBackToApp: () => void;
}

export type SourceProvider = 'core' | 'redsube' | 'rosario' | 'uruguay';

export const SOURCE_PROVIDERS: { key: SourceProvider; label: string; icon: string; title: string }[] = [
  { key: 'core', label: 'Core', icon: '🚍', title: 'Servicio Core (Zárate / Local)' },
  { key: 'redsube', label: 'RedSUBE', icon: '🌐', title: 'Servicio RedSUBE (CABA / Nacional)' },
  { key: 'rosario', label: 'Rosario GPS', icon: '🚌', title: 'Servicio Rosario GPS' },
  { key: 'uruguay', label: 'Uruguay (Montevideo)', icon: '🇺🇾', title: 'Servicio Uruguay (Montevideo)' },
];

const NAVIGATION_GROUPS = [
  {
    title: 'Monitoreo & Trazados',
    items: [
      { key: 'radar', label: 'Radar', icon: RouteIcon },
    ]
  },
  {
    title: 'Catálogo & Red',
    items: [
      { key: 'companies', label: 'Empresas de Transporte', icon: BuildingIcon },
      { key: 'lines', label: 'Líneas', icon: BusIcon },
      { key: 'branches', label: 'Ramales', icon: BranchIcon },
      { key: 'branch_companies', label: 'Relación Ramales - Empresas', icon: BuildingIcon },
    ]
  },
  {
    title: 'Horarios & Calendarios',
    items: [
      { key: 'schedules', label: 'Horarios', icon: CalendarIcon },
      { key: 'schedule_items', label: 'Despachos / Salidas', icon: ClockIcon },
      { key: 'day_types', label: 'Tipos de Día', icon: CalendarDayIcon },
      { key: 'calendar_exceptions', label: 'Excepciones & Feriados', icon: AlertIcon },
    ]
  },
  {
    title: 'Operación & Sistema',
    items: [
      { key: 'branch_statuses', label: 'Estados Operativos', icon: ActivityIcon },
      { key: 'line_publication_statuses', label: 'Publicación de Líneas', icon: ShieldIcon },
      { key: 'branch_publication_statuses', label: 'Publicación de Ramales', icon: ShieldIcon },
      { key: 'branch_colors', label: 'Colores de Ramales', icon: ActivityIcon },
      { key: 'stops', label: 'Paradas', icon: MapPinIcon },
      { key: 'route_shapes', label: 'Trazados (Shapes)', icon: RouteIcon },
      { key: 'ads', label: 'Anuncios & Alertas', icon: MegaphoneIcon },
    ]
  },
  {
    title: 'RedSUBE (Nacional / CABA)',
    items: [
      { key: 'redsube.caba.lines', label: 'Líneas RedSUBE', icon: BusIcon },
      { key: 'redsube.caba.branches', label: 'Ramales RedSUBE', icon: BranchIcon },
      { key: 'redsube.caba.agencies', label: 'Empresas RedSUBE', icon: BuildingIcon },
      { key: 'redsube.caba.gtfs_transit_unidad_recorrido', label: 'Telemetría / GPS RedSUBE', icon: ActivityIcon },
      { key: 'redsube.vehicle_overrides', label: 'Excepciones de Unidades', icon: ShieldIcon },
      { key: 'redsube.gtfs.routes', label: 'Rutas GTFS', icon: RouteIcon },
      { key: 'redsube.gtfs.trips', label: 'Viajes GTFS', icon: ClockIcon },
      { key: 'redsube.gtfs.shapes', label: 'Trazados Shapes GTFS', icon: RouteIcon },
      { key: 'redsube.gtfs.stops', label: 'Paradas GTFS', icon: MapPinIcon },
    ]
  }
];

export default function AdminDashboard({ onLogout, onBackToApp }: AdminDashboardProps) {
  const [tables, setTables] = useState<Record<string, TableMeta>>({});
  const [activeTable, setActiveTable] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab') || urlParams.get('table');
        if (tabParam) return tabParam;

        const saved = localStorage.getItem('collie_admin_active_table') || sessionStorage.getItem('collie_admin_active_table');
        if (saved) return saved;
      }
    } catch (_) {}
    return 'radar';
  });

  useEffect(() => {
    if (activeTable && typeof window !== 'undefined') {
      try {
        localStorage.setItem('collie_admin_active_table', activeTable);
        sessionStorage.setItem('collie_admin_active_table', activeTable);

        const url = new URL(window.location.href);
        if (url.searchParams.get('tab') !== activeTable) {
          url.searchParams.set('tab', activeTable);
          window.history.replaceState(null, '', url.toString());
        }
      } catch (_) {}
    }
  }, [activeTable]);

  const [selectedSourceProvider, setSelectedSourceProvider] = useState<SourceProvider>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('collie_admin_source_provider') as SourceProvider;
        if (saved && ['core', 'redsube', 'rosario', 'uruguay'].includes(saved)) return saved;
      }
    } catch (_) {}
    return 'core';
  });

  useEffect(() => {
    try {
      localStorage.setItem('collie_admin_source_provider', selectedSourceProvider);
    } catch (_) {}
  }, [selectedSourceProvider]);
  const [rows, setRows] = useState<any[]>([]);
  const [linesList, setLinesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [dayTypesList, setDayTypesList] = useState<any[]>([]);
  const [branchStatusesList, setBranchStatusesList] = useState<any[]>([]);
  const [branchColorsList, setBranchColorsList] = useState<any[]>([]);
  const [linePubStatusesList, setLinePubStatusesList] = useState<any[]>([]);
  const [branchPubStatusesList, setBranchPubStatusesList] = useState<any[]>([]);

  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('all');
  const [preFillOverrideData, setPreFillOverrideData] = useState<any | null>(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [isLineDropdownOpen, setIsLineDropdownOpen] = useState<boolean>(false);
  const lineDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lineDropdownRef.current && !lineDropdownRef.current.contains(event.target as Node)) {
        setIsLineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLineFilterLabel = () => {
    if (selectedLineIds.size === 0) return `Todas las Líneas (${linesList.length})`;
    if (selectedLineIds.size === 1) {
      const singleId = Array.from(selectedLineIds)[0];
      const found = linesList.find(l => l.id === singleId);
      return found ? `Línea ${found.code}` : `1 Línea`;
    }
    return `${selectedLineIds.size} Líneas Seleccionadas`;
  };

  const [total, setTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPurgingCache, setIsPurgingCache] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTable === 'radar') {
      setIsSidebarCollapsed(true);
    }
  }, [activeTable]);

  const [editRow, setEditRow] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const userJson = sessionStorage.getItem('collie_admin_user');
  const currentUser = userJson ? JSON.parse(userJson) : { name: 'Admin Collie', email: 'admin@pordondeviene.com.ar' };

  const getResolvedTableName = useCallback((tableName: string, source: SourceProvider = selectedSourceProvider): string => {
    if (source === 'redsube') {
      if (tableName === 'lines') return 'arg.redsube.lines';
      if (tableName === 'branches') return 'arg.redsube.branches';
      if (tableName === 'companies') return 'arg.redsube.agencies';
      if (tableName === 'stops') return 'arg.redsube.stops';
      if (tableName === 'route_shapes') return 'arg.redsube.route_shapes';
    }
    return tableName;
  }, [selectedSourceProvider]);

  const loadAuxiliaryData = useCallback(() => {
    const targetLinesTable = selectedSourceProvider === 'redsube' ? 'arg.redsube.lines' : 'lines';
    const targetBranchesTable = selectedSourceProvider === 'redsube' ? 'arg.redsube.branches' : 'branches';

    fetch(`/v1/admin/table/${targetLinesTable}?limit=5000`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          const sorted = (data.rows || []).sort((a: any, b: any) =>
            String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
          );
          setLinesList(sorted);
        }
      })
      .catch(() => {});

    fetch(`/v1/admin/table/${targetBranchesTable}?limit=5000`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          const sorted = (data.rows || []).sort((a: any, b: any) =>
            String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
          );
          setBranchesList(sorted);
        }
      })
      .catch(() => {});
  }, [selectedSourceProvider]);

  useEffect(() => {
    loadAuxiliaryData();
    setSelectedLineIds(new Set());
    setSelectedLineFilter('all');
    setSelectedBranchFilter('all');
  }, [loadAuxiliaryData]);

  useEffect(() => {
    fetch('/v1/admin/tables')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.tables) {
          setTables(data.tables);
        }
      })
      .catch(() => {});

    fetch('/v1/admin/table/branch_statuses')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          setBranchStatusesList(data.rows || []);
        }
      })
      .catch(() => {});

    fetch('/v1/admin/table/branch_colors')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          const sorted = (data.rows || []).sort((a: any, b: any) =>
            (a.display_order ?? 0) - (b.display_order ?? 0)
          );
          setBranchColorsList(sorted);
        }
      })
      .catch(() => {});

    fetch('/v1/admin/table/line_publication_statuses')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          const sorted = (data.rows || []).sort((a: any, b: any) =>
            (a.display_order ?? 0) - (b.display_order ?? 0)
          );
          setLinePubStatusesList(sorted);
        }
      })
      .catch(() => {});

    fetch('/v1/admin/table/branch_publication_statuses')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          const sorted = (data.rows || []).sort((a: any, b: any) =>
            (a.display_order ?? 0) - (b.display_order ?? 0)
          );
          setBranchPubStatusesList(sorted);
        }
      })
      .catch(() => {});

    fetchDayTypes();
  }, []);

  const fetchDayTypes = () => {
    fetch('/v1/admin/table/day_types')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rows) {
          setDayTypesList(data.rows || []);
        }
      })
      .catch(() => {});
  };

  const fetchTableRows = useCallback((tableName: string, query = '') => {
    if (tableName === 'radar') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setSelectedRowKeys(new Set());
    const resolvedTable = getResolvedTableName(tableName, selectedSourceProvider);
    const url = `/v1/admin/table/${resolvedTable}?limit=5000&q=${encodeURIComponent(query)}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          let fetchedRows = data.rows || [];
          fetchedRows.sort((a: any, b: any) => {
            if (a.code && b.code) {
              return String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' });
            }
            if (a.name && b.name) {
              return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
            }
            return 0;
          });
          setRows(fetchedRows);
          setTotal(data.total || 0);
        } else {
          showNotification('error', data.error || 'Error al cargar registros');
        }
        setIsLoading(false);
      })
      .catch(err => {
        showNotification('error', `Error de red: ${err.message}`);
        setIsLoading(false);
      });
  }, [getResolvedTableName, selectedSourceProvider]);

  const resolvedActiveTable = getResolvedTableName(activeTable, selectedSourceProvider);
  const currentMeta = tables[resolvedActiveTable] || tables[activeTable] || { label: activeTable, primaryKey: 'id', fields: [] };

  const handleBulkSetStatus = async (statusType: 'published' | 'draft' | 'unpublished') => {
    if (selectedRowKeys.size === 0) return;
    setIsLoading(true);

    let targetStatusId = 'bpub_published';
    if (activeTable === 'lines' || resolvedActiveTable.includes('.lines')) {
      targetStatusId = statusType === 'published' ? 'lpub_published' : (statusType === 'draft' ? 'lpub_draft' : 'lpub_unpublished');
    } else {
      targetStatusId = statusType === 'published' ? 'bpub_published' : (statusType === 'draft' ? 'bpub_draft' : 'bpub_unpublished');
    }
    const statusField = (activeTable === 'lines' || resolvedActiveTable.includes('.lines')) ? 'line_publication_statuses_id' : 'branch_publication_statuses_id';

    try {
      const keysArray = Array.from(selectedRowKeys);
      for (const key of keysArray) {
        await fetch(`/v1/admin/table/${resolvedActiveTable}/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [statusField]: targetStatusId })
        });
      }
      await fetch('/v1/admin/cache/purge');
      const labelMap = { published: 'Publicado', draft: 'Borrador', unpublished: 'Despublicado' };
      showNotification('success', `Cambiado a ${labelMap[statusType]} exitosamente (${selectedRowKeys.size} registros)`);
      setSelectedRowKeys(new Set());
      fetchTableRows(activeTable, searchQuery);
    } catch (err: any) {
      showNotification('error', `Error al actualizar: ${err.message}`);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTable === 'radar') {
      setIsSidebarCollapsed(true);
      setIsLoading(false);
      return;
    }
    fetchTableRows(activeTable, searchQuery);
  }, [activeTable, selectedSourceProvider, fetchTableRows]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTableRows(activeTable, searchQuery);
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePurgeKV = async () => {
    setIsPurgingCache(true);
    try {
      const res = await fetch('/v1/admin/cache/purge');
      const data = await res.json();
      if (data.success) {
        showNotification('success', `Caché KV purgada exitosamente (${data.new_version || 'v+1'})`);
      } else {
        showNotification('error', data.message || 'Error al purgar caché');
      }
    } catch (err: any) {
      showNotification('error', `Error de conexión: ${err.message}`);
    } finally {
      setIsPurgingCache(false);
    }
  };

  const handleOpenEdit = (row: any) => {
    setEditRow(row);
    setFormData({ ...row });
  };

  const handleOpenCreate = () => {
    const initialForm: Record<string, any> = {};
    const tableMeta = currentMeta;
    if (tableMeta && tableMeta.fields) {
      tableMeta.fields.forEach(f => {
        initialForm[f] = '';
      });
    }
    if ((activeTable === 'branches' || resolvedActiveTable.includes('.branches')) && selectedLineFilter !== 'all') {
      initialForm['line_id'] = selectedLineFilter;
    }
    setFormData(initialForm);
    setIsCreateModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableMeta = currentMeta;
    if (!tableMeta) return;

    const isEditing = !!editRow;
    const pKey = tableMeta.primaryKey || 'id';
    const url = isEditing
      ? `/v1/admin/table/${resolvedActiveTable}/${encodeURIComponent(editRow[pKey])}`
      : `/v1/admin/table/${resolvedActiveTable}`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        showNotification('success', data.message || 'Guardado correctamente');
        setEditRow(null);
        setIsCreateModalOpen(false);
        fetchTableRows(activeTable, searchQuery);
        loadAuxiliaryData();
      } else {
        showNotification('error', data.error || 'Error al guardar');
      }
    } catch (err: any) {
      showNotification('error', `Error al enviar datos: ${err.message}`);
    }
  };

  const handleDeleteRow = async (row: any) => {
    const tableMeta = currentMeta;
    if (!tableMeta) return;
    const pKey = tableMeta.primaryKey || 'id';
    const recordId = row[pKey];
    const recordLabel = row.name || row.code || recordId;

    if (!window.confirm(`¿Estás seguro de eliminar el registro '${recordLabel}' de '${resolvedActiveTable}'?`)) {
      return;
    }

    try {
      const res = await fetch(`/v1/admin/table/${resolvedActiveTable}/${encodeURIComponent(recordId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', `Registro '${recordLabel}' eliminado`);
        fetchTableRows(activeTable, searchQuery);
        loadAuxiliaryData();
      } else {
        showNotification('error', data.error || 'Error al eliminar');
      }
    } catch (err: any) {
      showNotification('error', `Error de red: ${err.message}`);
    }
  };

  const isUUID = (val: any): boolean => {
    if (typeof val !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
  };

  const getAgencyDisplayName = (row: any, val: any): string => {
    const rawId = String(val || row.agency_id || '').trim();
    if (!rawId && !row.company_id) return '-';

    // 1. Direct match in agenciesMap (all 202 RedSUBE agencies)
    if (rawId && (agenciesMap as Record<string, string>)[rawId]) {
      return (agenciesMap as Record<string, string>)[rawId];
    }

    // 2. Check if row.line_id or row.code matches a line in linesList with name containing (Company)
    const foundLine = linesList.find(l => l.id === row.line_id || l.code === row.line_id || l.id === row.id);
    if (foundLine?.name && foundLine.name.includes('(') && foundLine.name.includes(')')) {
      const match = foundLine.name.match(/\((.*?)\)/);
      if (match && match[1] && !match[1].toLowerCase().startsWith('línea')) {
        return match[1].trim();
      }
    }

    // 3. Check allGtfsLines catalog by lineCode
    const lineCodeStr = String(foundLine?.code || row.line_code || row.line_id || row.code || '').trim();
    if (lineCodeStr) {
      const exact = (allGtfsLines as any[]).find(l => String(l.lineCode).trim().toLowerCase() === lineCodeStr.toLowerCase());
      if (exact?.agencyName) return exact.agencyName;

      // Try base numeric line (e.g. 194 from 194A)
      const baseCode = lineCodeStr.replace(/[^0-9]/g, '');
      if (baseCode) {
        const baseMatch = (allGtfsLines as any[]).find(l => String(l.lineCode).trim() === baseCode);
        if (baseMatch?.agencyName) return baseMatch.agencyName;
      }
    }

    // 4. Search in allGtfsLines by route_id if available
    if (row.route_id) {
      for (const l of (allGtfsLines as any[])) {
        if (Array.isArray(l.ramales) && l.ramales.some((r: any) => String(r.route_id) === String(row.route_id))) {
          if (l.agencyName) return l.agencyName;
        }
      }
    }

    if (row.company_name) return row.company_name;
    if (row.agency_name) return row.agency_name;

    return rawId ? `Empresa ${rawId}` : '-';
  };

  const availableBranchesForFilter = branchesList.filter(b => {
    if (selectedLineFilter === 'all') return true;
    return b.line_id === selectedLineFilter;
  });

  const allFields = currentMeta.fields.length > 0 ? currentMeta.fields : (rows.length > 0 ? Object.keys(rows[0]) : []);
  const displayFields = allFields.filter(f => 
    f !== 'id' && 
    f !== 'company_id' && 
    !f.endsWith('_uuid') && 
    f !== 'created_at' && 
    f !== 'last_updated' &&
    f !== 'headsign_ida' &&
    f !== 'headsign_vuelta' &&
    f !== 'route_id'
  );
  const fieldsToRender = displayFields.length > 0 ? displayFields : allFields.filter(f => f !== 'id' && f !== 'company_id');

  const displayedRows = rows
    .filter(r => {
      if (selectedLineIds.size > 0) {
        if (activeTable === 'lines' || resolvedActiveTable.includes('.lines')) {
          return selectedLineIds.has(r.id);
        }
        if (activeTable === 'branches' || resolvedActiveTable.includes('.branches')) {
          return selectedLineIds.has(r.line_id);
        }
        if (activeTable === 'schedules') {
          const branch = branchesList.find(b => b.id === r.branch_id);
          return branch ? selectedLineIds.has(branch.line_id) : true;
        }
        if (activeTable === 'stops' || activeTable === 'route_shapes' || resolvedActiveTable.includes('.stops') || resolvedActiveTable.includes('.route_shapes')) {
          const branch = branchesList.find(b => b.id === r.branch_id);
          return branch ? selectedLineIds.has(branch.line_id) : true;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (activeTable === 'day_types' || a.display_order !== undefined) {
        const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
      }
      if (a.code && b.code) {
        return String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (a.name && b.name) {
        return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
      }
      return 0;
    });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      color: '#f3f4f6',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      overflow: 'hidden'
    }}>
      {/* Toast de Notificación Minimalista */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          backgroundColor: notification.type === 'success' ? '#065f46' : notification.type === 'info' ? '#1e40af' : '#991b1b',
          color: '#ffffff',
          fontWeight: 500,
          fontSize: '0.875rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <span>{notification.message}</span>
        </div>
      )}

      {/* SIDEBAR NAVEGACIÓN LATERAL MINIMALISTA */}
      <aside style={{
        width: isSidebarCollapsed ? '72px' : '260px',
        minWidth: isSidebarCollapsed ? '72px' : '260px',
        backgroundColor: '#111827',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        zIndex: 100
      }}>
        {/* Sidebar Header Brand */}
        <div style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                <ShieldIcon size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  Admin Consola
                </h2>
                <span style={{ fontSize: '0.675rem', color: '#6b7280', fontWeight: 500 }}>
                  Cloudflare Edge D1
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6b7280',
              padding: '0.4rem',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isSidebarCollapsed ? '➔' : '⬅'}
          </button>
        </div>

        {/* Sidebar Menu Groups */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isSidebarCollapsed ? '1rem 0.4rem' : '1.25rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          scrollbarWidth: 'thin'
        }}>
          {NAVIGATION_GROUPS.map((group, gIdx) => (
            <div key={gIdx}>
              {!isSidebarCollapsed && (
                <div style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#4b5563',
                  marginBottom: '0.5rem',
                  paddingLeft: '0.75rem'
                }}>
                  {group.title}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {group.items.map(item => {
                  const isSelected = activeTable === item.key;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveTable(item.key);
                        setSearchQuery('');
                      }}
                      title={isSidebarCollapsed ? item.label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: isSidebarCollapsed ? '0.65rem' : '0.65rem 0.85rem',
                        justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                        backgroundColor: isSelected ? '#1f2937' : 'transparent',
                        color: isSelected ? '#38bdf8' : '#9ca3af',
                        border: 'none',
                        borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                        borderRadius: isSidebarCollapsed ? '8px' : '0 8px 8px 0',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <IconComp size={16} color={isSelected ? '#38bdf8' : '#9ca3af'} />
                      {!isSidebarCollapsed && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer User Info */}
        <div style={{
          padding: '0.85rem 1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: '#0b0f19'
        }}>
          {!isSidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f3f4f6', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {currentUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar Sesión"
                style={{
                  padding: '0.4rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
              >
                <LogOutIcon size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar Sesión"
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <LogOutIcon size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL DERECHO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top Action Header */}
        <header style={{
          backgroundColor: '#111827',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
              {activeTable === 'radar' ? 'Radar & Trazados' : activeTable === 'schedules' ? 'Horarios' : (currentMeta.label || activeTable)}
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {activeTable === 'radar' ? 'Monitoreo de Red y Creador de Recorridos' : `Tabla D1: ${resolvedActiveTable}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Selector Segmentado de Fuente / Proveedor (Core, RedSUBE, Rosario GPS, Uruguay) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1f2937',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                gap: '2px'
              }}
            >
              {SOURCE_PROVIDERS.map((prov) => {
                const isActive = selectedSourceProvider === prov.key;
                return (
                  <button
                    key={prov.key}
                    type="button"
                    onClick={() => {
                      setSelectedSourceProvider(prov.key);
                      showNotification?.('success', `Fuente cambiada a: ${prov.label}`);
                    }}
                    title={prov.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isActive ? '#0284c7' : 'transparent',
                      color: isActive ? '#ffffff' : '#9ca3af',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>{prov.icon}</span>
                    <span>{prov.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handlePurgeKV}
              disabled={isPurgingCache}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '10px',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: isPurgingCache ? 'wait' : 'pointer'
              }}
            >
              <RefreshIcon size={14} />
              <span>{isPurgingCache ? 'Purgando...' : 'Purgar Caché KV'}</span>
            </button>

            <button
              type="button"
              onClick={onBackToApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1rem',
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                color: '#f3f4f6',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <ExternalLinkIcon size={14} />
              <span>Ir a App Pública</span>
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {activeTable === 'radar' ? (
            <RadarView
              linesList={linesList}
              branchesList={branchesList}
              selectedSource={selectedSourceProvider}
              showNotification={showNotification}
              onOpenOverrideModal={(preFill) => {
                setPreFillOverrideData(preFill);
                setActiveTable('redsube.vehicle_overrides');
              }}
            />
          ) : activeTable === 'schedules' ? (
            <RamalScheduleEditor
              linesList={linesList}
              branchesList={branchesList}
              dayTypesList={dayTypesList}
              showNotification={showNotification}
              onRefreshData={() => {
                fetchTableRows('schedules');
                fetchDayTypes();
              }}
            />
          ) : activeTable === 'calendar_exceptions' ? (
            <CalendarView showNotification={showNotification} />
          ) : activeTable === 'redsube.vehicle_overrides' ? (
            <RedSubeVehicleOverridesPanel
              showNotification={showNotification}
              initialPreFillData={preFillOverrideData}
              onClosePreFillModal={() => setPreFillOverrideData(null)}
            />
          ) : (
            <>
              {/* Controls Bar: Selective Line & Branch Combos */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                backgroundColor: '#111827',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: '1 1 400px' }}>
                  {activeTable !== 'schedules' && activeTable !== 'schedule_items' && (
                    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 220px', maxWidth: '360px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Buscar en ${currentMeta.label}...`}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>
                          <SearchIcon size={14} />
                        </div>
                      </div>
                    </form>
                  )}

                  {['lines', 'branches', 'schedules', 'schedule_items', 'stops', 'route_shapes'].includes(activeTable) && (
                    <div style={{ position: 'relative' }} ref={lineDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsLineDropdownOpen(!isLineDropdownOpen)}
                        style={{
                          padding: '0.55rem 0.85rem',
                          backgroundColor: '#0b0f19',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <span style={{ color: '#9ca3af', fontWeight: 500 }}>Líneas:</span>
                        <span style={{ color: '#38bdf8' }}>{getLineFilterLabel()}</span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>▼</span>
                      </button>

                      {isLineDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            zIndex: 100,
                            minWidth: '280px',
                            maxWidth: '360px',
                            maxHeight: '360px',
                            overflowY: 'auto',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem'
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.45rem 0.6rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.825rem',
                              fontWeight: 600,
                              color: selectedLineIds.size === 0 ? '#38bdf8' : '#e2e8f0',
                              backgroundColor: selectedLineIds.size === 0 ? 'rgba(56, 189, 248, 0.1)' : 'transparent'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLineIds(new Set());
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLineIds.size === 0}
                              readOnly
                              style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                            />
                            <span>Todas las Líneas ({linesList.length})</span>
                          </label>

                          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />

                          {linesList.map(line => {
                            const isChecked = selectedLineIds.has(line.id);
                            return (
                              <label
                                key={line.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.6rem',
                                  padding: '0.45rem 0.6rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.825rem',
                                  color: isChecked ? '#34d399' : '#cbd5e1',
                                  backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(selectedLineIds);
                                  if (isChecked) {
                                    newSet.delete(line.id);
                                  } else {
                                    newSet.add(line.id);
                                  }
                                  setSelectedLineIds(newSet);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                />
                                <span
                                  style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: line.color || '#3b82f6',
                                    display: 'inline-block'
                                  }}
                                />
                                <span>Línea {line.code} ({line.name})</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  {selectedRowKeys.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginRight: '0.2rem' }}>
                        {selectedRowKeys.size} sel:
                      </span>

                      {(activeTable === 'lines' || activeTable === 'branches') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBulkSetStatus('published')}
                            style={{
                              padding: '0.45rem 0.85rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34d399',
                              borderRadius: '8px',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Publicar todas las filas seleccionadas"
                          >
                            <CheckIcon size={14} />
                            <span>Publicar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleBulkSetStatus('draft')}
                            style={{
                              padding: '0.45rem 0.85rem',
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fbbf24',
                              borderRadius: '8px',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Pasar a Borrador (visible únicamente para usuarios logueados)"
                          >
                            <span>📝 Borrador</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleBulkSetStatus('unpublished')}
                            style={{
                              padding: '0.45rem 0.85rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#fca5a5',
                              borderRadius: '8px',
                              fontSize: '0.775rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Despublicar todas las filas seleccionadas"
                          >
                            <span>🚫 Despublicar</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Mostrando: <strong style={{ color: '#38bdf8' }}>{displayedRows.length}</strong> de {total}
                  </span>

                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    style={{
                      padding: '0.55rem 1rem',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <PlusIcon size={14} />
                    <span>Nuevo Registro</span>
                  </button>
                </div>
              </div>

              {/* DataTable Card Minimalista */}
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                overflow: 'hidden'
              }}>
                {isLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                    Cargando registros...
                  </div>
                ) : displayedRows.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                    No se encontraron registros en <strong>{activeTable}</strong>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 270px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ backgroundColor: '#0b0f19', color: '#9ca3af', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <th style={{ padding: '0.85rem 0.75rem', width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={displayedRows.length > 0 && displayedRows.every(r => selectedRowKeys.has(String(r[currentMeta.primaryKey])))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allKeys = new Set(displayedRows.map(r => String(r[currentMeta.primaryKey])));
                                  setSelectedRowKeys(allKeys);
                                } else {
                                  setSelectedRowKeys(new Set());
                                }
                              }}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                              title="Seleccionar / deseleccionar todas las filas"
                            />
                          </th>
                          {fieldsToRender.map(col => {
                            let headerLabel = col;
                            if (col === 'line_id') headerLabel = 'Línea';
                            if (col === 'branch_id') headerLabel = 'Ramal';
                            if (col === 'agency_id') headerLabel = 'Empresa / Agencia';
                            if (col === 'headsign_ida') headerLabel = 'Sentido Ida';
                            if (col === 'headsign_vuelta') headerLabel = 'Sentido Vuelta';
                            if (col === 'jurisdiction') headerLabel = 'Jurisdicción';
                            if (col === 'day_types_id') headerLabel = 'Tipo de Día';
                            if (col === 'branch_statuses_id') headerLabel = 'Estado del servicio';
                            if (col === 'branch_colors_id') headerLabel = 'Color';
                            if (col === 'line_publication_statuses_id') headerLabel = 'Publicación en App (Línea)';
                            if (col === 'branch_publication_statuses_id') headerLabel = 'Publicación en App (Ramal)';
                            if (col === 'code_hexa') headerLabel = 'Código Hexa';
                            if (col === 'direction') headerLabel = 'Sentido';
                            if (col === 'direction_ida_label') headerLabel = 'Sentido Ida';
                            if (col === 'direction_vuelta_label') headerLabel = 'Sentido Vuelta';
                            if (col === 'display_order') headerLabel = 'Orden';
                            return (
                              <th key={col} style={{ padding: '0.85rem 1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {headerLabel}
                              </th>
                            );
                          })}
                          <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row, idx) => {
                          const rowKey = String(row[currentMeta.primaryKey] || idx);
                          const isSelected = selectedRowKeys.has(rowKey);

                          return (
                            <tr
                              key={rowKey}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')
                              }}
                            >
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newKeys = new Set(selectedRowKeys);
                                    if (e.target.checked) {
                                      newKeys.add(rowKey);
                                    } else {
                                      newKeys.delete(rowKey);
                                    }
                                    setSelectedRowKeys(newKeys);
                                  }}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                                />
                              </td>
                            {fieldsToRender.map(col => {
                              let val = row[col];
                              let isJson = false;

                              if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                                isJson = true;
                              }

                               if (col === 'code' && (activeTable === 'branches' || resolvedActiveTable.includes('.branches') || activeTable === 'routes')) {
                                 let foundColor = branchColorsList.find(c => c.id === row.branch_colors_id || c.id === row.color);
                                 if (!foundColor && row.display_order) {
                                   const dispOrd = typeof row.display_order === 'number' ? row.display_order : parseInt(row.display_order, 10);
                                   foundColor = branchColorsList.find(c => (typeof c.display_order === 'number' ? c.display_order : parseInt(c.display_order, 10)) === dispOrd);
                                 }
                                 const dynamicColor = getBranchColor(row.code);
                                 const colorHex = foundColor ? foundColor.code_hexa : (row.color && String(row.color).startsWith('#') ? row.color : (dynamicColor || '#38bdf8'));

                                 return (
                                   <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                     <span style={{
                                       display: 'inline-flex',
                                       alignItems: 'center',
                                       gap: '0.35rem',
                                       padding: '0.2rem 0.55rem',
                                       borderRadius: '6px',
                                       fontSize: '0.775rem',
                                       fontWeight: 600,
                                       backgroundColor: `${colorHex}25`,
                                       color: colorHex,
                                       border: `1px solid ${colorHex}50`
                                     }}>
                                       {val}
                                     </span>
                                   </td>
                                 );
                               }

                              if (col === 'line_id') {
                                const foundLine = linesList.find(l => l.id === val || l.code === val);
                                const lineLabel = foundLine ? `Línea ${foundLine.code}` : (row.line_code ? `Línea ${row.line_code}` : (row.company || `Línea ${val}`));

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.25)'
                                    }}>
                                      {lineLabel}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'agency_id') {
                                const agencyLabel = getAgencyDisplayName(row, val);
                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                      color: '#c084fc',
                                      border: '1px solid rgba(168, 85, 247, 0.25)',
                                      maxWidth: '260px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={agencyLabel}
                                    >
                                      {agencyLabel}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'jurisdiction') {
                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.25)'
                                    }}>
                                      {val || 'Nacional'}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'headsign_ida' || col === 'headsign_vuelta' || col === 'direction_ida_label' || col === 'direction_vuelta_label') {
                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem', fontStyle: 'italic', color: '#cbd5e1' }}>
                                    {val || '-'}
                                  </td>
                                );
                              }

                              if (col === 'branch_id') {
                                const foundBranch = branchesList.find(b => b.id === val);
                                const branchLabel = foundBranch ? `[${foundBranch.code}] ${foundBranch.name}` : val;

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.25)'
                                    }}>
                                      {branchLabel}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'day_types_id') {
                                const foundDayType = dayTypesList.find(d => d.id === val || d.code === val);
                                const dtLabel = foundDayType ? foundDayType.name : (val || 'Hábiles');

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                      color: '#fbbf24',
                                      border: '1px solid rgba(245, 158, 11, 0.25)'
                                    }}>
                                      {dtLabel}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'branch_statuses_id') {
                                const foundStatus = branchStatusesList.find(s => s.id === val || s.code === val);
                                const statusLabel = foundStatus ? foundStatus.name : (val || 'Id Interno');
                                const isNormal = foundStatus?.code === 'active' || foundStatus?.name?.toLowerCase().includes('activo') || foundStatus?.name?.toLowerCase().includes('normal');
                                const isInterrupted = foundStatus?.code === 'interrupted' || foundStatus?.name?.toLowerCase().includes('interrumpido');

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.775rem',
                                      fontWeight: 600,
                                      backgroundColor: isNormal ? 'rgba(16, 185, 129, 0.1)' : (isInterrupted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                                      color: isNormal ? '#34d399' : (isInterrupted ? '#fca5a5' : '#fbbf24'),
                                      border: `1px solid ${isNormal ? 'rgba(16, 185, 129, 0.25)' : (isInterrupted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)')}`
                                    }}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                );
                              }

                              if (col === 'branch_colors_id') {
                                let foundColor = branchColorsList.find(c => c.id === val);
                                if (!foundColor && row.display_order) {
                                  const dispOrd = typeof row.display_order === 'number' ? row.display_order : parseInt(row.display_order, 10);
                                  foundColor = branchColorsList.find(c => (typeof c.display_order === 'number' ? c.display_order : parseInt(c.display_order, 10)) === dispOrd);
                                }
                                const colorHex = foundColor ? foundColor.code_hexa : (val && val.startsWith('#') ? val : '#10b981');

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <span
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        backgroundColor: colorHex,
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                                        display: 'inline-block',
                                        verticalAlign: 'middle'
                                      }}
                                      title={foundColor?.description ? `${colorHex} (${foundColor.description})` : colorHex}
                                    />
                                  </td>
                                );
                              }

                              if (col === 'line_publication_statuses_id') {
                                const foundStatus = linePubStatusesList.find(s => s.id === val || s.code === val);
                                const rawVal = val || foundStatus?.id || 'lpub_published';

                                let statusKey: 'published' | 'draft' | 'unpublished' = 'published';
                                if (rawVal === 'lpub_draft' || foundStatus?.code === 'draft' || (foundStatus?.name && foundStatus.name.toLowerCase().includes('borrador'))) {
                                  statusKey = 'draft';
                                } else if (rawVal === 'lpub_unpublished' || foundStatus?.code === 'unpublished' || (foundStatus?.name && foundStatus.name.toLowerCase().includes('no publicado'))) {
                                  statusKey = 'unpublished';
                                }

                                const configMap = {
                                  published: { nextId: 'lpub_draft', label: 'Publicado', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)' },
                                  draft: { nextId: 'lpub_unpublished', label: 'Borrador', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' },
                                  unpublished: { nextId: 'lpub_published', label: 'No Publicado', bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.35)' }
                                };
                                const curr = configMap[statusKey];

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const newStatusId = curr.nextId;
                                        try {
                                          await fetch(`/v1/admin/table/${resolvedActiveTable}/${encodeURIComponent(row[currentMeta.primaryKey])}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ line_publication_statuses_id: newStatusId })
                                          });
                                          await fetch('/v1/admin/cache/purge');
                                          showNotification('success', 'Estado de línea actualizado');
                                          fetchTableRows(activeTable, searchQuery);
                                        } catch (err: any) {
                                          showNotification('error', `Error: ${err.message}`);
                                        }
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '6px',
                                        fontSize: '0.775rem',
                                        fontWeight: 600,
                                        backgroundColor: curr.bg,
                                        color: curr.color,
                                        border: `1px solid ${curr.border}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                      }}
                                      title="Haz clic para alternar: Publicado ➔ Borrador ➔ No Publicado"
                                    >
                                      {curr.label}
                                    </button>
                                  </td>
                                );
                              }

                              if (col === 'branch_publication_statuses_id') {
                                const foundStatus = branchPubStatusesList.find(s => s.id === val || s.code === val);
                                const rawVal = val || foundStatus?.id || 'bpub_published';

                                let statusKey: 'published' | 'draft' | 'unpublished' = 'published';
                                if (rawVal === 'bpub_draft' || foundStatus?.code === 'draft' || (foundStatus?.name && foundStatus.name.toLowerCase().includes('borrador'))) {
                                  statusKey = 'draft';
                                } else if (rawVal === 'bpub_unpublished' || foundStatus?.code === 'unpublished' || (foundStatus?.name && foundStatus.name.toLowerCase().includes('no publicado'))) {
                                  statusKey = 'unpublished';
                                }

                                const configMap = {
                                  published: { nextId: 'bpub_draft', label: 'Publicado', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)' },
                                  draft: { nextId: 'bpub_unpublished', label: 'Borrador', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' },
                                  unpublished: { nextId: 'bpub_published', label: 'No Publicado', bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.35)' }
                                };
                                const curr = configMap[statusKey];

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const newStatusId = curr.nextId;
                                        try {
                                          await fetch(`/v1/admin/table/${resolvedActiveTable}/${encodeURIComponent(row[currentMeta.primaryKey])}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ branch_publication_statuses_id: newStatusId })
                                          });
                                          await fetch('/v1/admin/cache/purge');
                                          showNotification('success', 'Estado de ramal actualizado');
                                          fetchTableRows(activeTable, searchQuery);
                                        } catch (err: any) {
                                          showNotification('error', `Error: ${err.message}`);
                                        }
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '6px',
                                        fontSize: '0.775rem',
                                        fontWeight: 600,
                                        backgroundColor: curr.bg,
                                        color: curr.color,
                                        border: `1px solid ${curr.border}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                      }}
                                      title="Haz clic para alternar: Publicado ➔ Borrador ➔ No Publicado"
                                    >
                                      {curr.label}
                                    </button>
                                  </td>
                                );
                              }

                              if (col === 'color' || col.endsWith('_color') || col.includes('color') || (typeof val === 'string' && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val.trim()))) {
                                const hexVal = String(val || '').trim();
                                const isValidHex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hexVal);

                                return (
                                  <td key={col} style={{ padding: '0.75rem 1rem' }}>
                                    {isValidHex ? (
                                      <span
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '6px',
                                          backgroundColor: hexVal,
                                          border: '1px solid rgba(255, 255, 255, 0.3)',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                                          display: 'inline-block',
                                          verticalAlign: 'middle'
                                        }}
                                        title={hexVal}
                                      />
                                    ) : (
                                      <span style={{ color: '#9ca3af' }}>{val || '-'}</span>
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td key={col} style={{ padding: '0.75rem 1rem', color: '#e5e7eb', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {isJson ? (
                                    <code style={{ fontSize: '0.725rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#9ca3af', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                      {val.length > 28 ? val.substring(0, 28) + '...' : val}
                                    </code>
                                  ) : isUUID(val) ? (
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>● Id Interno</span>
                                  ) : val !== null && val !== undefined ? String(val) : (
                                    <span style={{ color: '#6b7280', fontStyle: 'italic' }}>null</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '6px',
                                  color: '#38bdf8',
                                  fontSize: '0.775rem',
                                  cursor: 'pointer',
                                  marginRight: '0.35rem'
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '6px',
                                  color: '#fca5a5',
                                  fontSize: '0.775rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal de Alta / Edición Minimalista */}
      {(editRow || isCreateModalOpen) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(11, 15, 25, 0.85)',
          backdropFilter: 'blur(6px)',
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '85vh',
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            color: '#f3f4f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                {editRow ? `Editar Registro en '${activeTable}'` : `Nuevo Registro en '${activeTable}'`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditRow(null);
                  setIsCreateModalOpen(false);
                }}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.35rem' }}>
              {currentMeta.fields
                .filter(field => 
                  field !== 'id' && 
                  !field.endsWith('_uuid') && 
                  field !== 'created_at' && 
                  field !== 'last_updated' &&
                  field !== 'headsign_ida' &&
                  field !== 'headsign_vuelta' &&
                  field !== 'route_id'
                )
                .map(field => {
                  const isPK = field === currentMeta.primaryKey;
                  const val = formData[field] !== undefined && formData[field] !== null ? (
                    typeof formData[field] === 'object' ? JSON.stringify(formData[field], null, 2) : String(formData[field])
                  ) : '';

                  let labelText = field;
                  if (field === 'line_id') labelText = 'Línea de Transporte';
                  if (field === 'branch_id') labelText = 'Ramal de Colectivo';
                  if (field === 'agency_id') labelText = 'Empresa / Agencia';
                  if (field === 'headsign_ida') labelText = 'Sentido Ida';
                  if (field === 'headsign_vuelta') labelText = 'Sentido Vuelta';
                  if (field === 'jurisdiction') labelText = 'Jurisdicción';
                  if (field === 'day_types_id') labelText = 'Tipo de Día';
                  if (field === 'branch_statuses_id') labelText = 'Estado del servicio';
                  if (field === 'branch_colors_id') labelText = 'Color del Ramal';
                  if (field === 'line_publication_statuses_id') labelText = 'Publicación en App (Línea)';
                  if (field === 'branch_publication_statuses_id') labelText = 'Publicación en App (Ramal)';
                  if (field === 'code_hexa') labelText = 'Código Hexa';
                  if (field === 'direction_ida_label') labelText = 'Sentido Ida';
                  if (field === 'direction_vuelta_label') labelText = 'Sentido Vuelta';
                  if (field === 'display_order') labelText = 'Orden';

                  return (
                    <div key={field}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.3rem' }}>
                        {labelText} {isPK && <span style={{ color: '#38bdf8' }}>(ID Clave)</span>}
                      </label>

                      {field === 'line_id' ? (
                        <select
                          value={formData.line_id || ''}
                          onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Línea --</option>
                          {linesList.map(line => (
                            <option key={line.id} value={line.id}>
                              Línea {line.code} ({line.name})
                            </option>
                          ))}
                        </select>
                      ) : field === 'branch_id' ? (
                        <select
                          value={formData.branch_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Ramal --</option>
                          {branchesList.map(branch => (
                            <option key={branch.id} value={branch.id}>
                              [{branch.code}] {branch.name}
                            </option>
                          ))}
                        </select>
                      ) : field === 'branch_statuses_id' ? (
                        <select
                          value={formData.branch_statuses_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_statuses_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Estado del servicio --</option>
                          {branchStatusesList.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.code})
                            </option>
                          ))}
                        </select>
                      ) : field === 'branch_colors_id' ? (
                        <select
                          value={formData.branch_colors_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_colors_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Color del Ramal --</option>
                          {branchColorsList.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.code_hexa} {c.description ? `(${c.description})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : field === 'line_publication_statuses_id' ? (
                        <select
                          value={formData.line_publication_statuses_id || ''}
                          onChange={(e) => setFormData({ ...formData, line_publication_statuses_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Estado de Publicación --</option>
                          {linePubStatusesList.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.code})
                            </option>
                          ))}
                        </select>
                      ) : field === 'branch_publication_statuses_id' ? (
                        <select
                          value={formData.branch_publication_statuses_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_publication_statuses_id: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">-- Seleccionar Estado de Publicación --</option>
                          {branchPubStatusesList.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.code})
                            </option>
                          ))}
                        </select>
                      ) : field.endsWith('_json') ? (
                        <textarea
                          rows={4}
                          value={val}
                          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (field === 'color' || field.endsWith('_color') || field.includes('color') || field.includes('hexa')) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <input
                            type="text"
                            value={val}
                            placeholder="#10B981"
                            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                            style={{
                              flex: 1,
                              padding: '0.65rem 0.85rem',
                              backgroundColor: '#0b0f19',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              color: '#ffffff',
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              boxSizing: 'border-box'
                            }}
                          />
                          <div
                            style={{
                              position: 'relative',
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              backgroundColor: /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test((val || '').trim()) ? val : '#10b981',
                              border: '1px solid rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                            title="Hacé clic para elegir un color"
                          >
                            <input
                              type="color"
                              value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((val || '').trim()) ? (val.trim().length === 4 ? `#${val.trim()[1]}${val.trim()[1]}${val.trim()[2]}${val.trim()[2]}${val.trim()[3]}${val.trim()[3]}` : val.trim()) : '#10B981'}
                              onChange={(e) => setFormData({ ...formData, [field]: e.target.value.toUpperCase() })}
                              style={{
                                position: 'absolute',
                                inset: -4,
                                width: '48px',
                                height: '48px',
                                opacity: 0,
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        </div>
                      ) : field === 'display_order' ? (
                        <input
                          type="number"
                          value={val}
                          onChange={(e) => {
                            const newOrdStr = e.target.value;
                            if (activeTable === 'branches') {
                              const newOrd = parseInt(newOrdStr, 10);
                              let autoColorId = formData.branch_colors_id;
                              if (!isNaN(newOrd)) {
                                const matchedColor = branchColorsList.find(c =>
                                  (typeof c.display_order === 'number' ? c.display_order : parseInt(c.display_order, 10)) === newOrd
                                );
                                if (matchedColor) {
                                  autoColorId = matchedColor.id;
                                }
                              }
                              setFormData({
                                ...formData,
                                display_order: newOrdStr,
                                branch_colors_id: autoColorId
                              });
                            } else {
                              setFormData({ ...formData, display_order: newOrdStr });
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          disabled={isPK && editRow}
                          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem',
                            backgroundColor: isPK && editRow ? '#1f2937' : '#0b0f19',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  );
                })}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Guardar Registro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditRow(null);
                    setIsCreateModalOpen(false);
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1f2937',
                    color: '#f3f4f6',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
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
    </div>
  );
}
