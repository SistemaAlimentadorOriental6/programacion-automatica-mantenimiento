import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { API_URL } from '../../config/api';
import {
    DropletIcon,
    Settings01Icon,
    Search01Icon,
    Maximize01Icon,
    Minimize01Icon,
    Layers01Icon,
    Cancel01Icon,
    ArrowRight01Icon,
    Alert01Icon,
    Tick01Icon
} from '@hugeicons/core-free-icons';

import MiniTable from '../tables/MiniTable.tsx';
import AsignacionTable from '../tables/AsignacionTable.tsx';

// Componente para mostrar una columna agrupada en la vista completa
interface FullViewColumnProps {
    icon: any;
    title: string;
    data: any[];
    accentColor: string;
    allBusesOrdered: string[]; // Lista ordenada de TODOS los buses (para alineación)
    filteredBuses: Set<string>; // Solo mostrar estos buses (los que se repiten)
    selectedRows: Set<string>;
    onRowClick: (tablaIndex: number, filaIndex: number, toggleAll?: boolean, busName?: string, deselectBelow?: boolean) => void;
    tablaIndex: number;
}

function FullViewColumn({ icon, title, data, accentColor, allBusesOrdered, filteredBuses, selectedRows, onRowClick, tablaIndex }: FullViewColumnProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Agrupar datos por bus
    const groupedData = (data || []).reduce((acc, item) => {
        if (item.isPlaceholder) return acc;
        if (!acc[item.bus]) {
            acc[item.bus] = [];
        }
        acc[item.bus].push(item);
        return acc;
    }, {} as Record<string, typeof data>);

    const toggleGroup = (bus: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(bus)) next.delete(bus);
            else next.add(bus);
            return next;
        });
    };

    // FILTRAR: Solo mostrar buses que tengan AL MENOS UNA tarea seleccionada
    // FILTRAR: Solo mostrar buses que tengan AL MENOS UNA tarea seleccionada
    const busesToShow = useMemo(() => {
        // Obtener buses únicos de los datos de esta columna
        const uniqueBusesInData = [...new Set((data || []).filter(d => !d.isPlaceholder).map(d => d.bus))];

        // Usar el orden global si existe, o el orden natural de los datos
        const baseList = (allBusesOrdered && allBusesOrdered.length > 0) ? allBusesOrdered : uniqueBusesInData;

        // Si el bus no está en el orden global pero está en los datos, asegurarnos de incluirlo al final
        const fullBaseList = [...baseList];
        uniqueBusesInData.forEach(b => {
            if (!fullBaseList.includes(b)) fullBaseList.push(b);
        });

        return fullBaseList.filter(bus => {
            const busTasksIndices = data
                .map((d, i) => (d.bus === bus && !d.isPlaceholder ? i : -1))
                .filter(i => i !== -1);
            return busTasksIndices.some(idx => selectedRows.has(`${tablaIndex}-${idx}`));
        });
    }, [data, allBusesOrdered, selectedRows, tablaIndex]);

    // Calcular TOTAL de buses únicos seleccionados para esta columna
    const totalBusesSeleccionados = busesToShow.length;

    return (
        <div class="bg-gray-50 rounded-[24px] overflow-hidden flex flex-col h-full min-h-0 border border-gray-100">
            {/* Header Columna con contador dinámico */}
            <div class="p-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${accentColor}15` }}>
                        <HugeiconsIcon icon={icon} size={18} style={{ color: accentColor }} />
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-texto-dark tracking-tight">{title}</h3>
                        <p class="text-[9px] text-texto-grey font-bold uppercase tracking-widest opacity-60">Seleccionados</p>
                    </div>
                </div>
                <div class="px-2.5 py-1 rounded-lg text-xs font-black shadow-sm" style={{ backgroundColor: accentColor, color: 'white' }}>
                    {totalBusesSeleccionados}
                </div>
            </div>

            {/* Scrollable Content */}
            <div class="flex-1 overflow-y-auto p-3 custom-scrollbar">
                <div class="space-y-3">
                    {busesToShow.length === 0 ? (
                        <div class="flex flex-col items-center justify-center py-10 px-4 text-center opacity-30">
                            <HugeiconsIcon icon={Search01Icon} size={28} className="mb-2" />
                            <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Sin selección</p>
                        </div>
                    ) : (
                        busesToShow.map(bus => {
                            const allTasksForBus = groupedData[bus] || [];
                            // Filtrar para mostrar solo las tareas REALMENTE seleccionadas
                            const tareasSeleccionadas = allTasksForBus.filter((t, idx) => {
                                if (t.isPlaceholder || !t.tarea?.trim()) return false;
                                // Necesitamos encontrar el realIndex original
                                let occurrence = 0;
                                const taskRealIndex = data.findIndex((d, di) => {
                                    if (d.bus === bus && !d.isPlaceholder) {
                                        if (occurrence === idx) return true;
                                        occurrence++;
                                    }
                                    return false;
                                });
                                return taskRealIndex !== -1 && selectedRows.has(`${tablaIndex}-${taskRealIndex}`);
                            });

                            const isExpanded = expandedGroups.has(bus);
                            const totalBus = tareasSeleccionadas.length;

                            return (
                                <div key={bus} class="bg-white rounded-xl overflow-hidden shadow-sm border border-primary/20 ring-1 ring-primary/5 transition-all duration-300">
                                    {/* Header del grupo (Bus) */}
                                    <button
                                        onClick={() => toggleGroup(bus)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            // Encontrar el realIndex del primer item de este bus para deseleccionar hacia abajo
                                            const firstIdx = data.findIndex((d: any) => d.bus === bus && !d.isPlaceholder);
                                            if (firstIdx !== -1) onRowClick?.(tablaIndex, firstIdx, true, bus, true);
                                        }}
                                        class="w-full grid grid-cols-[36px_1fr_auto_auto] gap-2 items-center p-3 hover:bg-gray-50 transition-all duration-200"
                                    >
                                        <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                                            <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                <polyline points="20,6 9,17 4,12" />
                                            </svg>
                                        </div>

                                        <div class="text-left min-w-0">
                                            <p class="text-xs font-black text-primary truncate tracking-tight">{bus}</p>
                                            <p class="text-[9px] text-texto-grey font-bold uppercase tracking-tight">
                                                {totalBus} {totalBus === 1 ? 'Tarea' : 'Tareas'}
                                            </p>
                                        </div>

                                        <div class="text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[22px] text-center bg-primary/10 text-primary border border-primary/20">
                                            {totalBus}
                                        </div>

                                        <div class={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                                            <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-primary/40" />
                                        </div>
                                    </button>

                                    {/* Tareas seleccionadas */}
                                    {isExpanded && (
                                        <div class="border-t border-gray-50 bg-gray-50/30 py-2 px-2.5 space-y-1 animate-slide-down">
                                            {tareasSeleccionadas.map((tarea, idx) => (
                                                <div
                                                    key={`${bus}-${idx}`}
                                                    class="flex flex-col gap-1 py-1.5 px-1 rounded-lg bg-primary/5 text-primary select-none"
                                                >
                                                    <div class="grid grid-cols-[30px_1fr_auto] gap-2 items-center">
                                                        <div class="flex justify-center">
                                                            <div class="w-1 h-1 rounded-full bg-primary scale-125"></div>
                                                        </div>
                                                        <div class="flex items-center gap-2 overflow-hidden">
                                                            <span class="text-[10px] font-bold uppercase break-words">{tarea.tarea}</span>
                                                            {tarea.estado && (
                                                                <span class={`px-1 py-0.5 text-[7px] font-black rounded-md border flex-shrink-0 uppercase tracking-tighter ${tarea.estado.toLowerCase().includes('vencida') ? 'bg-red-50 text-red-600 border-red-100' :
                                                                        (tarea.estado.toLowerCase().includes('proximo') || tarea.estado.toLowerCase().includes('proxima')) ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                            'bg-green-50 text-green-600 border-green-100'
                                                                    }`}>
                                                                    {tarea.estado}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {tarea.cantidad && tarea.cantidad > 1 ? (
                                                            <span class="text-[9px] font-black px-1 py-0.5 rounded border bg-primary text-white border-primary">
                                                                {tarea.cantidad}
                                                            </span>
                                                        ) : (
                                                            <span class="text-[9px] font-bold text-gray-300 opacity-0">--</span>
                                                        )}
                                                    </div>

                                                    {(tarea.frecuencia_tarea_ultima || tarea.dato_hoy) && (
                                                        <div class="pl-[30px] flex items-center gap-2">
                                                            <span class="text-[8px] text-texto-grey/50 font-bold uppercase tracking-tighter">
                                                                {tarea.frecuencia_tarea_ultima && `F: ${tarea.frecuencia_tarea_ultima}`}
                                                                {tarea.frecuencia_tarea_ultima && tarea.dato_hoy && ' | '}
                                                                {tarea.dato_hoy && `H: ${tarea.dato_hoy}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slide-down {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-down {
                    animation: slide-down 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

export default function DashboardGrid() {
    const [expanded, setExpanded] = useState<number | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [assignments, setAssignments] = useState<Record<string, Record<string, any>>>({});
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Estados para datos de las minitablas
    interface TareaData {
        bus: string;
        tarea: string;
        estado?: string;
        cantidad?: number;
        isPlaceholder?: boolean;
        frecuencia_tarea_ultima?: string;
        dato_hoy?: string;
        taxonomia_4?: string;
        tipo?: string;
    }

    const [lubricacionMotorData, setLubricacionMotorData] = useState<TareaData[]>([]);
    const [rawLubricacionMotorData, setRawLubricacionMotorData] = useState<TareaData[]>([]);
    const [isLoadingLubricacionMotor, setIsLoadingLubricacionMotor] = useState(true);

    const [lubricacionChasisData, setLubricacionChasisData] = useState<TareaData[]>([]);
    const [rawLubricacionChasisData, setRawLubricacionChasisData] = useState<TareaData[]>([]);
    const [isLoadingLubricacionChasis, setIsLoadingLubricacionChasis] = useState(true);
    const [diagnosticoData, setDiagnosticoData] = useState<TareaData[]>([]);
    const [rawDiagnosticoData, setRawDiagnosticoData] = useState<TareaData[]>([]);
    const [isLoadingDiagnostico, setIsLoadingDiagnostico] = useState(true);
    const [engraseData, setEngraseData] = useState<TareaData[]>([]);
    const [rawEngraseData, setRawEngraseData] = useState<TareaData[]>([]);
    const [isLoadingEngrase, setIsLoadingEngrase] = useState(true);

    const priorityRef = useRef<'vencidas' | 'proximas' | 'ambas' | null>(null);
    const busFilterRef = useRef<'todos' | 'pares' | 'impares'>('todos');
    const excludedBusesRef = useRef<Set<string>>(new Set());

    // Ref para restaurar selecciones por bus+tarea al navegar entre días
    const pendingRestoreRef = useRef<Array<{ bus: string, tarea: string, tablaIndex: number }> | null>(null);

    // Límites de selección por vehículo (no por tarea)
    const SELECTION_LIMITS = {
        1: 12, // Lubricación Motor
        2: 15, // Engrase
        3: 30, // Diagnóstico
        4: 12  // Lubricación Chasis
    };

    const [alertModal, setAlertModal] = useState<string | null>(null);

    // Estadísticas de selección
    const selectionStats = useMemo(() => {
        const stats = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>(), 4: new Set<string>() };
        const buses = new Set<string>();
        selectedRows.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            const data = tIdx === 1 ? lubricacionMotorData : tIdx === 2 ? engraseData : tIdx === 3 ? diagnosticoData : lubricacionChasisData;
            if (data[fIdx] && !data[fIdx].isPlaceholder) {
                stats[tIdx as 1 | 2 | 3 | 4].add(data[fIdx].bus);
                buses.add(data[fIdx].bus);
            }
        });

        // La cuota compartida es la unión de los buses de Motor y Chasis
        const lubricacionCombinada = new Set([...stats[1], ...stats[4]]);

        const tableBuses = {
            1: Array.from(stats[1]),
            2: Array.from(stats[2]),
            3: Array.from(stats[3]),
            4: Array.from(stats[4])
        };

        return {
            1: lubricacionCombinada.size,
            2: stats[2].size,
            3: stats[3].size,
            4: lubricacionCombinada.size,
            allBuses: Array.from(buses),
            tableBuses
        };
    }, [selectedRows, lubricacionMotorData, engraseData, diagnosticoData, lubricacionChasisData]);

    useEffect(() => {
        const handleAgruparEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const p = detail?.priority !== undefined ? detail.priority : priorityRef.current;
            const bf = detail?.busFilter !== undefined ? detail.busFilter : busFilterRef.current;
            const tf = detail?.typeFilter !== undefined ? detail.typeFilter : 'todos';
            if (detail?.excludedBuses) {
                excludedBusesRef.current = new Set(detail.excludedBuses);
            }
            handleAgrupar(p, bf, tf);
        };
        const handleLoadDay = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                if (detail.excludedBuses) {
                    excludedBusesRef.current = new Set(detail.excludedBuses);
                }
                // Restaurar assignments del día
                if (detail.assignments) {
                    setAssignments(detail.assignments);
                }
                // Guardar los identificadores bus+tarea para restaurar después del agrupado
                if (detail.busTask && detail.busTask.length > 0) {
                    pendingRestoreRef.current = detail.busTask;
                } else {
                    // Sin selección previa: limpiar el estado
                    pendingRestoreRef.current = null;
                    setSelectedRows(new Set());
                }
                // Re-agrupar — la restauración ocurre al final de handleAgrupar
                handleAgrupar(priorityRef.current, busFilterRef.current, 'todos');
            }
        };
        const handleVistaCompleta = () => {
            setShowFullView(true);
        };

        const handleDateChanged = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.selectedDate) {
                const newDate = new Date(detail.selectedDate);
                setSelectedDate(newDate);
                // Los assignments se restaurarán en handleLoadDay
            }
        };

        window.addEventListener('dashboard-agrupar', handleAgruparEvent);
        window.addEventListener('dashboard-load-day', handleLoadDay);
        window.addEventListener('dashboard-vista-completa', handleVistaCompleta);
        window.addEventListener('dashboard-date-changed', handleDateChanged);

        return () => {
            window.removeEventListener('dashboard-agrupar', handleAgruparEvent);
            window.removeEventListener('dashboard-load-day', handleLoadDay);
            window.removeEventListener('dashboard-vista-completa', handleVistaCompleta);
            window.removeEventListener('dashboard-date-changed', handleDateChanged);
        };
    }, [lubricacionMotorData, lubricacionChasisData, engraseData, diagnosticoData, rawLubricacionMotorData, rawLubricacionChasisData, rawEngraseData, rawDiagnosticoData]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [repeatedBuses, setRepeatedBuses] = useState<Set<string>>(new Set());
    const [repeatedBusOrder, setRepeatedBusOrder] = useState<Map<string, number>>(new Map());
    const [showFullView, setShowFullView] = useState(false);

    // Utilidad para extraer el ID de la tarea
    const extractTaskId = (text?: string): string | null => {
        if (!text) return null;
        const match = text.match(/ID:\s*(\d+)/);
        return match ? match[1] : null;
    };

    const handleAgrupar = (
        priority?: 'vencidas' | 'proximas' | 'ambas' | null,
        busFilter: 'todos' | 'pares' | 'impares' = 'todos',
        typeFilter: 'todos' | 'RUNNER' | 'AGRALE' | 'NPR' = 'todos'
    ) => {
        setIsProcessing(true);

        setTimeout(() => {
            // Lógica de filtrado por tipo de vehículo
            const isBusMatchFilter = (bus: string, item: any) => {
                // 1. Filtro Par/Impar
                let matchParity = true;
                if (busFilter !== 'todos') {
                    const numMatch = bus.match(/\d+/g);
                    if (numMatch) {
                        const lastNum = parseInt(numMatch[numMatch.length - 1], 10);
                        const isEven = lastNum % 2 === 0;
                        matchParity = busFilter === 'pares' ? isEven : !isEven;
                    } else {
                        matchParity = false;
                    }
                }

                // 2. Filtro de Tipo (Dato oficial desde el servidor)
                let matchType = true;
                if (typeFilter !== 'todos') {
                    matchType = item.tipo === typeFilter;
                }

                return matchParity && matchType;
            };

            const filterData = (data: TareaData[], tablaIndex: number) => (data || []).filter(d => {
                if (excludedBusesRef.current.has(`${tablaIndex}-${d.bus}`)) return false;
                // El filtro de bus (todos/pares/impares) y tipo solo aplica a Engrase (2) y Diagnóstico (3)
                if (tablaIndex === 1 || tablaIndex === 4) return true;
                return isBusMatchFilter(d.bus, d);
            });

            const currentLubMotorData = filterData(rawLubricacionMotorData, 1);
            const currentLubChasisData = filterData(rawLubricacionChasisData, 4);
            const currentEngData = filterData(rawEngraseData, 2);
            const currentDiagData = filterData(rawDiagnosticoData, 3);

            const busesLubMotor = new Set(currentLubMotorData.map(d => d.bus));
            const busesLubChasis = new Set(currentLubChasisData.map(d => d.bus));
            const busesEng = new Set(currentEngData.map(d => d.bus));
            const busesDiag = new Set(currentDiagData.map(d => d.bus));

            // 1. Identificar en cuántas TABLAS tiene selección manual cada bus (Prioridad absoluta)
            const tablesCheckedForBus = new Map<string, Set<number>>();
            selectedRows.forEach(key => {
                const [tIdx, fIdx] = key.split('-').map(Number);
                const d = tIdx === 1 ? lubricacionMotorData : tIdx === 2 ? engraseData : tIdx === 3 ? diagnosticoData : lubricacionChasisData;
                if (d[fIdx] && !d[fIdx].isPlaceholder) {
                    const bus = d[fIdx].bus;
                    if (!tablesCheckedForBus.has(bus)) tablesCheckedForBus.set(bus, new Set());
                    tablesCheckedForBus.get(bus)!.add(tIdx);
                }
            });

            const lubMotorCounts = currentLubMotorData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);
            const lubChasisCounts = currentLubChasisData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);
            const engCounts = currentEngData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);
            const diagCounts = currentDiagData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);

            // Identificar buses con tareas prioritarias (vencidas/proximas) y calcular nivel de urgencia
            const parseNumber = (str: any) => {
                if (!str) return 0;
                const s = str.toString();
                // Intentar extraer número entre paréntesis primero, luego número simple
                const match = s.match(/\(([\d,.]+)\)/) || s.match(/([\d,.]+)/);
                if (!match) return 0;
                return parseFloat(match[1].replace(/,/g, ''));
            };

            const busesUrgentes = new Set<string>();
            const busUrgencyScore = new Map<string, number>();

            const buscarUrgencia = (lista: any[]) => {
                lista.forEach(d => {
                    if (d.isPlaceholder || !d.estado) return;

                    const freq = parseNumber(d.frecuencia_tarea_ultima);
                    const hoy = parseNumber(d.dato_hoy);
                    const score = freq > 0 ? hoy / freq : 0;

                    // El score lo guardamos siempre para desempatar
                    const currentMax = busUrgencyScore.get(d.bus) || 0;
                    if (score > currentMax) busUrgencyScore.set(d.bus, score);

                    const est = d.estado.toLowerCase();
                    const esVencida = est.includes('vencida');
                    const esProxima = est.includes('proximo') || est.includes('proxima');

                    // El match de "busesUrgentes" sigue el filtro de prioridad
                    const matchVencida = (priority === 'vencidas' || priority === 'ambas' || !priority) && esVencida;
                    const matchProxima = (priority === 'proximas' || priority === 'ambas') && esProxima;

                    if (matchVencida || matchProxima) {
                        busesUrgentes.add(d.bus);
                    }
                });
            };
            buscarUrgencia(currentLubMotorData);
            buscarUrgencia(currentLubChasisData);
            buscarUrgencia(currentEngData);
            buscarUrgencia(currentDiagData);

            // 2. Determinar todos los buses para habilitar el agrupamiento en MiniTable
            const allBuses = new Set([...busesLubMotor, ...busesLubChasis, ...busesEng, ...busesDiag]);
            setRepeatedBuses(allBuses);

            // 3. SELECCIÓN AUTOMÁTICA
            const tempSelected = new Set<string>();
            const busesSeleccionadosPorTabla: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };

            const CUOTAS = {
                1: 12,  // Lubricación Motor
                2: 15,  // Engrase
                3: 30,  // Diagnóstico
                4: 12,  // Lubricación Chasis
            };

            const tareaCoincide = (d: any): boolean => {
                if (!d.estado) return false;
                const est = d.estado.toLowerCase();
                const esVencida = est.includes('vencida');
                const esProxima = est.includes('proximo') || est.includes('proxima');
                if (priority === 'vencidas') return esVencida;
                if (priority === 'proximas') return esProxima;
                if (priority === 'ambas') return esVencida || esProxima;
                return esVencida || esProxima;
            };

            // Para Diagnóstico (y potencialmente otras con cuota independiente)
            const seleccionarPorCategoria = (lista: any[], tablaIdx: 1 | 2 | 3 | 4) => {
                const cuotaTotal = CUOTAS[tablaIdx];
                const busTareas = new Map<string, { indices: number[]; scoreMax: number; cantidadTareas: number }>();

                lista.forEach((d, i) => {
                    if (d.isPlaceholder || !tareaCoincide(d)) return;

                    const freq = parseNumber(d.frecuencia_tarea_ultima);
                    const hoy = parseNumber(d.dato_hoy);
                    const score = freq > 0 ? hoy / freq : 0;

                    if (!busTareas.has(d.bus)) {
                        busTareas.set(d.bus, { indices: [], scoreMax: 0, cantidadTareas: 0 });
                    }
                    const entrada = busTareas.get(d.bus)!;
                    entrada.indices.push(i);
                    entrada.cantidadTareas++;
                    if (score > entrada.scoreMax) entrada.scoreMax = score;
                });

                const todosLosBuses: [string, { indices: number[]; scoreMax: number; cantidadTareas: number }][] = [];
                busTareas.forEach((entrada, bus) => {
                    todosLosBuses.push([bus, entrada]);
                });

                todosLosBuses.sort((a, b) => {
                    if (b[1].scoreMax !== a[1].scoreMax) return b[1].scoreMax - a[1].scoreMax;
                    return b[1].cantidadTareas - a[1].cantidadTareas;
                });

                const setBuses = busesSeleccionadosPorTabla[tablaIdx];
                const marcarBus = (bus: string, entrada: { indices: number[]; scoreMax: number }) => {
                    setBuses.add(bus);
                    entrada.indices.forEach(i => tempSelected.add(`${tablaIdx}-${i}`));
                };

                const seleccionados = todosLosBuses.slice(0, cuotaTotal);
                seleccionados.forEach(([bus, entrada]) => marcarBus(bus, entrada));
            };

            // Para Motor: límite de 12 vehículos por urgencia. Chasis no selecciona nada automáticamente.
            const seleccionarMotor = () => {
                const cuotaLub = 12;
                const busTareasLub = new Map<string, { scoreMax: number; cantidadTareas: number }>();

                currentLubMotorData.forEach(d => {
                    if (d.isPlaceholder || !tareaCoincide(d)) return;
                    const freq = parseNumber(d.frecuencia_tarea_ultima);
                    const hoy = parseNumber(d.dato_hoy);
                    const score = freq > 0 ? hoy / freq : 0;
                    if (!busTareasLub.has(d.bus)) {
                        busTareasLub.set(d.bus, { scoreMax: 0, cantidadTareas: 0 });
                    }
                    const entrada = busTareasLub.get(d.bus)!;
                    entrada.cantidadTareas++;
                    if (score > entrada.scoreMax) entrada.scoreMax = score;
                });

                const todosLosBusesLub: [string, { scoreMax: number; cantidadTareas: number }][] = [];
                busTareasLub.forEach((entrada, bus) => todosLosBusesLub.push([bus, entrada]));

                // Ordenado por urgencia (vencidas), no por cantidad
                todosLosBusesLub.sort((a, b) => {
                    if (b[1].scoreMax !== a[1].scoreMax) return b[1].scoreMax - a[1].scoreMax;
                    return b[1].cantidadTareas - a[1].cantidadTareas;
                });

                const seleccionadosLub = new Set(todosLosBusesLub.slice(0, cuotaLub).map(x => x[0]));

                currentLubMotorData.forEach((d, i) => {
                    if (seleccionadosLub.has(d.bus) && !d.isPlaceholder && tareaCoincide(d)) {
                        busesSeleccionadosPorTabla[1].add(d.bus);
                        tempSelected.add(`1-${i}`);
                    }
                });
            };

            // Ejecutar selección
            seleccionarMotor();
            seleccionarPorCategoria(currentDiagData, 3);

            // 4. ORDENAR CADA TABLA DE MANERA INDEPENDIENTE
            const ordenarTablaIndependiente = (
                sourceData: any[],
                tablaIdx: 1 | 2 | 3 | 4,
                criterioOrden: 'vencidas' | 'cantidad' = 'cantidad'
            ) => {
                const rawData = sourceData.filter(d => {
                    if (!d.tarea) return false;
                    const cleanTarea = d.tarea.trim();
                    return cleanTarea.length > 0 && cleanTarea !== '.' && cleanTarea !== '-' && cleanTarea !== '...';
                });

                const statsPorBus = new Map<string, { total: number, urgencia: number, cantidadFiltro: number }>();
                rawData.forEach(d => {
                    const bus = d.bus;
                    if (!statsPorBus.has(bus)) statsPorBus.set(bus, { total: 0, urgencia: 0, cantidadFiltro: 0 });
                    const st = statsPorBus.get(bus)!;
                    st.total++;

                    const f = parseNumber(d.frecuencia_tarea_ultima);
                    const h = parseNumber(d.dato_hoy);
                    const s = f > 0 ? h / f : 0;
                    if (s > st.urgencia) st.urgencia = s;

                    if (tareaCoincide(d)) st.cantidadFiltro++;
                });

                const setSeleccionados = busesSeleccionadosPorTabla[tablaIdx];
                const uniqueBuses = [...new Set(rawData.map(d => d.bus))];

                uniqueBuses.sort((a, b) => {
                    // SELECCIONADOS SIEMPRE PRIMERO EN SU TABLA
                    const selA = setSeleccionados.has(a);
                    const selB = setSeleccionados.has(b);
                    if (selA !== selB) return selA ? -1 : 1;

                    const stA = statsPorBus.get(a)!;
                    const stB = statsPorBus.get(b)!;

                    if (criterioOrden === 'cantidad') {
                        if (stA.cantidadFiltro !== stB.cantidadFiltro) return stB.cantidadFiltro - stA.cantidadFiltro;
                        return stB.urgencia - stA.urgencia;
                    } else {
                        if (stA.urgencia !== stB.urgencia) return stB.urgencia - stA.urgencia;
                        return stB.cantidadFiltro - stA.cantidadFiltro;
                    }
                });

                const resultado: any[] = [];
                const taskCounts = new Map<string, number>();
                rawData.forEach(d => {
                    const key = `${d.bus}-${d.tarea}`;
                    taskCounts.set(key, (taskCounts.get(key) || 0) + 1);
                });

                uniqueBuses.forEach(bus => {
                    const tareas = rawData.filter(d => d.bus === bus).sort((a, b) => {
                        const sA = parseNumber(a.dato_hoy) / (parseNumber(a.frecuencia_tarea_ultima) || 1);
                        const sB = parseNumber(b.dato_hoy) / (parseNumber(b.frecuencia_tarea_ultima) || 1);
                        return sB - sA;
                    });

                    tareas.forEach(t => {
                        resultado.push({
                            ...t,
                            cantidad: taskCounts.get(`${bus}-${t.tarea}`) || 1,
                            busTotal: statsPorBus.get(bus)!.total,
                        });
                    });
                });

                return resultado;
            };

            const finalSortedLubMotor = ordenarTablaIndependiente(currentLubMotorData, 1, 'vencidas');
            const finalSortedLubChasis = ordenarTablaIndependiente(currentLubChasisData, 4, 'vencidas');
            const finalSortedEng = ordenarTablaIndependiente(currentEngData, 2, 'vencidas');
            const finalSortedDiag = ordenarTablaIndependiente(currentDiagData, 3, 'vencidas');

            setLubricacionMotorData(finalSortedLubMotor);
            setLubricacionChasisData(finalSortedLubChasis);
            setEngraseData(finalSortedEng);
            setDiagnosticoData(finalSortedDiag);

            // 7. Determinar la selección final
            let finalSelected = new Set<string>();

            if (pendingRestoreRef.current && pendingRestoreRef.current.length > 0) {
                // MODO RESTAURACIÓN: venimos de un cambio de día, mapear bus+tarea → índices posicionales
                const toRestore = pendingRestoreRef.current;
                pendingRestoreRef.current = null;

                const buscarEnLista = (lista: any[], tablaIdx: 1 | 2 | 3 | 4) => {
                    lista.forEach((d, i) => {
                        if (d.isPlaceholder) return;
                        const match = toRestore.find(r => {
                            if (r.tablaIndex !== tablaIdx || r.bus !== d.bus || r.tarea !== d.tarea) return false;
                            // Si hay tarea_abierta_posterior, comparar para distinguir duplicados
                            if (r.tarea_abierta_posterior && d.tarea_abierta_posterior) {
                                return r.tarea_abierta_posterior === d.tarea_abierta_posterior;
                            }
                            return true;
                        });
                        if (match) finalSelected.add(`${tablaIdx}-${i}`);
                    });
                };
                buscarEnLista(finalSortedLubMotor, 1);
                buscarEnLista(finalSortedLubChasis, 4);
                buscarEnLista(finalSortedEng, 2);
                buscarEnLista(finalSortedDiag, 3);
            } else {
                // MODO AGRUPACIÓN NORMAL: reconstruir selección a partir de los buses auto-seleccionados
                const reconstruirSeleccion = (lista: any[], tablaIdx: 1 | 2 | 3 | 4) => {
                    const setBuses = busesSeleccionadosPorTabla[tablaIdx];
                    lista.forEach((d, i) => {
                        if (d.isPlaceholder || !setBuses.has(d.bus)) return;
                        if (priority) {
                            const est = d.estado?.toLowerCase() || '';
                            const esVencida = est.includes('vencida');
                            const esProxima = est.includes('proximo') || est.includes('proxima');
                            let coincide = false;
                            if (priority === 'vencidas' && esVencida) coincide = true;
                            else if (priority === 'proximas' && esProxima) coincide = true;
                            else if (priority === 'ambas' && (esVencida || esProxima)) coincide = true;
                            if (!coincide) return;
                        }
                        finalSelected.add(`${tablaIdx}-${i}`);
                    });
                };
                reconstruirSeleccion(finalSortedLubMotor, 1);
                reconstruirSeleccion(finalSortedLubChasis, 4);
                reconstruirSeleccion(finalSortedEng, 2);
                reconstruirSeleccion(finalSortedDiag, 3);
            }

            setIsExiting(false);
            setSelectedRows(finalSelected);

            setIsExiting(true);
            setTimeout(() => {
                setIsProcessing(false);
                setIsExiting(false);
            }, 600);

            const busesOrdenadosParaExcel = [...allBuses].sort((a, b) => a.localeCompare(b));

            window.dispatchEvent(new CustomEvent('dashboard-grouped', {
                detail: {
                    lubricacionMotor: finalSortedLubMotor,
                    lubricacionChasis: finalSortedLubChasis,
                    engrase: finalSortedEng,
                    diagnostico: finalSortedDiag,
                    busesRepetidos: busesOrdenadosParaExcel,
                    selectedRows: finalSelected
                }
            }));
        }, 800);
    };

    // Ref que siempre apunta a la versión más reciente de handleAgrupar
    const handleAgruparRef = useRef(handleAgrupar);
    useEffect(() => { handleAgruparRef.current = handleAgrupar; });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const fetchLubricacion = async () => {
            try {
                const res = await fetch(`${API_URL}/reports/lubricacion`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const motorData = (data || []).filter((d: any) => (d.taxonomia_4 || '').toUpperCase().includes('MOTOR'));
                    const chasisData = (data || []).filter((d: any) => !(d.taxonomia_4 || '').toUpperCase().includes('MOTOR'));
                    setLubricacionMotorData(motorData);
                    setRawLubricacionMotorData(motorData);
                    setLubricacionChasisData(chasisData);
                    setRawLubricacionChasisData(chasisData);
                }
            } catch (err) {
                console.error("Error al cargar lubricación:", err);
            } finally {
                setIsLoadingLubricacionMotor(false);
                setIsLoadingLubricacionChasis(false);
            }
        };

        const fetchDiagnostico = async () => {
            try {
                const res = await fetch(`${API_URL}/reports/diagnostico`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDiagnosticoData(data || []);
                    setRawDiagnosticoData(data || []);
                }
            } catch (err) {
                console.error("Error al cargar diagnóstico:", err);
            } finally {
                setIsLoadingDiagnostico(false);
            }
        };

        const fetchEngrase = async () => {
            try {
                const res = await fetch(`${API_URL}/reports/engrase`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setEngraseData(data || []);
                    setRawEngraseData(data || []);
                }
            } catch (err) {
                console.error("Error al cargar engrase:", err);
            } finally {
                setIsLoadingEngrase(false);
            }
        };

        fetchLubricacion();
        fetchDiagnostico();
        fetchEngrase();

        return () => {
            // Cleanup omitted
        };
    }, []);

    const getWidthClass = (index: number) => {
        if (expanded === null) return 'flex-1';
        return expanded === index ? 'flex-[2.5] z-20' : 'flex-[0.8] opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer';
    };

    const handleRowClick = (tablaIndex: number, filaIndex: number, toggleAll: boolean = false, busName?: string, deselectBelow: boolean = false) => {
        const data = tablaIndex === 1 ? lubricacionMotorData : tablaIndex === 2 ? engraseData : tablaIndex === 3 ? diagnosticoData : lubricacionChasisData;
        const item = data[filaIndex];
        if (!item || item.isPlaceholder) return;

        const targetBus = busName || item.bus;
        const newSelected = new Set(selectedRows);

        // --- Nueva Regla: Deseleccionar todo hacia abajo ---
        if (deselectBelow) {
            // Recorremos desde el índice actual hasta el final de esta tabla
            for (let i = filaIndex; i < data.length; i++) {
                newSelected.delete(`${tablaIndex}-${i}`);
            }
            setSelectedRows(newSelected);
            return;
        }

        if (toggleAll) {
            // Lógica de "Seleccionar/Deseleccionar TODO el bus en ESTA tabla"
            const indicesMismoBus = data
                .map((d, i) => (d.bus === targetBus && !d.isPlaceholder ? i : -1))
                .filter(i => i !== -1);

            const todasSeleccionadas = indicesMismoBus.every(i => newSelected.has(`${tablaIndex}-${i}`));

            if (todasSeleccionadas) {
                // Quitar todas
                indicesMismoBus.forEach(i => newSelected.delete(`${tablaIndex}-${i}`));
            } else {
                // Verificar límite antes de agregar el bus completo
                const currentSelectedBuses = new Set<string>();
                newSelected.forEach(k => {
                    const [tIdx, fIdx] = k.split('-').map(Number);
                    if (tablaIndex === 1 || tablaIndex === 4) {
                        if (tIdx === 1) {
                            const d = lubricacionMotorData;
                            if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                        } else if (tIdx === 4) {
                            const d = lubricacionChasisData;
                            if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                        }
                    } else if (tIdx === tablaIndex) {
                        const d = tIdx === 2 ? engraseData : diagnosticoData;
                        if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                    }
                });

                const limit = SELECTION_LIMITS[tablaIndex as 1 | 2 | 3 | 4];
                if (!currentSelectedBuses.has(targetBus) && currentSelectedBuses.size >= limit) {
                    setAlertModal(`Límite excedido: Solo puedes seleccionar tareas de hasta ${limit} vehículos en esta categoría.`);
                    return;
                }
                // Agregar todas
                indicesMismoBus.forEach(i => newSelected.add(`${tablaIndex}-${i}`));
            }
        } else {
            // Lógica de "Seleccionar/Deseleccionar SOLO esta tarea"
            const key = `${tablaIndex}-${filaIndex}`;
            if (newSelected.has(key)) {
                newSelected.delete(key);
            } else {
                // Verificar límite (si es un bus nuevo)
                const currentSelectedBuses = new Set<string>();
                newSelected.forEach(k => {
                    const [tIdx, fIdx] = k.split('-').map(Number);
                    if (tablaIndex === 1 || tablaIndex === 4) {
                        if (tIdx === 1) {
                            const d = lubricacionMotorData;
                            if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                        } else if (tIdx === 4) {
                            const d = lubricacionChasisData;
                            if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                        }
                    } else if (tIdx === tablaIndex) {
                        const d = tIdx === 2 ? engraseData : diagnosticoData;
                        if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                    }
                });

                const limit = SELECTION_LIMITS[tablaIndex as 1 | 2 | 3 | 4];
                if (!currentSelectedBuses.has(item.bus) && currentSelectedBuses.size >= limit) {
                    setAlertModal(`Límite excedido: Solo puedes seleccionar tareas de hasta ${limit} vehículos en esta categoría.`);
                    return;
                }
                newSelected.add(key);
            }
        }

        setSelectedRows(newSelected);
    };

    useEffect(() => {
        // Construir identificadores bus+tarea para persistencia entre días
        const buildBusTask = () => {
            const result: Array<{ bus: string, tarea: string, tablaIndex: number, tarea_abierta_posterior?: string }> = [];
            selectedRows.forEach(key => {
                const [tIdx, fIdx] = key.split('-').map(Number);
                let data: any[] = [];
                if (tIdx === 1) data = lubricacionMotorData;
                else if (tIdx === 2) data = engraseData;
                else if (tIdx === 3) data = diagnosticoData;
                else if (tIdx === 4) data = lubricacionChasisData;
                const item = data[fIdx];
                if (item && !item.isPlaceholder && item.tarea) {
                    result.push({ bus: item.bus, tarea: item.tarea, tablaIndex: tIdx, tarea_abierta_posterior: item.tarea_abierta_posterior });
                }
            });
            return result;
        };

        window.dispatchEvent(new CustomEvent('dashboard-selection-changed', {
            detail: {
                selectedRows,
                selectedBuses: selectionStats.allBuses,
                tableBuses: selectionStats.tableBuses,
                busTask: buildBusTask()
            }
        }));
    }, [selectedRows, selectionStats.allBuses, lubricacionMotorData, engraseData, diagnosticoData, lubricacionChasisData]);

    const handleRowDoubleClick = (tablaIndex: number, filaIndex: number) => {
        const data1 = lubricacionMotorData;
        const data2 = engraseData;
        const data3 = diagnosticoData;
        const data4 = lubricacionChasisData;

        // Doble click intenta agregar el bus en las 4 tablas si hay espacio
        const newSelected = new Set(selectedRows);

        const tablas = [
            { id: 1, d: data1 },
            { id: 2, d: data2 },
            { id: 3, d: data3 },
            { id: 4, d: data4 }
        ];

        tablas.forEach(({ id, d }) => {
            const item = d[filaIndex]; // Cuidado, filaIndex solo es válido para tablaIndex actual
            // Necesitamos buscar el bus en la tabla iterada
            let originItem;
            if (id === tablaIndex) originItem = d[filaIndex];
            else {
                // buscar el mismo bus en esta otra tabla
                const baseData = tablaIndex === 1 ? data1 : tablaIndex === 2 ? data2 : tablaIndex === 3 ? data3 : data4;
                const busName = baseData[filaIndex]?.bus;
                originItem = d.find(x => x.bus === busName && !x.isPlaceholder);
            }

            if (!originItem) return;

            // Verificar si el bus ya está seleccionado en esta tabla o si cabe
            const currentSelectedBuses = new Set<string>();
            newSelected.forEach(k => {
                const [tIdx, fIdx] = k.split('-').map(Number);
                if (id === 1 || id === 4) {
                    if (tIdx === 1) {
                        if (data1[fIdx] && !data1[fIdx].isPlaceholder) currentSelectedBuses.add(data1[fIdx].bus);
                    } else if (tIdx === 4) {
                        if (data4[fIdx] && !data4[fIdx].isPlaceholder) currentSelectedBuses.add(data4[fIdx].bus);
                    }
                } else if (tIdx === id) {
                    const data = tIdx === 2 ? data2 : data3;
                    if (data[fIdx] && !data[fIdx].isPlaceholder) currentSelectedBuses.add(data[fIdx].bus);
                }
            });

            const limit = SELECTION_LIMITS[id as 1 | 2 | 3 | 4];
            if (currentSelectedBuses.has(originItem.bus) || currentSelectedBuses.size < limit) {
                // Agregar todas las tareas de este bus en esta tabla
                d.forEach((rd, ri) => {
                    if (rd.bus === originItem.bus && !rd.isPlaceholder) {
                        newSelected.add(`${id}-${ri}`);
                    }
                });
            }
        });

        setSelectedRows(newSelected);
        window.dispatchEvent(new CustomEvent('dashboard-selection-changed', { detail: { selectedRows: newSelected } }));
    };

    // Calcular datos seleccionados para la tabla de asignación
    const selectedData = useMemo(() => Array.from(selectedRows).map(key => {
        const [tIndex, fIndex] = key.split('-').map(Number);
        let dataItem, gestion;
        if (tIndex === 1) { dataItem = lubricacionMotorData[fIndex]; gestion = 'Lubricación Motor'; }
        else if (tIndex === 2) { dataItem = engraseData[fIndex]; gestion = 'Engrase'; }
        else if (tIndex === 3) { dataItem = diagnosticoData[fIndex]; gestion = 'Diagnóstico'; }
        else if (tIndex === 4) { dataItem = lubricacionChasisData[fIndex]; gestion = 'Lubricación Chasis'; }

        return {
            id: key,
            bus: dataItem?.bus || '',
            tarea: dataItem?.tarea || '',
            gestion: gestion || '',
            tarea_abierta_posterior: dataItem?.tarea_abierta_posterior
        };
    }), [selectedRows, lubricacionMotorData, lubricacionChasisData, engraseData, diagnosticoData]);

    const handleAssignmentChange = (rowId: string, field: string, value: any) => {
        setAssignments(prev => {
            const next = {
                ...prev,
                [rowId]: { ...(prev[rowId] || {}), [field]: value }
            };
            window.dispatchEvent(new CustomEvent('dashboard-assignments-changed', { detail: { assignments: next } }));
            return next;
        });
    };

    const handleAssignmentMultiChange = (rowIds: string[], field: string, value: any) => {
        setAssignments(prev => {
            const next = { ...prev };
            rowIds.forEach(id => {
                next[id] = { ...(next[id] || {}), [field]: value };
            });
            window.dispatchEvent(new CustomEvent('dashboard-assignments-changed', { detail: { assignments: next } }));
            return next;
        });
    };

    const handleAssignmentAll = (field: string, value: any, dataRows: any[]) => {
        if (!field || !dataRows) return;

        setAssignments(prev => {
            const next = { ...prev };
            dataRows.forEach(row => {
                if (row.id) {
                    next[row.id] = { ...(next[row.id] || {}), [field]: value };
                }
            });
            window.dispatchEvent(new CustomEvent('dashboard-assignments-changed', {
                detail: { assignments: next }
            }));
            return next;
        });
    };

    // Estado para evitar re-fetching de datos que ya intentamos autocompletar
    const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());

    // Efecto para AUTOCOMPLETAR datos desde el backend cuando se seleccionan filas
    useEffect(() => {
        const autoPopulate = async () => {
            const idsToFetch = selectedData
                .map(t => extractTaskId(t.tarea_abierta_posterior))
                .filter((id): id is string => id !== null && !fetchedIds.has(id));

            if (idsToFetch.length === 0) return;

            // Marcar como intentados inmediatamente para evitar peticiones duplicadas en paralelo
            setFetchedIds(prev => {
                const next = new Set(prev);
                idsToFetch.forEach(id => next.add(id));
                return next;
            });

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/reports/partes-excel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        tareas_abiertas: selectedData
                            .filter(t => {
                                const id = extractTaskId(t.tarea_abierta_posterior);
                                return id && idsToFetch.includes(id);
                            })
                            .map(t => t.tarea_abierta_posterior)
                    })
                });

                if (res.ok) {
                    const partesMap = await res.json();
                    let hasChanges = false;

                    setAssignments(prev => {
                        const next = { ...prev };

                        selectedData.forEach(row => {
                            const id = extractTaskId(row.tarea_abierta_posterior);
                            if (id && partesMap[id]) {
                                const info = partesMap[id];
                                const current = next[row.id] || {};

                                // Mapeo de campos ADMON -> Reporte
                                const updates: any = {};
                                // Prioridad: Extraer solo el primer carácter (ej: "4" de "4-MEDIA")
                                if (!current.codigoPrioridad) updates.codigoPrioridad = (info.prioridad?.toString() || '').charAt(0);
                                // Si no hay fecha manual, dejaremos que el generador de Excel aplique la de hoy por defecto
                                if (!current.nombreDia) updates.nombreDia = info.nombre_dia;

                                if (!current.codigoSubproceso) {
                                    const sub = (info.subproceso?.toString() || '').toUpperCase();
                                    const finalSub = (sub === 'PREVENTIVO' || sub === 'PRENVENTIVO') ? 'PREVEN' : sub;
                                    updates.codigoSubproceso = finalSub.substring(0, 6);
                                }
                                if (!current.codigoZonaMaquina) updates.codigoZonaMaquina = info.zona_maquina;
                                if (!current.codigoCausaBasica) updates.codigoCausaBasica = info.causa_basica;
                                if (!current.codigoResponsable) updates.codigoResponsable = info.codigo_responsable;
                                if (!current.codigoEmpleado) updates.codigoEmpleado = info.empleado;
                                if (!current.observacion) updates.observacion = info.observacion;
                                if (!current.valorVariable) updates.valorVariable = info.valor_variable;
                                // Estado: Intentar mapear desde Admon
                                if (!current.codigoEstado) updates.codigoEstado = info.codigo_estado;

                                if (Object.keys(updates).length > 0) {
                                    next[row.id] = { ...current, ...updates };
                                    hasChanges = true;
                                }
                            }
                        });

                        if (hasChanges) {
                            window.dispatchEvent(new CustomEvent('dashboard-assignments-changed', { detail: { assignments: next } }));
                            return next;
                        }
                        return prev;
                    });
                }
            } catch (error) {
                console.error("Error en autocompletado:", error);
            }
        };

        autoPopulate();
    }, [selectedData]);

    const renderExpandButton = (index: number) => (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setExpanded(expanded === index ? null : index);
            }}
            class="absolute top-4 right-4 z-[30] w-8 h-8 bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl flex items-center justify-center text-texto-grey hover:text-primary hover:border-primary/40 hover:bg-white hover:shadow-lg active:scale-90 transition-all duration-300 shadow-sm"
            title={expanded === index ? 'Reducir' : 'Ampliar'}
        >
            <HugeiconsIcon
                icon={expanded === index ? Minimize01Icon : Maximize01Icon}
                size={14}
            />
        </button>
    );

    return (
        <div class="flex flex-col gap-8 w-full p-1 animate-fade-in">
            {/* Grid Principal */}
            <div class="flex flex-col lg:flex-row gap-5 items-stretch min-h-[500px]">
                {[

                    {
                        component: (() => {
                            const displayData = (lubricacionMotorData || []).map(item => ({
                                ...item,
                                isPlaceholder: item.isPlaceholder,
                                cantidad: item.cantidad,
                                busTotal: item.busTotal
                            }));

                            return (
                                <MiniTable
                                    title={`Lubricación Motor (${selectionStats[1]}/${SELECTION_LIMITS[1]})`}
                                    icon={DropletIcon}
                                    accentColor="#4cc253"
                                    data={displayData}
                                    showCantidad={true}
                                    tablaIndex={1}
                                    isLoading={isLoadingLubricacionMotor}
                                    groupedBuses={repeatedBuses}
                                    selectedRows={selectedRows}
                                    onRowClick={handleRowClick}
                                    onRowDoubleClick={handleRowDoubleClick}
                                />
                            );
                        })(),
                        title: 'Lubricación Motor',
                    },
                    {
                        component: (() => {
                            const displayData = (lubricacionChasisData || []).map(item => ({
                                ...item,
                                isPlaceholder: item.isPlaceholder,
                                cantidad: item.cantidad,
                                busTotal: item.busTotal
                            }));

                            return (
                                <MiniTable
                                    title={`Lubricación Chasis (${selectionStats[4]}/${SELECTION_LIMITS[4]})`}
                                    icon={DropletIcon}
                                    accentColor="#4cc253"
                                    data={displayData}
                                    showCantidad={true}
                                    tablaIndex={4}
                                    isLoading={isLoadingLubricacionChasis}
                                    groupedBuses={repeatedBuses}
                                    selectedRows={selectedRows}
                                    onRowClick={handleRowClick}
                                    onRowDoubleClick={handleRowDoubleClick}
                                />
                            );
                        })(),
                        title: 'Lubricación Chasis',
                    },
                    {
                        component: (() => {
                            const tareaCounts = (engraseData || []).reduce((acc, curr) => {
                                const key = `${curr.bus}-${curr.tarea}`;
                                acc[key] = (acc[key] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>);

                            const displayData = (engraseData || []).map(item => ({
                                ...item,
                                isPlaceholder: item.isPlaceholder,
                                cantidad: item.cantidad,
                                busTotal: item.busTotal
                            }));


                            return (
                                <MiniTable
                                    title={`Engrase (${selectionStats[2]}/${SELECTION_LIMITS[2]})`}
                                    icon={Settings01Icon}
                                    accentColor="#4cc253"
                                    data={displayData}
                                    showCantidad={false}
                                    tablaIndex={2}
                                    isLoading={isLoadingEngrase}
                                    groupedBuses={repeatedBuses}
                                    selectedRows={selectedRows}
                                    onRowClick={handleRowClick}
                                    onRowDoubleClick={handleRowDoubleClick}
                                />
                            );
                        })(),
                        title: 'Engrase',
                    },
                    {
                        component: (() => {
                            const tareaCounts = (diagnosticoData || []).reduce((acc, curr) => {
                                const key = `${curr.bus}-${curr.tarea}`;
                                acc[key] = (acc[key] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>);

                            const displayData = (diagnosticoData || []).map(item => ({
                                ...item,
                                isPlaceholder: item.isPlaceholder,
                                cantidad: item.cantidad,
                                busTotal: item.busTotal
                            }));

                            return (
                                <MiniTable
                                    title={`Diagnóstico (${selectionStats[3]}/${SELECTION_LIMITS[3]})`}
                                    icon={Search01Icon}
                                    accentColor="#4cc253"
                                    data={displayData}
                                    showCantidad={false}
                                    tablaIndex={3}
                                    isLoading={isLoadingDiagnostico}
                                    groupedBuses={repeatedBuses}
                                    selectedRows={selectedRows}
                                    onRowClick={handleRowClick}
                                    onRowDoubleClick={handleRowDoubleClick}
                                />
                            );
                        })(),
                        title: 'Diagnóstico',
                    },
                ].map((item, index) => (
                    <div
                        key={index}
                        class={`relative transition-all duration-700 ease-[cubic-bezier(0.2,1,0.3,1)] ${getWidthClass(index)} min-w-0`}
                        style={{ minWidth: expanded !== null && expanded !== index ? '80px' : undefined }}
                    >
                        {renderExpandButton(index)}
                        <div class="h-full overflow-hidden rounded-[32px]">
                            {item.component}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabla de Asignación (Solo si hay seleccionados) */}
            {selectedData.length > 0 && (
                <div class="animate-slide-up space-y-4">
                    <AsignacionTable
                        data={selectedData}
                        assignments={assignments}
                        onAssign={handleAssignmentChange}
                        onAssignMulti={handleAssignmentMultiChange}
                        onAssignAll={handleAssignmentAll}
                        selectedDate={selectedDate}
                    />
                </div>
            )}

            {/* Overlay de Procesamiento Premium */}
            {isProcessing && (
                <div class={`fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}`}>
                    <div class={`bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 flex flex-col items-center gap-6 ${isExiting ? 'animate-scale-down' : 'scale-up-center'}`}>
                        <div class="relative w-20 h-20">
                            <div class="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
                            <div class="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                            <div class="absolute inset-0 flex items-center justify-center text-primary">
                                <HugeiconsIcon icon={Layers01Icon} size={24} className="animate-pulse" />
                            </div>
                        </div>
                        <div class="text-center">
                            <h3 class="text-xl font-black text-texto-dark tracking-tight">Agrupando Buses</h3>
                            <p class="text-[10px] font-black text-texto-grey uppercase tracking-widest mt-1 opacity-60">Optimizando rutas de mantenimiento...</p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .animate-fade-out {
                    animation: fade-out 0.6s ease-in forwards;
                }
                @keyframes scale-down {
                    from { transform: scale(1); opacity: 1; filter: blur(0); }
                    to { transform: scale(0.9); opacity: 0; filter: blur(10px); }
                }
                .animate-scale-down {
                    animation: scale-down 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes scale-up-center {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .scale-up-center {
                    animation: scale-up-center 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}</style>

            {/* Modal de Vista Completa */}
            {showFullView && (
                <div class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div class="bg-white rounded-[32px] w-full max-w-[1400px] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header del Modal */}
                        <div class="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-transparent">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
                                    <HugeiconsIcon icon={Layers01Icon} size={24} />
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-texto-dark">Vista Completa</h2>
                                    <p class="text-sm text-texto-grey font-medium">Todas las tareas agrupadas sin paginación</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFullView(false)}
                                class="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-texto-grey hover:text-texto-dark transition-all duration-200"
                            >
                                <HugeiconsIcon icon={Cancel01Icon} size={20} />
                            </button>
                        </div>

                        {/* Contenido del Modal - 3 Columnas con Grupos */}
                        <div class="flex-1 overflow-auto p-6">
                            {(() => {
                                // Obtener lista ordenada de todos los buses repetidos
                                const sortedBuses = [...repeatedBusOrder.entries()]
                                    .sort((a, b) => a[1] - b[1])
                                    .map(([bus]) => bus);

                                return (
                                    <div class="grid grid-cols-4 gap-6">
                                        {/* Lubricación Motor */}
                                        <FullViewColumn
                                            icon={DropletIcon}
                                            title="Lubricación Motor"
                                            data={lubricacionMotorData}
                                            accentColor="#4cc253"
                                            allBusesOrdered={sortedBuses}
                                            filteredBuses={repeatedBuses}
                                            selectedRows={selectedRows}
                                            onRowClick={handleRowClick}
                                            tablaIndex={1}
                                        />

                                        {/* Lubricación Chasis */}
                                        <FullViewColumn
                                            icon={DropletIcon}
                                            title="Lubricación Chasis"
                                            data={lubricacionChasisData}
                                            accentColor="#4cc253"
                                            allBusesOrdered={sortedBuses}
                                            filteredBuses={repeatedBuses}
                                            selectedRows={selectedRows}
                                            onRowClick={handleRowClick}
                                            tablaIndex={4}
                                        />

                                        {/* Engrase */}
                                        <FullViewColumn
                                            icon={Settings01Icon}
                                            title="Engrase"
                                            data={engraseData}
                                            accentColor="#4cc253"
                                            allBusesOrdered={sortedBuses}
                                            filteredBuses={repeatedBuses}
                                            selectedRows={selectedRows}
                                            onRowClick={handleRowClick}
                                            tablaIndex={2}
                                        />

                                        {/* Diagnóstico */}
                                        <FullViewColumn
                                            icon={Search01Icon}
                                            title="Diagnóstico"
                                            data={diagnosticoData}
                                            accentColor="#4cc253"
                                            allBusesOrdered={sortedBuses}
                                            filteredBuses={repeatedBuses}
                                            selectedRows={selectedRows}
                                            onRowClick={handleRowClick}
                                            tablaIndex={3}
                                        />
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer del Modal */}
                        <div class="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowFullView(false)}
                                class="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all duration-200"
                            >
                                Cerrar Vista
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Alerta de Límites */}
            {alertModal && (
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div
                        class="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div class="p-8 flex flex-col items-center text-center">
                            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <HugeiconsIcon icon={Alert01Icon} size={32} className="text-red-500" />
                            </div>

                            <h3 class="text-lg font-bold text-gray-900 mb-2">
                                Límite de Cupo
                            </h3>

                            <p class="text-sm text-gray-500 leading-relaxed">
                                {alertModal}
                            </p>
                        </div>

                        <div class="p-4 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setAlertModal(null)}
                                class="flex-1 py-3 px-4 bg-primary text-white rounded-2xl text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
