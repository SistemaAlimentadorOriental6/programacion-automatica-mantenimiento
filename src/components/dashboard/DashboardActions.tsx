import { useState, useEffect, useRef } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { API_URL } from '../../config/api';
import {
    Layers01Icon,
    Calendar03Icon,
    PlayIcon,
    Tick02Icon,
    RefreshIcon,
    ViewIcon,
    Clock01Icon,
    Calendar02Icon,
    ZapIcon,
    FilterIcon
} from '@hugeicons/core-free-icons';
import * as XLSX from 'xlsx';

interface TareaData {
    bus: string;
    tarea: string;
    isPlaceholder?: boolean;
    frecuencia_tarea_ultima?: string;
    dato_hoy?: string;
}

interface DashboardActionsProps {
    onAgrupar?: () => void;
}

export default function DashboardActions({ onAgrupar }: DashboardActionsProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [hasGrouped, setHasGrouped] = useState<boolean>(false);
    const [priority, setPriority] = useState<'vencidas' | 'proximas' | 'ambas' | null>(null);
    const [busFilter, setBusFilter] = useState<'todos' | 'pares' | 'impares'>('todos');

    // Datos agrupados recibidos desde DashboardGrid via CustomEvent
    const datosAgrupados = useRef<{
        lubricacion: TareaData[];
        engrase: TareaData[];
        diagnostico: TareaData[];
        busesRepetidos: string[];
    } | null>(null);

    // Selección actual del usuario (actualizada en tiempo real)
    const selectedRowsRef = useRef<Set<string>>(new Set());
    const assignmentsRef = useRef<Record<string, any>>({});

    useEffect(() => {
        const handleGrouped = (e: Event) => {
            setHasGrouped(true);
            const detail = (e as CustomEvent).detail;
            if (detail) {
                datosAgrupados.current = detail;
                // Inicializar selectedRows con la selección inicial del agrupado
                if (detail.selectedRows) {
                    selectedRowsRef.current = detail.selectedRows as Set<string>;
                }
            }
        };
        const handleReset = () => {
            setHasGrouped(false);
            datosAgrupados.current = null;
            selectedRowsRef.current = new Set();
        };
        // Escuchar cambios de selección manual del usuario
        const handleSelectionChanged = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.selectedRows) {
                selectedRowsRef.current = detail.selectedRows as Set<string>;
            }
        };

        const handleAssignmentsChanged = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.assignments) {
                assignmentsRef.current = detail.assignments;
            }
        };

        window.addEventListener('dashboard-grouped', handleGrouped);
        window.addEventListener('dashboard-reset', handleReset);
        window.addEventListener('dashboard-selection-changed', handleSelectionChanged);
        window.addEventListener('dashboard-assignments-changed', handleAssignmentsChanged);

        return () => {
            window.removeEventListener('dashboard-grouped', handleGrouped);
            window.removeEventListener('dashboard-reset', handleReset);
            window.removeEventListener('dashboard-selection-changed', handleSelectionChanged);
            window.removeEventListener('dashboard-assignments-changed', handleAssignmentsChanged);
        };
    }, []);

    const generarExcel = async () => {
        const datos = datosAgrupados.current;
        if (!datos) return;

        const { lubricacion, engrase, diagnostico, busesRepetidos } = datos;

        // Preparar generador de fechas (de 21:00 a 04:00 del día siguiente, horas completas)
        const hoy = new Date();
        // Las horas disponibles: 21, 22, 23, 0, 1, 2, 3, 4 (8 horas)
        const horasDisponibles = [21, 22, 23, 0, 1, 2, 3, 4];

        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatFechaInicio = (indice: number) => {
            const totalMinutesRange = 460; // 21:00 a 04:40 = 7h 40min = 460min
            const minutesOffset = (indice * 10) % (totalMinutesRange + 1);

            const startHour = 21;
            const currentTotalMinutes = (startHour * 60 + minutesOffset) % (24 * 60);

            const h = Math.floor(currentTotalMinutes / 60);
            const m = currentTotalMinutes % 60;

            const fechaBaseStr = hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());
            return `${fechaBaseStr} ${pad(h)}:${pad(m)}:00`;
        };

        // Recopilar solo los tarea_abierta_posterior de las filas SELECCIONADAS
        const seleccionActual = selectedRowsRef.current;
        const todasTareasConTexto: { texto: string }[] = [];
        seleccionActual.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            const lista = tIdx === 1 ? lubricacion : tIdx === 2 ? engrase : diagnostico;
            const item = lista[fIdx];
            if (!item || item.isPlaceholder || !item.tarea?.trim()) return;
            const tap = (item as any).tarea_abierta_posterior;
            if (tap) todasTareasConTexto.push({ texto: tap });
        });

        // Regex para extraer ID del texto "... | ID: 123456 | ..."
        const reID = /ID:\s*(\d+)/;
        const extraerID = (texto?: string): string | null => {
            if (!texto) return null;
            const m = texto.match(reID);
            return m ? m[1] : null;
        };

        try {
            // Obtener datos desde el backend
            let partesMap: Record<string, any> = {};
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/reports/partes-excel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tareas_abiertas: todasTareasConTexto.map(t => t.texto)
                })
            });

            if (res.ok) {
                partesMap = await res.json();
            } else if (res.status === 401) {
                alert('Sesión expirada. Por favor, inicia sesión de nuevo.');
                return;
            }

            const filas: any[] = [];
            let idSolicitud = 1;
            let tareaGlobalIndex = 0;

            // Agrupar la selección actual por bus y tabla
            const seleccion = selectedRowsRef.current;
            const tareasPorBusYTabla: Record<string, { 1: TareaData[]; 2: TareaData[]; 3: TareaData[] }> = {};

            seleccion.forEach(key => {
                const [tIdx, fIdx] = key.split('-').map(Number);
                const lista = tIdx === 1 ? lubricacion : tIdx === 2 ? engrase : diagnostico;
                const item = lista[fIdx];
                if (!item || item.isPlaceholder || !item.tarea?.trim()) return;
                if (!tareasPorBusYTabla[item.bus]) {
                    tareasPorBusYTabla[item.bus] = { 1: [], 2: [], 3: [] };
                }
                tareasPorBusYTabla[item.bus][tIdx as 1 | 2 | 3].push(item);
            });

            // Contar en cuántas tablas (1, 2, 3) tiene tareas el bus
            const countTables = (bus: string) => {
                const data = tareasPorBusYTabla[bus];
                if (!data) return 0;
                return (data[1].length > 0 ? 1 : 0) + 
                       (data[2].length > 0 ? 1 : 0) + 
                       (data[3].length > 0 ? 1 : 0);
            };

            // Contar el total de tareas seleccionadas de un bus
            const countTotalTasks = (bus: string) => {
                const data = tareasPorBusYTabla[bus];
                if (!data) return 0;
                return data[1].length + data[2].length + data[3].length;
            };

            // Ordenar buses: mayor cantidad de coincidencias (tablas) primero
            const busesOrdenados = Object.keys(tareasPorBusYTabla).sort((a, b) => {
                const countA = countTables(a);
                const countB = countTables(b);
                if (countA !== countB) {
                    return countB - countA; // Descendente: 3 tablas, luego 2, luego 1
                }
                
                // Si tienen la misma cantidad de tablas coincidentes,
                // el desempate se basa en la cantidad total de tareas SELECCIONADAS
                const totalA = countTotalTasks(a);
                const totalB = countTotalTasks(b);
                if (totalA !== totalB) {
                    return totalB - totalA; // Descendente: más tareas seleccionadas primero
                }
                
                // Desempate final alfabético
                return a.localeCompare(b);
            });

            busesOrdenados.forEach(bus => {
                const porTabla = tareasPorBusYTabla[bus];
                if (!porTabla) return;

                const todasLasTareas = [
                    ...porTabla[1].map(t => ({ tarea: t.tarea, tap: (t as any).tarea_abierta_posterior })),
                    ...porTabla[2].map(t => ({ tarea: t.tarea, tap: (t as any).tarea_abierta_posterior })),
                    ...porTabla[3].map(t => ({ tarea: t.tarea, tap: (t as any).tarea_abierta_posterior }))
                ];

                if (todasLasTareas.length === 0) return;

                todasLasTareas.forEach(({ tarea, tap }) => {
                    const rowKey = Array.from(selectedRowsRef.current).find(k => {
                        const [t, f] = k.split('-').map(Number);
                        const l = t === 1 ? lubricacion : t === 2 ? engrase : diagnostico;
                        return l[f]?.bus === bus && l[f]?.tarea === tarea;
                    });

                    const customData = rowKey ? assignmentsRef.current[rowKey] : null;

                    const idAdmon = extraerID(tap);
                    const parteInfo = idAdmon ? partesMap[idAdmon] : null;
                    const taxonomiaFull = parteInfo?.taxonomia_encadenada ?? '';
                    const taxonomias = taxonomiaFull.split('|').map((t: string) => t.trim());

                    const matchPrioridad = (parteInfo?.prioridad ?? '').match(/^\d+/);
                    const filaBase: any = {
                        'ID SOLICITUD TRABAJO': idSolicitud,
                        'CODIGO': bus,
                        'PARTE': parteInfo?.parte ?? '',
                        'TAREA': tarea,
                        'FECHA PROPUESTA': parteInfo?.fecha_propuesta ?? '',
                        'FECHA INICIO': formatFechaInicio(tareaGlobalIndex),
                        'NOMBRE DIA': customData?.nombreDia || parteInfo?.nombre_dia || '',
                        'MES FECHA INICIO': parteInfo?.mes_inicio ?? '',
                        'DIA FECHA INICIO': parteInfo?.dia_inicio ?? '',
                        'MODO DETECCION': parteInfo?.modo_deteccion ?? '',
                        'CODIGO PRIORIDAD': (customData?.codigoPrioridad?.toString() || (parteInfo?.prioridad?.toString() || '').charAt(0) || '').charAt(0),
                        'CODIGO SUBPROCESO': (() => {
                            const rawSub = (customData?.codigoSubproceso || parteInfo?.subproceso || '').toString().toUpperCase();
                            const sub = (rawSub.includes('PREVENTIVO') || rawSub.includes('PRENVENTIVO')) ? 'PREVEN' : rawSub;
                            return sub.substring(0, 6);
                        })(),
                        'CODIGO ZONA MAQUINA': customData?.codigoZonaMaquina || (parteInfo?.zona_maquina ?? ''),
                        'CODIGO CAUSA BASICA': customData?.codigoCausaBasica || (parteInfo?.causa_basica ?? ''),
                        'CODIGO RESPONSABLE': customData?.codigoResponsable || (parteInfo?.codigo_responsable ?? ''),
                        'IDENTIFICACION EMPLEADO': '',
                        'CODIGO EMPLEADO': customData?.codigoEmpleado || (parteInfo?.identificacion_empleado ?? ''),
                        'TIEMPO CARACTERIZACION': parteInfo?.tiempo_caracterizacion ?? '',
                        'TIEMPO DESPLAZAMIENTO': parteInfo?.tiempo_desplazamiento ?? '',
                        'TIEMPO PLANEACION': parteInfo?.tiempo_planeacion ?? '',
                        'TIEMPO CIERRE': parteInfo?.tiempo_cierre ?? '',
                        'OBSERVACION': customData?.observacion || (parteInfo?.observacion ?? ''),
                        'CODIGO ESTADO': 'PRE',
                        'FRECUENCIA': parteInfo?.frecuencia ?? '',
                        'FRECUENCIA CARACTERIZADA': parteInfo?.frecuencia_caracterizada ?? '',
                        'AGRUPACION TAREA': parteInfo?.agrupacion_tarea ?? '',
                        'TIPO POLITICA': parteInfo?.tipo_politica ?? '',
                        'POLITICA': parteInfo?.politica ?? '',
                        'VALOR VARIABLE': customData?.valorVariable || (parteInfo?.valor_variable ?? ''),
                        'NRO REVISION': '',
                        'NRO NOVEDAD': '',
                        'NOVEDAD': '',
                        'EMPLEADO REPORTA NOVEDAD': '',
                        'OBSERVACION NOVEDAD': '',
                        'MOTIVO CAUSA PARADA': parteInfo?.motivo_causa_parada ?? '',
                        'DURACION': (parteInfo?.duracion ?? '').split('.')[0],
                        'PORCENTAJE DURACION': parteInfo?.porcentaje_duracion ?? '',
                        'USUARIO CREADOR': parteInfo?.usuario_creador ?? '',
                        'ID TAREA SOLICITADA': parteInfo?.id_tarea_solicitada ?? '',
                        'FECHA SOLICITUD NOVEDAD': parteInfo?.fecha_solicitud_novedad ?? '',
                        'ESTADO OPERATIVIDAD': 'VEHICULO EN MANTENIMIENTO PREVENTIVO',
                        'REFERENCIA INTELIGENTE PARTE': parteInfo?.referencia_inteligente ?? '',
                        'VALOR MIN VARIABLE': parteInfo?.valor_min_variable ?? ''
                    };

                    for (let i = 1; i <= 9; i++) {
                        filaBase[`TAXONOMIA-${i}`] = taxonomias[i - 1] || '';
                    }

                    filas.push(filaBase);
                    tareaGlobalIndex++;
                });
                idSolicitud++;
            });

            if (filas.length === 0) {
                alert('No hay datos para exportar.');
                return;
            }

            // --- USO DEL WEB WORKER PARA GENERAR EL EXCEL ---
            const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

            const header = [
                'ID SOLICITUD TRABAJO', 'CODIGO', 'PARTE', 'TAREA',
                'FECHA PROPUESTA', 'FECHA INICIO', 'NOMBRE DIA', 'MES FECHA INICIO',
                'DIA FECHA INICIO', 'MODO DETECCION', 'CODIGO PRIORIDAD',
                'CODIGO SUBPROCESO', 'CODIGO ZONA MAQUINA', 'CODIGO CAUSA BASICA',
                'CODIGO RESPONSABLE', 'IDENTIFICACION EMPLEADO', 'CODIGO EMPLEADO',
                'TIEMPO CARACTERIZACION', 'TIEMPO DESPLAZAMIENTO',
                'TIEMPO PLANEACION', 'TIEMPO CIERRE', 'OBSERVACION',
                'CODIGO ESTADO', 'FRECUENCIA', 'FRECUENCIA CARACTERIZADA',
                'AGRUPACION TAREA', 'TIPO POLITICA', 'POLITICA',
                'VALOR VARIABLE', 'NRO REVISION', 'NRO NOVEDAD',
                'NOVEDAD', 'EMPLEADO REPORTA NOVEDAD', 'OBSERVACION NOVEDAD',
                'MOTIVO CAUSA PARADA', 'DURACION', 'PORCENTAJE DURACION',
                'USUARIO CREADOR', 'ID TAREA SOLICITADA', 'FECHA SOLICITUD NOVEDAD',
                'ESTADO OPERATIVIDAD',
                'TAXONOMIA-1', 'TAXONOMIA-2', 'TAXONOMIA-3',
                'TAXONOMIA-4', 'TAXONOMIA-5', 'TAXONOMIA-6',
                'TAXONOMIA-7', 'TAXONOMIA-8', 'TAXONOMIA-9',
                'REFERENCIA INTELIGENTE PARTE', 'VALOR MIN VARIABLE'
            ];

            const columnWidths = [
                { wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 50 },
                { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
                { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
                { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
                { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
                { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
                { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 20 },
                { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 30 },
                { wch: 40 }, { wch: 40 }, { wch: 15 }, { wch: 20 },
                { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
                { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
                { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
                { wch: 30 }, { wch: 30 }, { wch: 20 }
            ];

            const fecha = new Date().toISOString().slice(0, 10);
            const fileName = `ArchivoPlano_${fecha}.xlsx`;

            worker.postMessage({ filas, header, columnWidths, fileName });

            worker.onmessage = (e) => {
                const { success, buffer, fileName, error } = e.data;
                if (success) {
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    link.click();
                    URL.revokeObjectURL(url);
                } else {
                    console.error('Error en worker:', error);
                    alert('Error al generar el Excel en segundo plano.');
                }
                worker.terminate();
            };

        } catch (error) {
            console.error('Error general:', error);
            alert('Error inesperado al procesar la solicitud.');
        }
    };

    const handleAction = async (action: string) => {
        if (loading) return;

        if (action === 'agrupar') {
            window.dispatchEvent(new CustomEvent('dashboard-agrupar', {
                detail: {
                    priority,
                    busFilter
                }
            }));
            return;
        } else if (action === 'reagrupar') {
            window.dispatchEvent(new CustomEvent('dashboard-agrupar', { detail: { priority, busFilter } }));

        } else if (action === 'generar') {
            setLoading(action);
            setSuccess(null);
            await generarExcel();
            setLoading(null);
            setSuccess(action);
            setTimeout(() => setSuccess(null), 3000);
            return;
        } else if (action === 'vistaCompleta') {
            window.dispatchEvent(new CustomEvent('dashboard-vista-completa'));
            setSuccess(action);
            setTimeout(() => setSuccess(null), 2000);
            return;
        }

        setLoading(action);
        setSuccess(null);

        // Simulación de acción asíncrona
        await new Promise(resolve => setTimeout(resolve, 1500));

        setLoading(null);
        setSuccess(action);

        // Resetear éxito después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
    };

    const renderButton = (id: string, label: string, icon: any) => {
        const isLoading = loading === id;
        const isSuccess = success === id;

        return (
            <button
                onClick={() => handleAction(id)}
                disabled={!!loading}
                class={`relative flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-xs font-bold transition-all duration-300 min-w-[140px] overflow-hidden ${isSuccess
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/30 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed'
                    }`}
            >
                {/* Loader Overlay */}
                {isLoading && (
                    <div class="absolute inset-0 bg-primary flex items-center justify-center">
                        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}

                {/* Content */}
                <div class={`flex items-center gap-2 transition-all duration-300 ${isLoading ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                    {isSuccess ? (
                        <HugeiconsIcon icon={Tick02Icon} size={18} className="animate-[scale-up_0.3s_ease-out]" />
                    ) : (
                        <HugeiconsIcon icon={icon} size={18} />
                    )}
                    <span>{isSuccess ? '¡Listo!' : label}</span>
                </div>
            </button>
        );
    };

    return (
        <div class="flex flex-wrap items-center gap-4 bg-white p-2.5 rounded-[26px] shadow-sm border border-gray-100 animate-fade-in">
            {!hasGrouped && (
                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 rounded-2xl border border-gray-100/50 mr-2">
                    <div class="flex items-center gap-2 mr-2 border-r border-gray-200 pr-3">
                        <HugeiconsIcon icon={FilterIcon} size={14} className="text-texto-grey" />
                        <span class="text-[10px] font-black text-texto-grey uppercase tracking-widest">Prioridad</span>
                    </div>

                    {[
                        { id: 'vencidas', label: 'Vencidas', icon: Clock01Icon, color: '#ef4444' },
                        { id: 'proximas', label: 'Próximas', icon: Calendar02Icon, color: '#f97316' },
                        { id: 'ambas', label: 'Ambas', icon: ZapIcon, color: '#4cc253' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => setPriority(priority === p.id ? null : p.id as any)}
                            title={`Priorizar tareas ${p.label}`}
                            class={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all duration-300 border ${priority === p.id
                                ? `bg-white shadow-sm border-gray-200 scale-105`
                                : 'border-transparent text-texto-grey hover:bg-white hover:text-texto-dark'
                                }`}
                            style={{ color: priority === p.id ? p.color : undefined }}
                        >
                            <HugeiconsIcon icon={p.icon} size={14} style={{ color: priority === p.id ? p.color : undefined }} />
                            <span class={priority === p.id ? 'opacity-100' : 'opacity-60'}>{p.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {!hasGrouped && (
                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 rounded-2xl border border-gray-100/50 mr-2">
                    <div class="flex items-center gap-2 mr-2 border-r border-gray-200 pr-3">
                        <HugeiconsIcon icon={FilterIcon} size={14} className="text-texto-grey" />
                        <span class="text-[10px] font-black text-texto-grey uppercase tracking-widest">Vehículos</span>
                    </div>

                    {[
                        { id: 'todos', label: 'Todos', icon: Layers01Icon, color: '#6366f1' },
                        { id: 'pares', label: 'Pares', icon: Tick02Icon, color: '#4cc253' },
                        { id: 'impares', label: 'Impares', icon: ZapIcon, color: '#f97316' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setBusFilter(f.id as any)}
                            class={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border ${busFilter === f.id
                                    ? 'bg-white shadow-sm border-gray-200'
                                    : 'border-transparent text-texto-grey hover:bg-white hover:text-texto-dark'
                                }`}
                            style={{ color: busFilter === f.id ? f.color : undefined }}
                        >
                            <HugeiconsIcon icon={f.icon} size={14} style={{ color: busFilter === f.id ? f.color : undefined }} />
                            <span class={busFilter === f.id ? 'opacity-100' : 'opacity-60'}>{f.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {hasGrouped ? (
                <>
                    {renderButton('reagrupar', 'Volver a Agrupar', RefreshIcon)}
                    {renderButton('vistaCompleta', 'Ver Vista Completa', ViewIcon)}
                    {renderButton('generar', 'Generar Vista', PlayIcon)}
                </>
            ) : (
                <>
                    {renderButton('agrupar', 'Agrupar', Layers01Icon)}
                </>
            )}

            <style>{`
                @keyframes scale-up {
                    from { transform: scale(0.5); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
