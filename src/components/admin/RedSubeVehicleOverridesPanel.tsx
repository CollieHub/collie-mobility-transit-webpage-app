import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Shield, Check, X, RefreshCw, AlertTriangle, Bus } from 'lucide-react';

export interface VehicleOverride {
  id: string;
  identifier_type: 'license_plate' | 'intern' | 'vehicle_id';
  identifier_value: string;
  override_linea: string;
  override_route_short_name?: string;
  override_route_id?: string;
  override_trip_headsign?: string;
  override_agency_id?: string;
  override_agency_name?: string;
  notes?: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  showNotification?: (type: 'success' | 'error' | 'info', msg: string) => void;
  initialPreFillData?: Partial<VehicleOverride> | null;
  onClosePreFillModal?: () => void;
}

export default function RedSubeVehicleOverridesPanel({ showNotification, initialPreFillData, onClosePreFillModal }: Props) {
  const [overrides, setOverrides] = useState<VehicleOverride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VehicleOverride | null>(null);
  const [formData, setFormData] = useState<Partial<VehicleOverride>>({
    identifier_type: 'license_plate',
    identifier_value: '',
    override_linea: '',
    override_route_short_name: '',
    override_trip_headsign: '',
    override_agency_name: '',
    notes: '',
    is_active: 1
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch overrides
  const loadOverrides = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/v1/redsube/vehicle-overrides');
      const data = await res.json();
      if (data.success && Array.isArray(data.overrides)) {
        setOverrides(data.overrides);
      } else {
        if (showNotification) showNotification('error', 'No se pudieron cargar las excepciones de unidades');
      }
    } catch (err) {
      console.error(err);
      if (showNotification) showNotification('error', 'Error de conexión al cargar excepciones');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  // Si hay datos pre-llenados (desde el mapa de radar)
  useEffect(() => {
    if (initialPreFillData) {
      setEditingItem(null);
      setFormData({
        identifier_type: initialPreFillData.identifier_type || 'license_plate',
        identifier_value: initialPreFillData.identifier_value || '',
        override_linea: initialPreFillData.override_linea || '',
        override_route_short_name: initialPreFillData.override_route_short_name || initialPreFillData.override_linea || '',
        override_trip_headsign: initialPreFillData.override_trip_headsign || '',
        override_agency_name: initialPreFillData.override_agency_name || '',
        notes: initialPreFillData.notes || 'Reasignación rápida desde el Mapa Radar',
        is_active: 1
      });
      setIsModalOpen(true);
    }
  }, [initialPreFillData]);

  // Abrir modal para crear
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      identifier_type: 'license_plate',
      identifier_value: '',
      override_linea: '',
      override_route_short_name: '',
      override_trip_headsign: '',
      override_agency_name: '',
      notes: '',
      is_active: 1
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (item: VehicleOverride) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.identifier_value || !formData.override_linea) {
      if (showNotification) showNotification('error', 'Por favor completa los campos obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingItem 
        ? `/v1/redsube/vehicle-overrides/${editingItem.id}` 
        : '/v1/redsube/vehicle-overrides';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        if (showNotification) showNotification('success', editingItem ? 'Excepción actualizada' : 'Excepción creada correctamente');
        setIsModalOpen(false);
        if (onClosePreFillModal) onClosePreFillModal();
        loadOverrides();
      } else {
        if (showNotification) showNotification('error', data.error || 'Error al guardar la excepción');
      }
    } catch (err) {
      console.error(err);
      if (showNotification) showNotification('error', 'Error de red al guardar la excepción');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle estado activo
  const handleToggleActive = async (item: VehicleOverride) => {
    try {
      const updatedStatus = item.is_active === 1 ? 0 : 1;
      const res = await fetch(`/v1/redsube/vehicle-overrides/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: updatedStatus })
      });
      const data = await res.json();
      if (data.success) {
        setOverrides(prev => prev.map(o => o.id === item.id ? { ...o, is_active: updatedStatus } : o));
        if (showNotification) showNotification('info', `Excepción ${updatedStatus === 1 ? 'activada' : 'desactivada'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Eliminar
  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta regla de excepción?')) return;
    try {
      const res = await fetch(`/v1/redsube/vehicle-overrides/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (showNotification) showNotification('success', 'Excepción eliminada');
        setOverrides(prev => prev.filter(o => o.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtrado de lista
  const filteredOverrides = overrides.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      item.identifier_value.toLowerCase().includes(q) ||
      item.override_linea.toLowerCase().includes(q) ||
      (item.override_route_short_name && item.override_route_short_name.toLowerCase().includes(q)) ||
      (item.override_agency_name && item.override_agency_name.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q));

    const matchStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && item.is_active === 1) ||
      (filterStatus === 'inactive' && item.is_active === 0);

    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Header del Panel */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.6rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '0.5rem', color: '#60a5fa' }}>
            <Shield size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Excepciones de Unidades RedSUBE
              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: '#3b82f6', color: '#fff', borderRadius: '1rem', fontWeight: 600 }}>
                {overrides.length} reglas
              </span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
              Mapeo y reasignación manual de líneas, ramales y empresas para colectivos fuera de trazado.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadOverrides}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Recargar
          </button>
          <button
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            <Plus size={16} /> Nueva Excepción
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ padding: '1rem 1.5rem', backgroundColor: '#0f172a', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar por patente (ej. KVI872), interno (ej. 634), línea o nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
          {(['all', 'active', 'inactive'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                borderRadius: '0.25rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filterStatus === status ? '#3b82f6' : 'transparent',
                color: filterStatus === status ? '#ffffff' : '#94a3b8'
              }}
            >
              {status === 'all' ? 'Todas' : status === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Excepciones */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#94a3b8' }}>
            ⚡ Cargando excepciones de unidades...
          </div>
        ) : filteredOverrides.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px border-dashed #334155', color: '#94a3b8' }}>
            <AlertTriangle size={36} style={{ color: '#f59e0b', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: '0 0 0.25rem 0' }}>No se encontraron reglas de excepción</h3>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>Crea una regla manual para corregir unidades con telemetría desubicada.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Identificador</th>
                <th style={{ padding: '0.75rem 1rem' }}>Línea Reasignada</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ramal / Cabecera</th>
                <th style={{ padding: '0.75rem 1rem' }}>Empresa / Agencia</th>
                <th style={{ padding: '0.75rem 1rem' }}>Notas</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOverrides.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: item.is_active === 1 ? 'transparent' : 'rgba(15, 23, 42, 0.5)', opacity: item.is_active === 1 ? 1 : 0.6 }}>
                  {/* Identificador */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#334155', color: '#38bdf8', borderRadius: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {item.identifier_type === 'license_plate' ? 'Patente' : item.identifier_type === 'intern' ? 'Interno' : 'ID'}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{item.identifier_value}</strong>
                    </div>
                  </td>

                  {/* Línea Reasignada */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '0.375rem', fontWeight: 800, fontSize: '0.85rem' }}>
                      <Bus size={14} /> Línea {item.override_linea}
                    </span>
                  </td>

                  {/* Ramal / Cabecera */}
                  <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.override_route_short_name || item.override_linea}</div>
                    {item.override_trip_headsign && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.override_trip_headsign}</div>
                    )}
                  </td>

                  {/* Empresa */}
                  <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {item.override_agency_name || 'Sin especificar'}
                  </td>

                  {/* Notas */}
                  <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.8rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.notes || '—'}
                  </td>

                  {/* Estado Switch */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleActive(item)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '1rem',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: item.is_active === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                        color: item.is_active === 1 ? '#4ade80' : '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      {item.is_active === 1 ? <Check size={12} /> : <X size={12} />}
                      {item.is_active === 1 ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        style={{ padding: '0.4rem', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                        title="Editar Excepción"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{ padding: '0.4rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                        title="Eliminar Excepción"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Formulario de Excepción */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '520px', borderRadius: '0.75rem', border: '1px solid #334155', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', backgroundColor: '#0f172a', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} style={{ color: '#3b82f6' }} />
                {editingItem ? 'Editar Excepción de Unidad' : 'Nueva Excepción de Unidad'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tipo e Identificador */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Coincidir Por
                  </label>
                  <select
                    value={formData.identifier_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, identifier_type: e.target.value as any }))}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="license_plate">Patente (ej. KVI872)</option>
                    <option value="intern">Interno (ej. 634)</option>
                    <option value="vehicle_id">Vehicle ID (ej. 4324)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Valor / Código *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. KVI872 o 634"
                    value={formData.identifier_value || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, identifier_value: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Línea Reasignada y Ramal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Línea Correcta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. 194 o 228"
                    value={formData.override_linea || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, override_linea: e.target.value, override_route_short_name: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Nombre Ramal (Short Name)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 194A"
                    value={formData.override_route_short_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, override_route_short_name: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Destino / Headsign */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Destino / Cabecera (Headsign)
                </label>
                <input
                  type="text"
                  placeholder="ej. Zárate ⇄ Pza. Miserere por RP 6"
                  value={formData.override_trip_headsign || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, override_trip_headsign: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {/* Empresa / Agencia */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Empresa / Operadora
                </label>
                <input
                  type="text"
                  placeholder="ej. LA NUEVA METROPOL S.A."
                  value={formData.override_agency_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, override_agency_name: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {/* Notas Explicativas */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Notas Operativas
                </label>
                <textarea
                  rows={2}
                  placeholder="Motivo de la excepción (ej. Unidad trasladada a Zárate o validadora desconfigurada)..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.375rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isSaving ? 'Guardando...' : 'Guardar Excepción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
