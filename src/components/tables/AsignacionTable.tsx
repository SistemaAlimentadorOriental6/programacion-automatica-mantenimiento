import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { API_URL } from '../../config/api';
import {
    UserGroupIcon,
    Tick01Icon,
    ArrowDown01Icon,
    Calendar03Icon,
    Alert01Icon,
    Setting07Icon,
    FactoryIcon,
    Message01Icon,
    PackageIcon,
    PencilEdit02Icon,
    FileAttachmentIcon,
    CircleIcon,
    Search01Icon
} from '@hugeicons/core-free-icons';

interface AsignacionRow {
    id: string;
    bus: string;
    tarea: string;
    gestion: string;
    nombreDia: string;
}

interface AsignacionTableProps {
    data: AsignacionRow[];
    assignments: Record<string, Record<string, any>>;
    onAssign: (rowId: string, field: string, value: any) => void;
    onAssignMulti: (rowIds: string[], field: string, value: any) => void;
    onAssignAll: (field: string, value: any, data: AsignacionRow[]) => void;
    selectedDate?: Date;
}

export default function AsignacionTable({ data, assignments, onAssign, onAssignMulti, onAssignAll, selectedDate }: AsignacionTableProps) {
    const [contextMenu, setContextMenu] = useState<{ field: string; value: any; x: number; y: number; rowIds: string[] } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [responsables, setResponsables] = useState<{ codigo: string, nombre: string, apellido: string, cargo: string }[]>([]);
    const [tecnicos, setTecnicos] = useState<{ codigo: string, nombre: string, apellido: string, cargo: string }[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<{ bus: string, field: string, rowIds: string[], x: number, y: number } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Función para calcular fecha de inicio pronosticada
    const formatFechaInicio = (indice: number) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const fechaBase = selectedDate || new Date(); // Usar fecha seleccionada o fecha actual
        const totalMinutesRange = 460; // 21:00 a 04:40 = 7h 40min = 460min
        const minutesOffset = (indice * 10) % (totalMinutesRange + 1);

        const startHour = 21;
        const currentTotalMinutes = (startHour * 60 + minutesOffset) % (24 * 60);

        const h = Math.floor(currentTotalMinutes / 60);
        const m = currentTotalMinutes % 60;

        const fechaBaseStr = fechaBase.getFullYear() + '-' + pad(fechaBase.getMonth() + 1) + '-' + pad(fechaBase.getDate());
        return `${fechaBaseStr} ${pad(h)}:${pad(m)}:00`;
    };

    useEffect(() => {
        const fetchDatos = async () => {
            setIsLoadingData(true);
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            try {
                // Cargar ambos en paralelo
                const [resRes, resTec] = await Promise.all([
                    fetch(`${API_URL}/reports/responsables`, { headers }),
                    fetch(`${API_URL}/reports/tecnicos`, { headers })
                ]);

                if (resRes.ok) setResponsables(await resRes.json());
                if (resTec.ok) setTecnicos(await resTec.json());
            } catch (error) {
                console.error('Error cargando datos:', error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchDatos();
    }, []);

    // Lógica de agrupación por vehículo
    const groupedData = useMemo(() => {
        const groups: Record<string, { bus: string, taskIds: string[], tasks: string[], gestions: Set<string> }> = {};
        data.forEach(item => {
            if (!groups[item.bus]) {
                groups[item.bus] = { bus: item.bus, taskIds: [], tasks: [], gestions: new Set() };
            }
            groups[item.bus].taskIds.push(item.id);
            groups[item.bus].tasks.push(item.tarea);
            groups[item.bus].gestions.add(item.gestion);
        });
        return Object.values(groups);
    }, [data]);

    const handleFieldChange = (rowIds: string[], field: string, value: any) => {
        let finalValue = value;

        // Validación específica para Prioridad: Solo el primer dígito
        if (field === 'codigoPrioridad') {
            const match = value.toString().match(/\d/);
            finalValue = match ? match[0] : '';
        }

        onAssignMulti(rowIds, field, finalValue);
    };

    const handleInputClick = (e: MouseEvent, bus: string, field: string, rowIds: string[]) => {
        if (field === 'codigoResponsable' || field === 'codigoEmpleado') {
            e.stopPropagation(); // Prevenir que el click cierre el dropdown inmediatamente
            const target = e.currentTarget as HTMLElement;
            const parent = target.closest('.relative-parent');
            if (!parent) return;
            const parentRect = parent.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            setActiveDropdown({
                bus,
                field,
                rowIds,
                x: targetRect.left - parentRect.left,
                y: targetRect.bottom - parentRect.top + 5
            });
            setSearchTerm(''); // Limpiar búsqueda al abrir
        }
    };

    const handleSelectResponsable = (rowIds: string[], field: string, codigo: string) => {
        handleFieldChange(rowIds, field, codigo);
        setActiveDropdown(null);
        setSearchTerm(''); // Limpiar búsqueda al cerrar
    };

    const handleRightClick = (e: MouseEvent, field: string, value: any, rowIds: string[]) => {
        e.preventDefault();
        
        // Si es responsable o empleado Y tiene valor, aplicar automáticamente a toda la columna
        if ((field === 'codigoResponsable' || field === 'codigoEmpleado') && value && value.trim() !== '') {
            onAssignAll(field, value, data);
            return; // No mostrar menú contextual, aplicar directamente
        }
        
        // Para otros campos, mostrar menú contextual normal
        const target = e.currentTarget as HTMLElement;
        const parent = target.closest('.relative-parent');
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();

        setContextMenu({
            field,
            value: value || '',
            x: e.clientX - parentRect.left,
            y: e.clientY - parentRect.top,
            rowIds
        });
    };

    useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu(null);
            setActiveDropdown(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const columns = [
        { key: 'fechaInicio', label: 'FECHA INICIO', icon: Calendar03Icon, type: 'text', width: '250px' },
        { key: 'codigoPrioridad', label: 'PRIORIDAD', icon: Alert01Icon, type: 'text', width: '150px' },
        { key: 'codigoSubproceso', label: 'SUBPROCESO', icon: Setting07Icon, type: 'text', width: '180px' },
        { key: 'codigoZonaMaquina', label: 'CÓDIGO ZONA MÁQUINA', icon: FactoryIcon, type: 'text', width: '280px' },
        { key: 'codigoCausaBasica', label: 'CAUSA BÁSICA', icon: Message01Icon, type: 'text', width: '200px' },
        { key: 'codigoResponsable', label: 'RESPONSABLE', icon: UserGroupIcon, type: 'text', width: '250px' },
        { key: 'codigoEmpleado', label: 'EMPLEADO', icon: UserGroupIcon, type: 'text', width: '250px' },
        { key: 'observacion', label: 'OBSERVACIÓN', icon: PencilEdit02Icon, type: 'text', width: '450px' },
        { key: 'codigoEstado', label: 'CÓDIGO ESTADO', icon: CircleIcon, type: 'text', width: '180px' },
        { key: 'valorVariable', label: 'VALOR VARIABLE', icon: PackageIcon, type: 'text', width: '180px' },
    ];

    // Skeleton Loader
    const renderSkeleton = () => (
        <div class="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden p-6">
            <div class="space-y-4">
                {/* Header Skeleton */}
                <div class="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <div class="w-24 h-8 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                    <div class="w-32 h-8 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                    <div class="w-40 h-8 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                </div>
                
                {/* Rows Skeleton */}
                {[...Array(5)].map((_, i) => (
                    <div key={i} class="grid grid-cols-[120px_180px_1fr] gap-4 items-center p-4 bg-gray-50/50 rounded-2xl">
                        {/* Bus */}
                        <div class="w-20 h-8 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                        
                        {/* Gestiones */}
                        <div class="flex gap-2">
                            <div class="w-16 h-6 bg-gray-200 rounded-full animate-pulse-shimmer"></div>
                            <div class="w-16 h-6 bg-gray-200 rounded-full animate-pulse-shimmer"></div>
                        </div>
                        
                        {/* Campos */}
                        <div class="grid grid-cols-3 gap-3">
                            <div class="h-10 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                            <div class="h-10 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                            <div class="h-10 bg-gray-200 rounded-xl animate-pulse-shimmer"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (isLoadingData) {
        return (
            <div id="matriz-reporte" class="flex flex-col w-full relative-parent relative pb-20 scroll-reveal-card animate-entrance">
                {renderSkeleton()}
            </div>
        );
    }

    return (
        <div id="matriz-reporte" class="flex flex-col w-full relative-parent relative pb-20 scroll-reveal-card animate-entrance">

            {/* Contenedor de Tabla con Scroll Premium */}
            <div class="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto overflow-y-auto max-h-[70vh] scroll-premium">
                    <table class="w-full border-collapse">
                        <thead class="sticky top-0 z-30">
                            <tr class="bg-gray-50 border-b border-gray-100">
                                <th class="sticky left-0 z-20 bg-gray-50/80 backdrop-blur-sm px-6 py-6 text-[11px] font-black text-texto-grey uppercase tracking-widest w-[110px] border-r border-gray-100/50 text-left">Vehículo</th>
                                <th class="px-6 py-6 text-[11px] font-black text-texto-grey uppercase tracking-widest w-[180px] text-left">Gestiones</th>
                                <th class="px-6 py-6 text-[11px] font-black text-texto-grey uppercase tracking-widest w-[240px] text-left">Resumen Tareas</th>

                                {columns.map(col => (
                                    <th key={col.key} style={{ width: col.width, minWidth: col.width }} class="px-4 py-5 text-left">
                                        <div class="flex items-center gap-2">
                                            <div class="p-1.5 bg-primary/5 rounded-lg">
                                                <HugeiconsIcon icon={col.icon} size={12} className="text-primary" />
                                            </div>
                                            <span class="text-[11px] font-black text-texto-grey uppercase tracking-widest">{col.label}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            {groupedData.map((group, groupIndex) => (
                                <tr key={group.bus} class="group hover:bg-primary/[0.01] transition-all duration-300">
                                    {/* Vehículo - Sticky */}
                                    <td class="sticky left-0 z-10 bg-white group-hover:bg-[#fcfdfc] px-6 py-5 border-r border-gray-100/50 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                                        <span class="px-4 py-2 bg-texto-dark text-[12px] text-white rounded-xl font-black shadow-sm group-hover:scale-105 transition-transform inline-block tracking-tighter">{group.bus}</span>
                                    </td>

                                    {/* Gestiones */}
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-1">
                                            {Array.from(group.gestions).map(g => (
                                                <span class="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cc253]/10 text-[#4cc253] border border-[#4cc253]/20 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm hover:scale-105 transition-transform cursor-default">
                                                    <div class="w-1.5 h-1.5 rounded-full bg-[#4cc253] shadow-[0_0_8px_#4cc253]"></div>
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    {/* Resumen Tareas */}
                                    <td class="px-6 py-5 min-w-[240px]">
                                        <div class="flex flex-col gap-1">
                                            <span class="text-[12px] font-black text-texto-dark">{group.taskIds.length} Tareas Pendientes</span>
                                            <div class="flex flex-col gap-0.5">
                                                {group.tasks.map((task, idx) => (
                                                    <span key={idx} class="text-[10px] font-bold text-texto-grey opacity-70 uppercase leading-tight border-l-2 border-primary/20 pl-2">
                                                        {task}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Columnas Editables */}
                                    {columns.map(col => {
                                        // Buscar el primer valor no vacío entre todas las tareas del bus
                                        let groupValue = group.taskIds.reduce((found, id) => {
                                            if (found) return found;
                                            const val = assignments[id]?.[col.key];
                                            return (val !== undefined && val !== '') ? val : '';
                                        }, '');

                                        // Si es fechaInicio y no hay valor, calcular fecha pronosticada
                                        if (col.key === 'fechaInicio' && !groupValue) {
                                            groupValue = formatFechaInicio(groupIndex);
                                        }

                                        return (
                                            <td key={col.key} style={{ width: col.width, minWidth: col.width }} class="px-3 py-4">
                                                <div onContextMenu={(e) => handleRightClick(e, col.key, groupValue, group.taskIds)}>
                                                    {col.key === 'nombreDia' ? (
                                                        <div class="px-5 py-3 text-[13px] font-black text-primary bg-primary/5 rounded-xl border border-primary/10 text-center uppercase">
                                                            {groupValue || '--'}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type={col.type}
                                                            value={col.key === 'fechaInicio' ? groupValue.substring(0, 16) : groupValue}
                                                            onInput={(e) => handleFieldChange(group.taskIds, col.key, (e.target as HTMLInputElement).value)}
                                                            onMouseDown={(e) => handleInputClick(e, group.bus, col.key, group.taskIds)}
                                                            readOnly={col.key === 'codigoResponsable' || col.key === 'codigoEmpleado'}
                                                            placeholder={col.key === 'fechaInicio' ? 'AAAA-MM-DD HH:MM' : '...'}
                                                            class={`w-full bg-gray-50/40 hover:bg-white border-2 border-transparent hover:border-primary/10 rounded-xl px-5 py-3 text-[13px] font-bold text-texto-dark transition-all focus:bg-white focus:border-primary/30 focus:ring-8 focus:ring-primary/5 outline-none placeholder:text-gray-300 ${(col.key === 'codigoResponsable' || col.key === 'codigoEmpleado') ? 'cursor-pointer selection:bg-transparent' : ''}`}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Selector de Responsable (Mini-modal) */}
            {activeDropdown && (
                <div
                    style={{ left: `${activeDropdown.x}px`, top: `${activeDropdown.y}px` }}
                    class="absolute z-[120] w-[350px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-pop-in origin-top"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div class="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-b border-primary/20">
                        <span class="text-[11px] font-black text-texto-dark uppercase tracking-widest flex items-center gap-2">
                            <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-primary" />
                            {activeDropdown.field === 'codigoResponsable' ? 'Seleccionar Líder' : 'Seleccionar Técnico'}
                        </span>
                    </div>

                    {/* Buscador */}
                    <div class="p-3 border-b border-gray-100">
                        <div class="relative">
                            <HugeiconsIcon 
                                icon={Search01Icon} 
                                size={16} 
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-grey opacity-50" 
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                                placeholder="Buscar por nombre, apellido o código..."
                                class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-transparent hover:border-primary/20 focus:border-primary/40 rounded-xl text-[12px] font-bold text-texto-dark transition-all focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none placeholder:text-gray-400"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Lista de Personal */}
                    <div class="max-h-[280px] overflow-y-auto scroll-premium">
                        {(() => {
                            const list = activeDropdown.field === 'codigoResponsable' ? responsables : tecnicos;
                            if (list.length === 0) {
                                return <div class="p-6 text-center text-[11px] text-texto-grey font-bold">Cargando personal...</div>;
                            }

                            // Filtrar según término de búsqueda
                            const filteredList = list.filter(emp => {
                                const searchLower = searchTerm.toLowerCase().trim();
                                if (!searchLower) return true;
                                
                                const nombreCompleto = `${emp.nombre} ${emp.apellido}`.toLowerCase();
                                const codigo = emp.codigo.toLowerCase();
                                const cargo = emp.cargo.toLowerCase();
                                
                                return nombreCompleto.includes(searchLower) || 
                                       codigo.includes(searchLower) || 
                                       cargo.includes(searchLower);
                            });

                            if (filteredList.length === 0) {
                                return (
                                    <div class="p-6 text-center">
                                        <div class="text-[11px] text-texto-grey font-bold mb-1">No se encontraron resultados</div>
                                        <div class="text-[10px] text-texto-grey opacity-60">Intenta con otro término de búsqueda</div>
                                    </div>
                                );
                            }

                            return filteredList.map(emp => (
                                <button
                                    key={emp.codigo}
                                    onClick={() => handleSelectResponsable(activeDropdown.rowIds, activeDropdown.field, emp.codigo)}
                                    class="w-full flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-primary/[0.04] transition-colors border-b border-gray-50 last:border-none"
                                >
                                    <div class="flex items-center justify-between">
                                        <span class="text-[12px] font-black text-texto-dark">{emp.nombre} {emp.apellido}</span>
                                        <span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{emp.codigo}</span>
                                    </div>
                                    <span class="text-[9px] font-bold text-texto-grey uppercase tracking-wider">{emp.cargo}</span>
                                </button>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* Context Menu para "Asignar a todos" */}
            {contextMenu && (
                <div
                    style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    class="fixed z-[110] bg-white/80 backdrop-blur-xl rounded-[24px] shadow-[0_20px_70px_rgba(0,0,0,0.15)] border border-white/50 p-2 animate-pop-in origin-top-left"
                >
                    <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsUpdating(true);
                            onAssignAll(contextMenu.field, contextMenu.value, data);
                            // Simular feedback visual y cerrar
                            setTimeout(() => {
                                setIsUpdating(false);
                                setContextMenu(null);
                            }, 400);
                        }}
                        class={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[11px] font-black transition-all active:scale-95 whitespace-nowrap shadow-lg ${isUpdating
                                ? 'bg-emerald-100 text-emerald-600 shadow-emerald-200/50 scale-95'
                                : 'bg-[#4cc253] text-white hover:shadow-[#4cc253]/30 hover:-translate-y-0.5'
                            }`}
                    >
                        <div class={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isUpdating ? 'bg-emerald-200' : 'bg-white/20'}`}>
                            {isUpdating ? (
                                <div class="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <HugeiconsIcon icon={Tick01Icon} size={14} />
                            )}
                        </div>
                        <span>
                            {isUpdating ? 'Aplicando a todos...' : `Asignar "${contextMenu.value}" a toda la columna`}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
