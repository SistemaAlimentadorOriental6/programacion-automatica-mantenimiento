import { useState, useMemo } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

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
    onRowClick?: (tablaIndex: number, filaIndex: number, toggleAll?: boolean) => void;
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
    const itemsPerPage = 10;
    
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

    // Construir la lista de filas colapsadas para la paginación cuando grupos activos
    const collapsedData = useMemo(() => {
        if (!isGroupActive) return data;
        const seen = new Set<string>();
        return data.filter(item => {
            if (groupedBuses!.has(item.bus)) {
                if (seen.has(item.bus)) return false;
                seen.add(item.bus);
                return true;
            }
            return true;
        });
    }, [data, groupedBuses, isGroupActive]);

    // Lógica de paginación (sobre datos colapsados cuando aplique)
    const baseData = isGroupActive ? collapsedData : data;
    const totalPages = Math.ceil(baseData.length / itemsPerPage);
    const paginatedBase = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return baseData.slice(start, start + itemsPerPage);
    }, [baseData, currentPage]);

    // Expandir grupos inline dentro de la página
    const viewRows = useMemo(() => {
        type Row = { kind: 'single' | 'group-header' | 'group-row'; item: typeof data[0]; realIndex: number; isExpanded?: boolean; groupCount?: number };
        const rows: Row[] = [];
        let offset = (currentPage - 1) * itemsPerPage;

        paginatedBase.forEach((item, i) => {
            const realIndex = data.indexOf(item); // índice en data completo (para selectedRows)
            if (isGroupActive && groupedBuses!.has(item.bus)) {
                const isExpanded = expandedGroups.has(item.bus);
                const groupItems = data.filter(d => d.bus === item.bus);
                // El contenido expandido se renderiza dentro de renderGroupHeader, no aquí
                // Un bus se considera seleccionado si TIENE AL MENOS UNA tarea seleccionada
                const groupKeys = groupItems.map((_, i) => `${tablaIndex}-${data.findIndex(d => d.bus === item.bus) + i}`);
                const sel = groupKeys.some(k => selectedRows?.has(k));
                rows.push({ kind: 'group-header', item, realIndex: data.findIndex(d => d.bus === item.bus), isExpanded, groupCount: groupItems.length });
            } else {
                rows.push({ kind: 'single', item, realIndex });
            }
        });
        return rows;
    }, [paginatedBase, expandedGroups, isGroupActive, groupedBuses, data, currentPage]);

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
        const groupItems = data.filter(d => d.bus === item.bus);
        const isAnySelected = groupItems.some((_, gi_i) => {
            const firstIdxOfBus = data.findIndex(d => d.bus === item.bus);
            return selectedRows?.has(`${tablaIndex}-${firstIdxOfBus + gi_i}`);
        });
        const sel = isAnySelected;

        return (
            <div key={`group-${item.bus}`} class={`rounded-2xl overflow-hidden transition-all duration-300 ${sel ? 'ring-1 ring-primary/30' : 'ring-1 ring-primary/10'}`}>
                {/* Cabecera del Grupo */}
                <div
                    class={`grid grid-cols-[32px_1fr_28px] gap-x-2 items-center px-3 py-3.5 cursor-pointer transition-all duration-200 select-none ${
                        sel ? 'bg-primary/[0.09]' : 'bg-primary/[0.04] hover:bg-primary/[0.07]'
                    }`}
                    onClick={() => onRowClick?.(tablaIndex, realIndex, true)}
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
                                    const selectedCount = groupItems.filter((gi, gi_i) => {
                                        const giRealIndex = data.findIndex((d, di) => {
                                            let count = 0;
                                            for (let k = 0; k <= di; k++) if (data[k].bus === gi.bus) count++;
                                            return d.bus === gi.bus && count === gi_i + 1;
                                        });
                                        return selectedRows?.has(`${tablaIndex}-${giRealIndex}`);
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
                            const giRealIndex = data.findIndex((d, di) => {
                                let count = 0;
                                for (let k = 0; k <= di; k++) if (data[k].bus === gi.bus) count++;
                                return d.bus === gi.bus && count === gi_i + 1;
                            });
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
                                            <span class="text-[9px] text-texto-grey/50 font-bold">
                                                Frec: {gi.frecuencia_tarea_ultima} {gi.dato_hoy ? `| Hoy: ${gi.dato_hoy}` : ''}
                                            </span>
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
                            <span class="text-[9px] text-texto-grey/50 font-bold">
                                Frec: {item.frecuencia_tarea_ultima} {item.dato_hoy ? `| Hoy: ${item.dato_hoy}` : ''}
                            </span>
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
                class="grid grid-cols-[32px_1fr] gap-x-2 items-center rounded-2xl px-3 py-3 select-none opacity-40 border border-dashed border-gray-200 bg-gray-50/50"
                style="height: 52px"
            >
                <div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                    <span class="text-[9px] font-black">N/A</span>
                </div>
                <div class={`grid ${gridColsRow} gap-2 items-center`}>
                    <div class="min-w-0 overflow-hidden">
                        <span class="block truncate text-[13px] font-extrabold text-gray-400">
                            {bus}
                        </span>
                    </div>
                    <div class="min-w-0 overflow-hidden flex items-center gap-2">
                        <span class="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Sin Tareas</span>
                        <div class="flex-1 h-[1.5px] bg-gray-100 rounded-full"></div>
                        <span class="text-[11px] font-bold text-gray-300">---</span>
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
