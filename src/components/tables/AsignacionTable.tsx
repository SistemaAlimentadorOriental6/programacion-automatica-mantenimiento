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
    CircleIcon
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
}

export default function AsignacionTable({ data, assignments, onAssign, onAssignMulti, onAssignAll }: AsignacionTableProps) {
    const [contextMenu, setContextMenu] = useState<{ field: string; value: any; x: number; y: number; rowIds: string[] } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [responsables, setResponsables] = useState<{ codigo: string, nombre: string, apellido: string, cargo: string }[]>([]);
    const [tecnicos, setTecnicos] = useState<{ codigo: string, nombre: string, apellido: string, cargo: string }[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<{ bus: string, field: string, rowIds: string[], x: number, y: number } | null>(null);

    useEffect(() => {
        const fetchDatos = async () => {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Cargar ambos en paralelo
            const [resRes, resTec] = await Promise.all([
                fetch(`${API_URL}/reports/responsables`, { headers }),
                fetch(`${API_URL}/reports/tecnicos`, { headers })
            ]);

            if (resRes.ok) setResponsables(await resRes.json());
            if (resTec.ok) setTecnicos(await resTec.json());
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
        }
    };

    const handleSelectResponsable = (rowIds: string[], field: string, codigo: string) => {
        handleFieldChange(rowIds, field, codigo);
        setActiveDropdown(null);
    };

    const handleRightClick = (e: MouseEvent, field: string, value: any, rowIds: string[]) => {
        e.preventDefault();
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

    return (
        <div id="matriz-reporte" class="flex flex-col w-full relative-parent relative pb-20 scroll-reveal-card animate-entrance">
            {/* Título de Sección */}
            <div class="mb-6 flex items-center justify-between px-2">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-primary animate-pulse">
                        <HugeiconsIcon icon={FileAttachmentIcon} size={24} />
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-texto-dark tracking-tight">Matriz de Reporte Automático</h3>
                        <p class="text-[10px] font-black text-texto-grey uppercase tracking-widest opacity-60 italic">Agrupado por Vehículo - Edición Masiva Sincronizada</p>
                    </div>
                </div>
            </div>

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
                            {groupedData.map((group) => (
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
                                        const groupValue = group.taskIds.reduce((found, id) => {
                                            if (found) return found;
                                            const val = assignments[id]?.[col.key];
                                            return (val !== undefined && val !== '') ? val : '';
                                        }, '');

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
                                                            value={col.key === 'fechaInicio' ? groupValue.substring(0, 10) : groupValue}
                                                            onInput={(e) => handleFieldChange(group.taskIds, col.key, (e.target as HTMLInputElement).value)}
                                                            onMouseDown={(e) => handleInputClick(e, group.bus, col.key, group.taskIds)}
                                                            readOnly={col.key === 'codigoResponsable' || col.key === 'codigoEmpleado'}
                                                            placeholder={col.key === 'fechaInicio' ? 'AAAA-MM-DD' : '...'}
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
                    class="absolute z-[120] w-[300px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-pop-in origin-top"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div class="p-3 bg-gray-50 border-b border-gray-100">
                        <span class="text-[10px] font-black text-texto-grey uppercase tracking-widest opacity-60">
                            {activeDropdown.field === 'codigoResponsable' ? 'Seleccionar Líder' : 'Seleccionar Técnico'}
                        </span>
                    </div>
                    <div class="max-h-[250px] overflow-y-auto scroll-premium">
                        {(() => {
                            const list = activeDropdown.field === 'codigoResponsable' ? responsables : tecnicos;
                            if (list.length === 0) {
                                return <div class="p-4 text-center text-[11px] text-texto-grey font-bold">Cargando personal...</div>;
                            }
                            return list.map(emp => (
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
