import { useState, useMemo } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons';

interface MiniTableProps {
    title: string;
    icon: any;
    accentColor: string;
    data: { bus: string; tarea: string; estado?: string; cantidad?: number; busTotal?: number; isPlaceholder?: boolean; frecuencia_tarea_ultima?: string; dato_hoy?: string }[];
    showCantidad?: boolean;
    selectedRows?: Set<string>;
    tablaIndex?: number;
    isLoading?: boolean;
    groupedBuses?: Set<string>;
    onRowClick?: (tablaIndex: number, filaIndex: number, toggleAll?: boolean, busName?: string, deselectBelow?: boolean) => void;
    onRowDoubleClick?: (tablaIndex: number, filaIndex: number) => void;
}

export default function MiniTable({ 
    title, 
    icon, 
    accentColor, 
    data, 
    showCantidad = false, 
    selectedRows, 
    tablaIndex = 0, 
    isLoading = false,
    groupedBuses,
    onRowClick,
    onRowDoubleClick
}: MiniTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const itemsPerPage = 30;
    
    const parseNum = (str: any) => {
        if (!str) return 0;
        const s = str.toString();
        const match = s.match(/\(([\d,.]+)\)/) || s.match(/([\d,.]+)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    };

    const getSeverity = (item: any) => {
        if (item.isPlaceholder) return -2000;
        const f = parseNum(item.frecuencia_tarea_ultima);
        const h = parseNum(item.dato_hoy);
        if (f <= 0) return -1000;

        const ratio = h / f;
        const e = (item.estado || '').toLowerCase();
        // Vencida: ratio > 1 (e.g. 1.2 para 20% exceso)
        if (e.includes('vencida')) return ratio; 
        // Próxima: ratio < 1 (e.g. 0.9 para 90% del límite, ratio-1 = -0.1)
        if (e.includes('proximo') || e.includes('proxima')) return ratio - 1;
        // En tiempo o normal
        return -500;
    };

    const calculatePercentage = (frec: string | undefined, hoy: string | undefined, estado: string | undefined) => {
        if (!frec || !hoy) return null;
        const f = parseNum(frec);
        const h = parseNum(hoy);
        if (f <= 0) return null;

        const ratio = h / f;
        const e = (estado || '').toLowerCase();
        const isVencida = e.includes('vencida');
        const isProxima = e.includes('proximo') || e.includes('proxima');

        if (isVencida) {
            return { percent: `${((ratio - 1) * 100).toFixed(1)}%`, label: 'EXCESO', color: 'text-red-500' };
        } else if (isProxima) {
            return { percent: `${(ratio * 100).toFixed(1)}%`, label: 'AL', color: 'text-orange-500' };
        }
        return null;
    };

    const getStatusStyle = (estado: string) => {
        const e = (estado || '').toLowerCase();
        if (e.includes('vencida')) return 'bg-red-50 text-red-600 border-red-100';
        if (e.includes('proximo') || e.includes('proxima')) return 'bg-orange-50 text-orange-600 border-orange-100';
        if (e.includes('en tiempo')) return 'bg-green-50 text-green-600 border-green-100';
        return 'bg-gray-50 text-gray-600 border-gray-100';
    };

    const isSelected = (filaIndex: number) => selectedRows?.has(`${tablaIndex}-${filaIndex}`) ?? false;
    const isGroupActive = groupedBuses && groupedBuses.size > 0;

    const toggleGroup = (bus: string, e: Event) => {
        e.stopPropagation();
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(bus)) next.delete(bus);
            else next.add(bus);
            return next;
        });
    };

    // Ordenar los datos por severidad antes de procesar agrupamiento o paginación
    const sortedData = useMemo(() => {
        if (!data || data.length === 0) return data;

        let currentData = data;
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase().trim();
            currentData = data.filter(d => 
                d.bus.toLowerCase().includes(lower) || 
                (d.tarea && d.tarea.toLowerCase().includes(lower))
            );
        }

        // Si hay grupos activos, mantenemos el orden de los buses del padre para la alineación
        if (isGroupActive) {
            const busGroups = new Map<string, any[]>();
            const busOrder: string[] = [];
            
            currentData.forEach(item => {
                if (!busGroups.has(item.bus)) {
                    busGroups.set(item.bus, []);
                    busOrder.push(item.bus);
                }
                if (!item.isPlaceholder) {
                    busGroups.get(item.bus)!.push(item);
                }
            });

            const result: typeof data = [];
            busOrder.forEach(bus => {
                const tasks = busGroups.get(bus)!;
                if (tasks.length > 0) {
                    // Ordenamos las tareas dentro de cada bus por su severidad
                    tasks.sort((a, b) => getSeverity(b) - getSeverity(a));
                    result.push(...tasks);
                } else {
                    // Si es un placeholder, lo mantenemos tal cual para preservar la alineación
                    result.push({ bus, isPlaceholder: true });
                }
            });
            return result;
        }

        // Sin agrupación: ordenar por severidad y luego elevar seleccionados al tope
        const porSeveridad = [...currentData].sort((a, b) => {
            const sA = getSeverity(a);
            const sB = getSeverity(b);
            if (sA !== sB) return sB - sA;
            return a.bus.localeCompare(b.bus);
        });

        const selBuses = new Set<string>();
        selectedRows?.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            if (tIdx === tablaIndex && data[fIdx] && !data[fIdx].isPlaceholder) {
                selBuses.add(data[fIdx].bus);
            }
        });

        return [
            ...porSeveridad.filter(d => selBuses.has(d.bus)),
            ...porSeveridad.filter(d => !selBuses.has(d.bus)),
        ];
    }, [data, isGroupActive, selectedRows, tablaIndex, searchTerm]);

    // Construir la lista de filas colapsadas para la paginación cuando grupos activos
    // IMPORTANTE: cuando isGroupActive, el padre (DashboardGrid) ya trae el orden correcto
    // por grupos de presencia. Solo deduplicamos sin reordenar para mantener la alineación.
    const collapsedData = useMemo(() => {
        if (!isGroupActive) return sortedData;
        const seen = new Set<string>();
        return sortedData.filter(item => {
            if (seen.has(item.bus)) return false;
            seen.add(item.bus);
            return true;
        });
    }, [sortedData, isGroupActive]);

    // Lógica de paginación (sobre datos colapsados cuando aplique)
    const baseData = isGroupActive ? collapsedData : sortedData;
    const totalPages = Math.ceil(baseData.length / itemsPerPage);
    const paginatedBase = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return baseData.slice(start, start + itemsPerPage);
    }, [baseData, currentPage]);

    // Expandir grupos inline dentro de la página
    const viewRows = useMemo(() => {
        type Row = { kind: 'single' | 'group-header' | 'group-row'; item: typeof data[0]; realIndex: number; isExpanded?: boolean; groupCount?: number };
        const rows: Row[] = [];

        paginatedBase.forEach((item) => {
            // Calcular el índice en data (displayData de DashboardGrid)
            let realIndex: number;
            if (item.isPlaceholder) {
                // Placeholder: buscar por nombre de bus, necesitamos el índice del primer item de ese bus
                const firstOfBus = data.findIndex(d => d.bus === item.bus && !d.isPlaceholder);
                realIndex = firstOfBus >= 0 ? firstOfBus : 0;
            } else {
                realIndex = data.indexOf(item);
            }
            
            if (isGroupActive) {
                const isExpanded = expandedGroups.has(item.bus);
                const groupItems = sortedData.filter(d => d.bus === item.bus);
                rows.push({ kind: 'group-header', item, realIndex, isExpanded, groupCount: groupItems.length });
            } else {
                rows.push({ kind: 'single', item, realIndex });
            }
        });
        return rows;
    }, [paginatedBase, expandedGroups, isGroupActive, data, sortedData, tablaIndex]);

    // Ajustamos las columnas del grid: Bus fijo | Tarea flexible con truncado | Total fijo
    const gridColsHeader = showCantidad ? 'grid-cols-[75px_minmax(0,1fr)_50px]' : 'grid-cols-[75px_minmax(0,1fr)]';
    const gridColsRow    = showCantidad ? 'grid-cols-[75px_minmax(0,1fr)_50px]' : 'grid-cols-[75px_minmax(0,1fr)]';

    const renderSkeleton = () => (
        <div class="px-3 pb-3 flex flex-col gap-2">
            {[...Array(10)].map((_, i) => (
                <div key={i} class="grid grid-cols-[32px_1fr] gap-x-2 items-center rounded-2xl px-3 py-3">
                    <div class="w-7 h-7 rounded-full bg-gray-200 animate-pulse-shimmer"></div>
                    <div class={`grid ${gridColsRow} gap-2 items-center`}>
                        <div class="h-4 bg-gray-200 rounded-md animate-pulse-shimmer w-16"></div>
                        <div class="h-4 bg-gray-100 rounded-md animate-pulse-shimmer w-full"></div>
                        {showCantidad && <div class="h-6 bg-gray-200 rounded-lg animate-pulse-shimmer w-8 ml-auto"></div>}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderGroupHeader = (row: ReturnType<typeof viewRows>[0]) => {
        const { item, realIndex, isExpanded, groupCount } = row;
        const groupItems = sortedData.filter(d => d.bus === item.bus);
        const isAnySelected = groupItems.some((gi) => {
            return selectedRows?.has(`${tablaIndex}-${data.indexOf(gi)}`);
        });
        const sel = isAnySelected;

        return (
            <div key={`group-${item.bus}`} class={`rounded-2xl overflow-hidden transition-all duration-300 ${sel ? 'ring-1 ring-primary/30' : 'ring-1 ring-primary/10'}`}>
                {/* Cabecera del Grupo */}
                <div
                    class={`grid grid-cols-[32px_1fr_28px] gap-x-2 items-center px-3 py-3.5 cursor-pointer transition-all duration-200 select-none ${
                        sel ? 'bg-primary/[0.09]' : 'bg-primary/[0.04] hover:bg-primary/[0.07]'
                    }`}
                    onClick={() => onRowClick?.(tablaIndex, realIndex, true, item.bus)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onRowClick?.(tablaIndex, realIndex, true, item.bus, true);
                    }}
                >
                    {/* Check circular */}
                    <div class={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        sel ? 'bg-primary scale-110 shadow-sm shadow-primary/30' : 'border-2 border-primary/40 bg-white'
                    }`}>
                        {sel && (
                            <svg class="w-4 h-4 text-white animate-check" fill="none" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="2,7 5.5,10.5 12,3.5" />
                            </svg>
                        )}
                    </div>

                    {/* Info del Bus */}
                    <div class={`grid ${gridColsRow} gap-2 min-w-0 overflow-hidden items-center`}>
                        <div class="min-w-0 overflow-hidden">
                            <span class="block truncate text-[13px] font-extrabold text-primary">
                                {item.bus}
                            </span>
                        </div>
                        <div class="min-w-0 overflow-hidden">
                            <span class="block text-[11px] font-semibold text-primary/70">
                                {groupCount} tarea{groupCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        {showCantidad && (
                            <div class="flex justify-end pr-1 flex-shrink-0">
                                {(() => {
                                    const selectedCount = groupItems.filter((gi) => {
                                        return selectedRows?.has(`${tablaIndex}-${data.indexOf(gi)}`);
                                    }).length;
                                    
                                    return (
                                        <div class={`inline-flex items-center justify-center min-w-[24px] h-[24px] px-1.5 rounded-lg text-[11px] font-black transition-all duration-300 shadow-sm ${
                                            selectedCount > 0 
                                            ? 'bg-primary text-white scale-105' 
                                            : 'bg-primary/10 text-primary/40 border border-primary/10'
                                        }`}>
                                            {selectedCount}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Chevron Expandir/Colapsar */}
                    <button
                        class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-primary hover:bg-primary/10 transition-all duration-200"
                        onClick={(e) => toggleGroup(item.bus, e)}
                        title={isExpanded ? 'Colapsar' : 'Ver tareas'}
                    >
                        <svg class={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Panel expandido — tareas dentro de la misma tarjeta */}
                {isExpanded && (
                    <div class="border-t border-primary/10 bg-white px-3 py-2 flex flex-col gap-0.5 animate-group-expand">
                        {groupItems.map((gi, gi_i) => {
                            const giRealIndex = data.indexOf(gi);
                            const giSel = selectedRows?.has(`${tablaIndex}-${giRealIndex}`) ?? false;
                            return (
                                <div
                                    key={`${item.bus}-t${gi_i}`}
                                    onClick={() => onRowClick?.(tablaIndex, giRealIndex, false)}
                                    class={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer transition-all duration-200 select-none ${
                                        giSel ? 'bg-primary/[0.07]' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div class={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200 ${giSel ? 'bg-primary scale-125' : 'bg-primary/30'}`}></div>
                                    <div class="flex flex-col min-w-0 flex-1 gap-0.5">
                                        <div class="flex items-center gap-2 overflow-hidden">
                                            <span class={`text-[12px] font-semibold leading-tight break-words transition-colors duration-200 ${giSel ? 'text-primary' : 'text-texto-grey'}`}>
                                                {gi.tarea}
                                            </span>
                                            {gi.estado && (
                                                <span class={`px-1.5 py-0.5 text-[8px] font-black rounded-md border flex-shrink-0 uppercase tracking-tighter ${getStatusStyle(gi.estado)}`}>
                                                    {gi.estado}
                                                </span>
                                            )}
                                        </div>
                                        {gi.frecuencia_tarea_ultima && (
                                            <div class="flex items-center gap-1.5 overflow-hidden">
                                                <span class="text-[9px] text-texto-grey/50 font-bold whitespace-nowrap">
                                                    Frec: {gi.frecuencia_tarea_ultima} {gi.dato_hoy ? `| Hoy: ${gi.dato_hoy}` : ''}
                                                </span>
                                                {(() => {
                                                    const p = calculatePercentage(gi.frecuencia_tarea_ultima, gi.dato_hoy, gi.estado);
                                                    if (!p) return null;
                                                    return (
                                                        <span class={`text-[9px] font-black uppercase tracking-tighter ${p.color} bg-current/10 px-1 rounded-sm`}>
                                                            {p.label} {p.percent}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    {gi.cantidad !== undefined && (
                                        <div class={`ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-lg text-[11px] font-bold flex-shrink-0 transition-all duration-200 ${
                                            giSel ? 'bg-primary text-white' : 'bg-fondo-soft text-texto-dark border border-gray-100'
                                        }`}>
                                            {gi.cantidad}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderSingleRow = (row: ReturnType<typeof viewRows>[0]) => {
        const { item, realIndex } = row;
        const sel = isSelected(realIndex);
        return (
            <div
                key={realIndex}
                onClick={() => onRowClick?.(tablaIndex, realIndex, false)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onRowClick?.(tablaIndex, realIndex, false, undefined, true);
                }}
                onDblClick={() => onRowDoubleClick?.(tablaIndex, realIndex)}
                class={`grid grid-cols-[32px_1fr] gap-x-2 items-center rounded-2xl px-3 py-3.5 cursor-pointer transition-all duration-300 select-none ${
                    sel ? 'bg-primary/[0.07] ring-1 ring-primary/20' : 'hover:bg-gray-50'
                }`}
            >
                {/* Indicador Circular */}
                <div class={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    sel ? 'bg-primary scale-110 shadow-sm shadow-primary/30' : 'border-2 border-gray-200 bg-white hover:border-primary/50'
                }`}>
                    {sel && (
                        <svg class="w-4 h-4 text-white animate-check" fill="none" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="2,7 5.5,10.5 12,3.5" />
                        </svg>
                    )}
                </div>

                {/* Contenido Dinámico */}
                <div class={`grid ${gridColsRow} gap-2 min-w-0 overflow-hidden items-center`}>
                    <div class="min-w-0 overflow-hidden">
                        <span class={`block truncate text-[12px] font-extrabold transition-colors duration-300 ${sel ? 'text-primary' : 'text-texto-dark'}`}>
                            {item.bus}
                        </span>
                    </div>
                    <div class="min-w-0 overflow-hidden flex flex-col gap-0.5">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <span class={`block text-[12px] font-semibold leading-tight break-words transition-colors duration-300 ${sel ? 'text-texto-dark' : 'text-texto-grey'}`}>
                                {item.tarea}
                            </span>
                            {item.estado && (
                                <span class={`px-1.5 py-0.5 text-[8px] font-black rounded-md border flex-shrink-0 uppercase tracking-tighter ${getStatusStyle(item.estado)}`}>
                                    {item.estado}
                                </span>
                            )}
                        </div>
                        {item.frecuencia_tarea_ultima && (
                            <div class="flex items-center gap-1.5 overflow-hidden">
                                <span class="text-[9px] text-texto-grey/50 font-bold whitespace-nowrap">
                                    Frec: {item.frecuencia_tarea_ultima} {item.dato_hoy ? `| Hoy: ${item.dato_hoy}` : ''}
                                </span>
                                {(() => {
                                    const p = calculatePercentage(item.frecuencia_tarea_ultima, item.dato_hoy, item.estado);
                                    if (!p) return null;
                                    return (
                                        <span class={`text-[9px] font-black uppercase tracking-tighter ${p.color} bg-current/10 px-1 rounded-sm`}>
                                            {p.label} {p.percent}
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    {showCantidad && (
                        <div class="flex justify-end pr-1 flex-shrink-0">
                            <div class={`inline-flex items-center justify-center min-w-[24px] h-[24px] px-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 ${
                                sel ? 'bg-primary text-white scale-110' : 'bg-fondo-soft text-texto-dark border border-gray-100'
                            }`}>
                                {item.cantidad}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPlaceholderRow = (bus: string) => {
        return (
            <div
                class="grid grid-cols-[32px_1fr] gap-x-2 items-center rounded-2xl px-3 py-3 select-none opacity-30 border border-dashed border-gray-200 bg-gray-50/30"
                style="height: 52px"
            >
                <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
                    <span class="text-[8px] font-black">—</span>
                </div>
                <div class={`grid ${gridColsRow} gap-2 items-center`}>
                    <div class="min-w-0 overflow-hidden">
                        <span class="block truncate text-[12px] font-extrabold text-gray-300">
                            {bus}
                        </span>
                    </div>
                    <div class="min-w-0 overflow-hidden flex items-center gap-2">
                        <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Vacío</span>
                        <div class="flex-1 h-[1px] bg-gray-100 rounded-full"></div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div class="bg-white rounded-[32px] border border-gray-100 overflow-hidden flex flex-col h-full transition-shadow duration-300 hover:shadow-xl" style="box-shadow: 0 4px 24px rgba(0,0,0,0.06)">
            {/* Header */}
            <div class="p-6 flex items-center gap-4 border-b border-gray-50">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md transition-transform duration-300 hover:scale-105" style={{ backgroundColor: accentColor }}>
                    <HugeiconsIcon icon={icon} size={20} />
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-base text-texto-dark leading-tight">{title}</h4>
                    <p class="text-[10px] font-extrabold text-texto-grey uppercase tracking-widest mt-0.5">Gestión de Tareas</p>
                </div>
                {isGroupActive && (
                    <div class="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-lg">
                        <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        <span class="text-[10px] font-extrabold text-primary uppercase tracking-widest">Agrupado</span>
                    </div>
                )}
            </div>

            {/* Buscador */}
            <div class="px-5 py-3 border-b border-gray-50 bg-gray-50/30">
                <div class="relative flex items-center">
                    <div class="absolute left-3 text-gray-400">
                        <HugeiconsIcon icon={Search01Icon} size={14} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Buscar bus o tarea..." 
                        value={searchTerm}
                        onInput={(e) => {
                            setSearchTerm((e.target as HTMLInputElement).value);
                            setCurrentPage(1);
                        }}
                        class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Tabla Dinámica */}
            <div class="flex-1 overflow-auto">
                <div class="px-4 pt-5 pb-2 grid grid-cols-[32px_1fr] gap-x-2 items-center mb-1">
                    <div></div>
                    <div class={`grid ${gridColsHeader} gap-2`}>
                        <span class="text-[10px] font-extrabold text-texto-grey uppercase tracking-widest pl-2">Bus</span>
                        <span class="text-[10px] font-extrabold text-texto-grey uppercase tracking-widest">Tarea</span>
                        {showCantidad && <span class="text-[10px] font-extrabold text-texto-grey uppercase tracking-widest text-right pr-2">Total</span>}
                    </div>
                </div>

                {isLoading ? renderSkeleton() : (
                    <div class="px-3 pb-3 flex flex-col gap-2 min-h-[350px]">
                        {viewRows.map(row => {
                            if (row.item.isPlaceholder) return renderPlaceholderRow(row.item.bus);
                            if (row.kind === 'group-header') return renderGroupHeader(row);
                            if (row.kind === 'group-row') return null; // Renderizado dentro del header
                            return renderSingleRow(row);
                        })}

                        {viewRows.length === 0 && (
                            <div class="flex flex-col items-center justify-center py-10 opacity-40">
                                <HugeiconsIcon icon={icon} size={32} />
                                <p class="text-[12px] font-bold mt-2">No hay tareas</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer con Paginación */}
            <div class="p-5 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
                <span class="text-[11px] font-bold text-texto-grey uppercase tracking-widest">
                    Total: <span class="text-texto-dark">{isLoading ? '...' : data.filter(d => !d.isPlaceholder).length}</span>
                </span>
                
                {!isLoading && (
                    <div class="flex items-center gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            class="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-texto-grey disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-all shadow-sm"
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                        </button>
                        <span class="text-[10px] font-bold text-texto-dark w-8 text-center">
                            {currentPage} <span class="text-texto-grey">/ {totalPages || 1}</span>
                        </span>
                        <button 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            class="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-texto-grey disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-all shadow-sm"
                        >
                            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes check {
                    0%   { opacity: 0; stroke-dashoffset: 18; transform: scale(0.6); }
                    60%  { transform: scale(1.1); }
                    100% { opacity: 1; stroke-dashoffset: 0; transform: scale(1); }
                }
                .animate-check {
                    stroke-dasharray: 18;
                    animation: check 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes group-expand {
                    from { opacity: 0; transform: translateY(-4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-group-expand {
                    animation: group-expand 0.2s ease-out forwards;
                }
                @keyframes pulse-shimmer {
                    0%   { background-color: #f3f4f6; }
                    50%  { background-color: #e5e7eb; }
                    100% { background-color: #f3f4f6; }
                }
                .animate-pulse-shimmer {
                    animation: pulse-shimmer 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    );
}
