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
import OperationsTable from '../tables/OperationsTable.tsx';
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
    onRowClick: (tablaIndex: number, filaIndex: number) => void;
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
                                                                <span class={`px-1 py-0.5 text-[7px] font-black rounded-md border flex-shrink-0 uppercase tracking-tighter ${
                                                                    tarea.estado.toLowerCase().includes('vencida') ? 'bg-red-50 text-red-600 border-red-100' :
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

    // Estados para datos de las minitablas
    interface TareaData {
        bus: string;
        tarea: string;
        estado?: string;
        cantidad?: number;
        isPlaceholder?: boolean;
        frecuencia_tarea_ultima?: string;
        dato_hoy?: string;
    }

    const [lubricacionData, setLubricacionData] = useState<TareaData[]>([]);
    const [isLoadingLubricacion, setIsLoadingLubricacion] = useState(true);
    const [diagnosticoData, setDiagnosticoData] = useState<TareaData[]>([]);
    const [isLoadingDiagnostico, setIsLoadingDiagnostico] = useState(true);
    const [engraseData, setEngraseData] = useState<TareaData[]>([]);
    const [isLoadingEngrase, setIsLoadingEngrase] = useState(true);

    // Límites de selección por vehículo (no por tarea)
    const SELECTION_LIMITS = {
        1: 12, // Lubricación
        2: 15, // Engrase
        3: 30  // Diagnóstico
    };

    // Estadísticas de selección
    const selectionStats = useMemo(() => {
        const stats = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>() };
        selectedRows.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            const data = tIdx === 1 ? lubricacionData : tIdx === 2 ? engraseData : diagnosticoData;
            if (data[fIdx] && !data[fIdx].isPlaceholder) {
                stats[tIdx as 1|2|3].add(data[fIdx].bus);
            }
        });
        return {
            1: stats[1].size,
            2: stats[2].size,
            3: stats[3].size
        };
    }, [selectedRows, lubricacionData, engraseData, diagnosticoData]);

    useEffect(() => {
        const handleAgruparEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            handleAgrupar(detail?.priority, detail?.busFilter);
        };
        const handleVistaCompleta = () => {
            setShowFullView(true);
        };

        window.addEventListener('dashboard-agrupar', handleAgruparEvent);
        window.addEventListener('dashboard-vista-completa', handleVistaCompleta);

        return () => {
            window.removeEventListener('dashboard-agrupar', handleAgruparEvent);
            window.removeEventListener('dashboard-vista-completa', handleVistaCompleta);
        };
    }, [lubricacionData, engraseData, diagnosticoData]);

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

    const handleAgrupar = (priority?: 'vencidas' | 'proximas' | 'ambas' | null, busFilter: 'todos' | 'pares' | 'impares' = 'todos') => {
        setIsProcessing(true);

        setTimeout(() => {
            // Lógica de filtrado por tipo de vehículo
            const isBusMatchFilter = (bus: string) => {
                if (busFilter === 'todos') return true;
                const numMatch = bus.match(/\d+/g);
                if (!numMatch) return false;
                const lastNum = parseInt(numMatch[numMatch.length - 1], 10);
                const isEven = lastNum % 2 === 0;
                return busFilter === 'pares' ? isEven : !isEven;
            };

            const filterData = (data: TareaData[]) => (data || []).filter(d => isBusMatchFilter(d.bus));

            const currentLubData = filterData(lubricacionData);
            const currentEngData = filterData(engraseData);
            const currentDiagData = filterData(diagnosticoData);

            const busesLub = new Set(currentLubData.map(d => d.bus));
            const busesEng = new Set(currentEngData.map(d => d.bus));
            const busesDiag = new Set(currentDiagData.map(d => d.bus));

            // 1. Identificar buses con selección manual previa (Prioridad absoluta)
            const busesSeleccionadosManualmente = new Set<string>();
            selectedRows.forEach(key => {
                const [tIdx, fIdx] = key.split('-').map(Number);
                const d = tIdx === 1 ? lubricacionData : tIdx === 2 ? engraseData : diagnosticoData;
                if (d[fIdx] && !d[fIdx].isPlaceholder) busesSeleccionadosManualmente.add(d[fIdx].bus);
            });

            // Conteo de tareas por bus y tabla
            const lubCounts = currentLubData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);
            const engCounts = currentEngData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);
            const diagCounts = currentDiagData.reduce((acc, d) => { acc[d.bus] = (acc[d.bus] || 0) + 1; return acc; }, {} as Record<string, number>);

            // Identificar buses con tareas prioritarias (vencidas/proximas)
            const busesUrgentes = new Set<string>();
            const buscarUrgencia = (lista: any[]) => {
                lista.forEach(d => {
                    if (d.isPlaceholder || !d.estado) return;
                    const est = d.estado.toLowerCase();
                    const esVencida = est.includes('vencida');
                    const esProxima = est.includes('proximo') || est.includes('proxima');
                    if (priority === 'vencidas' && esVencida) busesUrgentes.add(d.bus);
                    else if (priority === 'proximas' && esProxima) busesUrgentes.add(d.bus);
                    else if (priority === 'ambas' && (esVencida || esProxima)) busesUrgentes.add(d.bus);
                });
            };
            buscarUrgencia(currentLubData);
            buscarUrgencia(currentEngData);
            buscarUrgencia(currentDiagData);

            // 2. Determinar buses que deben alinearse arriba (Repetidos o Seleccionados)
            const allBuses = new Set([...busesLub, ...busesEng, ...busesDiag]);
            const newRepeated = new Set<string>();
            const busOccurrenceCount = new Map<string, number>();

            allBuses.forEach(bus => {
                let count = 0;
                if (busesLub.has(bus)) count++;
                if (busesEng.has(bus)) count++;
                if (busesDiag.has(bus)) count++;
                busOccurrenceCount.set(bus, count);
                
                // Se alinean arriba si se repiten O si el usuario ya los marcó
                if (count >= 2 || busesSeleccionadosManualmente.has(bus)) {
                    newRepeated.add(bus);
                }
            });

            // 3. Ordenar priorizando: 1. Selección Manual, 2. Urgencia, 3. Repetición
            const sortedRepeated = [...newRepeated].sort((a, b) => {
                // Prioridad 1: Selección manual del usuario
                const selA = busesSeleccionadosManualmente.has(a) ? 1 : 0;
                const selB = busesSeleccionadosManualmente.has(b) ? 1 : 0;
                if (selA !== selB) return selB - selA;

                // Prioridad 2: Urgencia (vencidas/proximas)
                if (priority) {
                    const urgA = busesUrgentes.has(a) ? 1 : 0;
                    const urgB = busesUrgentes.has(b) ? 1 : 0;
                    if (urgA !== urgB) return urgB - urgA;
                }

                const countA = busOccurrenceCount.get(a) || 0;
                const countB = busOccurrenceCount.get(b) || 0;
                if (countA !== countB) return countB - countA;
                
                const totalA = (lubCounts[a] || 0) + (engCounts[a] || 0) + (diagCounts[a] || 0);
                const totalB = (lubCounts[b] || 0) + (engCounts[b] || 0) + (diagCounts[b] || 0);
                if (totalA !== totalB) return totalB - totalA;
                
                return a.localeCompare(b);
            });
            const newOrder = new Map(sortedRepeated.map((bus, i) => [bus, i]));

            setRepeatedBuses(newRepeated);
            setRepeatedBusOrder(newOrder);

            // Función para ordenar y RELLENAR con espacios en blanco (alineación)
            const prepararDatosAlineados = (sourceData: { bus: string; tarea: string; [key: string]: any }[]) => {
                // LIMPIEZA PROFUNDA: Filtramos cualquier placeholder previo Y tareas que sean "basura" (vacías, puntos, guiones)
                const rawData = sourceData.filter(d => {
                    if (d.isPlaceholder) return false;
                    if (!d.tarea) return false;
                    const cleanTarea = d.tarea.trim();
                    // Filtramos tareas que sean solo un punto, un guion o que estén vacías
                    return cleanTarea.length > 0 && cleanTarea !== '.' && cleanTarea !== '-' && cleanTarea !== '...';
                });

                // 1. Conteo TOTAL por bus (para prioridad/orden y cabecera)
                const busTotals = new Map<string, number>();
                rawData.forEach(d => busTotals.set(d.bus, (busTotals.get(d.bus) || 0) + 1));

                // 2. Conteo ESPECIFICO por tarea
                const taskCounts = new Map<string, number>();
                rawData.forEach(d => {
                    const key = `${d.bus}-${d.tarea}`;
                    taskCounts.set(key, (taskCounts.get(key) || 0) + 1);
                });

                const resultado: any[] = [];

                // 3. Zona Agrupada: Buses detectados en 2 o más tablas
                sortedRepeated.forEach(bus => {
                    const tasks = rawData.filter(d => d.bus === bus);
                    if (tasks.length > 0) {
                        tasks.forEach(t => {
                            resultado.push({
                                bus: t.bus,
                                tarea: t.tarea,
                                estado: t.estado,
                                cantidad: taskCounts.get(`${bus}-${t.tarea}`) || 1,
                                busTotal: busTotals.get(bus) || 0,
                                tarea_abierta_posterior: t.tarea_abierta_posterior,
                                frecuencia_tarea_ultima: t.frecuencia_tarea_ultima,
                                dato_hoy: t.dato_hoy
                            });
                        });
                    } else {
                        resultado.push({ bus, isPlaceholder: true });
                    }
                });

                // 4. Zona Normal: Resto de buses (también ordenados por prioridad si hay)
                const others = rawData.filter(d => !newRepeated.has(d.bus));
                const otherBuses = [...new Set(others.map(d => d.bus))].sort((a, b) => {
                    if (priority) {
                        const urgA = busesUrgentes.has(a) ? 1 : 0;
                        const urgB = busesUrgentes.has(b) ? 1 : 0;
                        if (urgA !== urgB) return urgB - urgA;
                    }
                    const tA = busTotals.get(a) || 0;
                    const tB = busTotals.get(b) || 0;
                    return tA !== tB ? tB - tA : a.localeCompare(b);
                });

                otherBuses.forEach(bus => {
                    rawData.filter(d => d.bus === bus).forEach(t => {
                        resultado.push({
                            bus: t.bus,
                            tarea: t.tarea,
                            estado: t.estado,
                            cantidad: taskCounts.get(`${bus}-${t.tarea}`) || 1,
                            busTotal: busTotals.get(bus) || 0,
                            tarea_abierta_posterior: t.tarea_abierta_posterior,
                            frecuencia_tarea_ultima: t.frecuencia_tarea_ultima,
                            dato_hoy: t.dato_hoy
                        });
                    });
                });

                return resultado;
            };

            const sortedLub = prepararDatosAlineados(currentLubData);
            const sortedEng = prepararDatosAlineados(currentEngData);
            const sortedDiag = prepararDatosAlineados(currentDiagData);

            setLubricacionData(sortedLub);
            setEngraseData(sortedEng);
            setDiagnosticoData(sortedDiag);

            const newSelected = new Set<string>();
            // Seleccionar solo filas que NO sean placeholders y pertenezcan a buses repetidos, respetando los límites
            const busesSeleccionadosPorTabla: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };

            const agregarSiCabe = (lista: any[], tablaIdx: 1|2|3) => {
                // Primero intentamos agregar tareas que coincidan EXACTAMENTE con la prioridad
                if (priority) {
                    lista.forEach((d, i) => {
                        if (d.isPlaceholder || !d.estado) return;
                        const est = d.estado.toLowerCase();
                        const esVencida = est.includes('vencida');
                        const esProxima = est.includes('proximo') || est.includes('proxima');
                        
                        let coincide = false;
                        if (priority === 'vencidas' && esVencida) coincide = true;
                        else if (priority === 'proximas' && esProxima) coincide = true;
                        else if (priority === 'ambas' && (esVencida || esProxima)) coincide = true;

                        if (!coincide) return;

                        const limite = SELECTION_LIMITS[tablaIdx];
                        const setBuses = busesSeleccionadosPorTabla[tablaIdx];
                        
                        // Si cabe el vehículo o ya está siendo contado, seleccionamos LA TAREA
                        if (setBuses.has(d.bus) || setBuses.size < limite) {
                            setBuses.add(d.bus);
                            newSelected.add(`${tablaIdx}-${i}`);
                        }
                    });
                }

                // Luego, si NO hay prioridad o para rellenar huecos con buses repetidos:
                // Seleccionamos tareas de buses repetidos (o manuales) respetando el límite
                lista.forEach((d, i) => {
                    if (d.isPlaceholder || !newRepeated.has(d.bus)) return;
                    
                    // Si ya está seleccionada (por prioridad arriba), la saltamos
                    if (newSelected.has(`${tablaIdx}-${i}`)) return;

                    // Si hay prioridad activa, NO seleccionamos automáticamente tareas que no coincidan
                    // a menos que el usuario lo haga manualmente después
                    if (priority) return;

                    const limite = SELECTION_LIMITS[tablaIdx];
                    const setBuses = busesSeleccionadosPorTabla[tablaIdx];
                    if (setBuses.has(d.bus) || setBuses.size < limite) {
                        setBuses.add(d.bus);
                        newSelected.add(`${tablaIdx}-${i}`);
                    }
                });
            };

            agregarSiCabe(sortedLub, 1);
            agregarSiCabe(sortedEng, 2);
            agregarSiCabe(sortedDiag, 3);
            
            setIsExiting(false);
            setSelectedRows(newSelected);
            
            setIsExiting(true);
            setTimeout(() => {
                setIsProcessing(false);
                setIsExiting(false);
            }, 600);

            // Notificar que se ha agrupado, enviando los datos ya procesados para el Excel
            const busesOrdenados = [...newRepeated].sort((a, b) => {
                const aRank = newOrder.get(a);
                const bRank = newOrder.get(b);
                if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
                return a.localeCompare(b);
            });

            window.dispatchEvent(new CustomEvent('dashboard-grouped', {
                detail: {
                    lubricacion: sortedLub,
                    engrase: sortedEng,
                    diagnostico: sortedDiag,
                    busesRepetidos: busesOrdenados,
                    selectedRows: newSelected
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
                    setLubricacionData(data || []);
                }
            } catch (err) {
                console.error("Error al cargar lubricación:", err);
            } finally {
                setIsLoadingLubricacion(false);
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
            window.removeEventListener('dashboard-agrupar', listener);
            window.removeEventListener('dashboard-vista-completa', vistaListener);
        };
    }, []);

    const getWidthClass = (index: number) => {
        if (expanded === null) return 'flex-1';
        return expanded === index ? 'flex-[2.5] z-20' : 'flex-[0.8] opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer';
    };

    const handleRowClick = (tablaIndex: number, filaIndex: number, toggleAll: boolean = false) => {
        const data = tablaIndex === 1 ? lubricacionData : tablaIndex === 2 ? engraseData : diagnosticoData;
        const item = data[filaIndex];
        if (!item || item.isPlaceholder) return;

        const newSelected = new Set(selectedRows);

        if (toggleAll) {
            // Lógica de "Seleccionar/Deseleccionar TODO el bus"
            const indicesMismoBus = data
                .map((d, i) => (d.bus === item.bus && !d.isPlaceholder ? i : -1))
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
                    if (tIdx === tablaIndex) {
                        const d = tIdx === 1 ? lubricacionData : tIdx === 2 ? engraseData : diagnosticoData;
                        if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                    }
                });

                const limit = SELECTION_LIMITS[tablaIndex as 1|2|3];
                if (!currentSelectedBuses.has(item.bus) && currentSelectedBuses.size >= limit) {
                    alert(`⚠️ Límite excedido: Solo puedes seleccionar tareas de hasta ${limit} vehículos en esta categoría.`);
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
                    if (tIdx === tablaIndex) {
                        const d = tIdx === 1 ? lubricacionData : tIdx === 2 ? engraseData : diagnosticoData;
                        if (d[fIdx] && !d[fIdx].isPlaceholder) currentSelectedBuses.add(d[fIdx].bus);
                    }
                });

                const limit = SELECTION_LIMITS[tablaIndex as 1|2|3];
                if (!currentSelectedBuses.has(item.bus) && currentSelectedBuses.size >= limit) {
                    alert(`⚠️ Límite excedido: Solo puedes seleccionar tareas de hasta ${limit} vehículos en esta categoría.`);
                    return;
                }
                newSelected.add(key);
            }
        }

        setSelectedRows(newSelected);
        window.dispatchEvent(new CustomEvent('dashboard-selection-changed', { detail: { selectedRows: newSelected } }));
    };

    const handleRowDoubleClick = (tablaIndex: number, filaIndex: number) => {
        const data1 = lubricacionData;
        const data2 = engraseData;
        const data3 = diagnosticoData;
        
        // Doble click intenta agregar el bus en las 3 tablas si hay espacio
        const newSelected = new Set(selectedRows);
        
        const tablas = [
            { id: 1, d: data1 },
            { id: 2, d: data2 },
            { id: 3, d: data3 }
        ];

        tablas.forEach(({ id, d }) => {
            const item = d[filaIndex];
            if (!item || item.isPlaceholder) return;

            // Verificar si el bus ya está seleccionado en esta tabla o si cabe
            const currentSelectedBuses = new Set<string>();
            newSelected.forEach(k => {
                const [tIdx, fIdx] = k.split('-').map(Number);
                if (tIdx === id) {
                    const data = tIdx === 1 ? data1 : tIdx === 2 ? data2 : data3;
                    if (data[fIdx] && !data[fIdx].isPlaceholder) currentSelectedBuses.add(data[fIdx].bus);
                }
            });

            const limit = SELECTION_LIMITS[id as 1|2|3];
            if (currentSelectedBuses.has(item.bus) || currentSelectedBuses.size < limit) {
                // Agregar todas las tareas de este bus en esta tabla
                d.forEach((rd, ri) => {
                    if (rd.bus === item.bus && !rd.isPlaceholder) {
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
        if (tIndex === 1) { dataItem = lubricacionData[fIndex]; gestion = 'Lubricación'; }
        else if (tIndex === 2) { dataItem = engraseData[fIndex]; gestion = 'Engrase'; }
        else if (tIndex === 3) { dataItem = diagnosticoData[fIndex]; gestion = 'Diagnóstico'; }

        return {
            id: key,
            bus: dataItem?.bus || '',
            tarea: dataItem?.tarea || '',
            gestion: gestion || '',
            tarea_abierta_posterior: dataItem?.tarea_abierta_posterior
        };
    }), [selectedRows, lubricacionData, engraseData, diagnosticoData]);

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
                                if (!current.codigoEmpleado) updates.codigoEmpleado = info.identificacion_empleado;
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
                        component: <OperationsTable />,
                        title: 'Gestión Operativa',
                    },
                    {
                        component: (() => {
                            // 1. Contar cuántas veces aparece cada tarea específica por bus
                            const tareaCounts = (lubricacionData || []).reduce((acc, curr) => {
                                const key = `${curr.bus}-${curr.tarea}`;
                                acc[key] = (acc[key] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>);

                            // 2. Usar los datos tal cual vienen del estado (ya procesados y limpios)
                            const displayData = (lubricacionData || []).map(item => ({
                                ...item,
                                // Aseguramos que si es placeholder, MiniTable lo sepa
                                isPlaceholder: item.isPlaceholder,
                                cantidad: item.cantidad,
                                busTotal: item.busTotal
                            }))
                            // 3. Ordenar con ranking global (consistente entre las 3 tablas)
                                .sort((a, b) => {
                                    const aRank = repeatedBusOrder.get(a.bus);
                                    const bRank = repeatedBusOrder.get(b.bus);
                                    const aIsRep = aRank !== undefined;
                                    const bIsRep = bRank !== undefined;
                                    if (aIsRep !== bIsRep) return aIsRep ? -1 : 1;
                                    if (aIsRep && bIsRep) return aRank! - bRank!;
                                    if (a.cantidad !== b.cantidad) return b.cantidad - a.cantidad;
                                    return a.bus.localeCompare(b.bus);
                                });

                            return (
                                <MiniTable
                                    title={`Lubricación (${selectionStats[1]}/${SELECTION_LIMITS[1]})`}
                                    icon={DropletIcon}
                                    accentColor="#4cc253"
                                    data={displayData}
                                    showCantidad={true}
                                    tablaIndex={1}
                                    isLoading={isLoadingLubricacion}
                                    groupedBuses={repeatedBuses}
                                    selectedRows={selectedRows}
                                    onRowClick={handleRowClick}
                                    onRowDoubleClick={handleRowDoubleClick}
                                />
                            );
                        })(),
                        title: 'Lubricación',
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
                            }))
                                .sort((a, b) => {
                                    const aRank = repeatedBusOrder.get(a.bus);
                                    const bRank = repeatedBusOrder.get(b.bus);
                                    const aIsRep = aRank !== undefined;
                                    const bIsRep = bRank !== undefined;
                                    if (aIsRep !== bIsRep) return aIsRep ? -1 : 1;
                                    if (aIsRep && bIsRep) return aRank! - bRank!;
                                    if (a.cantidad !== b.cantidad) return b.cantidad - a.cantidad;
                                    return a.bus.localeCompare(b.bus);
                                });


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
                            }))
                                .sort((a, b) => {
                                    const aRank = repeatedBusOrder.get(a.bus);
                                    const bRank = repeatedBusOrder.get(b.bus);
                                    const aIsRep = aRank !== undefined;
                                    const bIsRep = bRank !== undefined;
                                    if (aIsRep !== bIsRep) return aIsRep ? -1 : 1;
                                    if (aIsRep && bIsRep) return aRank! - bRank!;
                                    if (a.cantidad !== b.cantidad) return b.cantidad - a.cantidad;
                                    return a.bus.localeCompare(b.bus);
                                });

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
                                    <div class="grid grid-cols-3 gap-6">
                                        {/* Lubricación */}
                                        <FullViewColumn
                                            icon={DropletIcon}
                                            title="Lubricación"
                                            data={lubricacionData}
                                            accentColor="#4cc253"
                                            allBusesOrdered={sortedBuses}
                                            filteredBuses={repeatedBuses}
                                            selectedRows={selectedRows}
                                            onRowClick={handleRowClick}
                                            tablaIndex={1}
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
        </div>
    );
}
