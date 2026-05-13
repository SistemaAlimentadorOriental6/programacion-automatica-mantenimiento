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
    FilterIcon,
    ArrowRight01Icon,
    Cancel01Icon
} from '@hugeicons/core-free-icons';
import * as XLSX from 'xlsx';
import MiniCalendarPicker from './MiniCalendarPicker';

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
    const [typeFilter, setTypeFilter] = useState<'todos' | 'RUNNER' | 'AGRALE' | 'NPR'>('todos');

    // Estados para planeación multi-día
    const [dates, setDates] = useState<Date[]>([]);
    const [currentDateIndex, setCurrentDateIndex] = useState<number>(0);
    const [showCalendar, setShowCalendar] = useState<boolean>(false);
    const [quotaAlert, setQuotaAlert] = useState<string | null>(null);

    // Datos agrupados recibidos desde DashboardGrid via CustomEvent
    const datosAgrupados = useRef<{
        lubricacion: TareaData[];
        engrase: TareaData[];
        diagnostico: TareaData[];
        busesRepetidos: string[];
    } | null>(null);

    // Selección actual del usuario (actualizada en tiempo real)
    const selectedRowsRef = useRef<Set<string>>(new Set());
    const selectedBusesRef = useRef<string[]>([]);
    const selectedTableBusesRef = useRef<string[]>([]);
    const selectedBusTaskRef = useRef<Array<{ bus: string, tarea: string, tablaIndex: number }>>([]);
    const assignmentsRef = useRef<Record<string, any>>({});

    // Almacén maestro: snapshot para restaurar selecciones al navegar entre días
    const [dailyAssignments, setDailyAssignments] = useState<Record<number, { busTask: Array<{ bus: string, tarea: string, tablaIndex: number }>, data: any, assignments?: Record<string, any> }>>({});
    // Buses comprometidos por día: SOLO se actualiza al presionar "Siguiente Día"
    const [committedBuses, setCommittedBuses] = useState<Record<number, string[]>>({});
    // Fechas excluidas (marcadas con X por el usuario)
    const [excludedDates, setExcludedDates] = useState<Record<number, boolean>>({});

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
            if (detail?.selectedBuses) {
                selectedBusesRef.current = detail.selectedBuses as string[];
            }
            if (detail?.tableBuses) {
                const combined: string[] = [];
                Object.entries(detail.tableBuses).forEach(([tIdx, buses]) => {
                    (buses as string[]).forEach(b => combined.push(`${tIdx}-${b}`));
                });
                selectedTableBusesRef.current = combined;
            }
            if (detail?.busTask) {
                selectedBusTaskRef.current = detail.busTask;
            }
        };

        const handleDateChanged = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.selectedDate) {
                // GUARDAR filtros del día que estamos dejando
                setDailyAssignments(prev => ({
                    ...prev,
                    [currentDateIndex]: {
                        ...prev[currentDateIndex],
                        busFilter: busFilter,
                        typeFilter: typeFilter
                    }
                }));

                // RESTAURAR filtros del nuevo día (o defaults si es nuevo)
                const nextDay = dailyAssignments[detail.index];
                setBusFilter(nextDay?.busFilter as any || 'todos');
                setTypeFilter(nextDay?.typeFilter as any || 'todos');

                setCurrentDateIndex(detail.index);
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
        window.addEventListener('dashboard-date-changed', handleDateChanged);
        window.addEventListener('dashboard-assignments-changed', handleAssignmentsChanged);

        return () => {
            window.removeEventListener('dashboard-grouped', handleGrouped);
            window.removeEventListener('dashboard-reset', handleReset);
            window.removeEventListener('dashboard-selection-changed', handleSelectionChanged);
            window.removeEventListener('dashboard-date-changed', handleDateChanged);
            window.removeEventListener('dashboard-assignments-changed', handleAssignmentsChanged);
        };
    }, [currentDateIndex, busFilter, typeFilter, dailyAssignments]);

    // Reactividad: Re-agrupar automáticamente al cambiar filtros
    useEffect(() => {
        if (hasGrouped) {
            handleAction('reagrupar');
        }
    }, [busFilter, typeFilter, priority]);

    const generarExcel = async () => {
        // Verificar que hay datos en al menos el día actual o en algún día guardado
        const hayDatos = datosAgrupados.current || Object.values(dailyAssignments).some(s => s.data);
        if (!hayDatos) return;

        // Preparar pad de fechas
        const pad = (n: number) => n.toString().padStart(2, '0');
        const hoy = new Date();
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

        // Recopilar tareas de todos los días para el lookup de partes
        const todasTareasConTexto: { texto: string }[] = [];
        // Del día actual
        selectedBusTaskRef.current.forEach(bt => {
            let lista: any[] = [];
            if (bt.tablaIndex === 1 && datosAgrupados.current) lista = (datosAgrupados.current as any).lubricacionMotor || [];
            else if (bt.tablaIndex === 2 && datosAgrupados.current) lista = (datosAgrupados.current as any).engrase || [];
            else if (bt.tablaIndex === 3 && datosAgrupados.current) lista = (datosAgrupados.current as any).diagnostico || [];
            else if (bt.tablaIndex === 4 && datosAgrupados.current) lista = (datosAgrupados.current as any).lubricacionChasis || [];
            const item = lista.find((d: any) => d.bus === bt.bus && d.tarea === bt.tarea);
            const tap = item?.tarea_abierta_posterior;
            if (tap) todasTareasConTexto.push({ texto: tap });
        });
        // De días anteriores guardados
        Object.values(dailyAssignments).forEach(snap => {
            if (!snap.data || !snap.busTask) return;
            snap.busTask.forEach(bt => {
                let lista: any[] = [];
                if (bt.tablaIndex === 1) lista = snap.data.lubricacionMotor || [];
                else if (bt.tablaIndex === 2) lista = snap.data.engrase || [];
                else if (bt.tablaIndex === 3) lista = snap.data.diagnostico || [];
                else if (bt.tablaIndex === 4) lista = snap.data.lubricacionChasis || [];
                const item = lista.find((d: any) => d.bus === bt.bus && d.tarea === bt.tarea);
                const tap = item?.tarea_abierta_posterior;
                if (tap) todasTareasConTexto.push({ texto: tap });
            });
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

            // --- RECOPILACIÓN DE TODA LA PLANEACIÓN (TODOS LOS DÍAS) ---
            // Combinar el snapshot guardado en dailyAssignments con el día actual
            const allDays: Record<number, { busTask: Array<{ bus: string, tarea: string, tablaIndex: number }>, data: any, assignments?: Record<string, any> }> = {
                ...dailyAssignments,
                [currentDateIndex]: {
                    busTask: [...selectedBusTaskRef.current],
                    data: datosAgrupados.current,
                    assignments: { ...assignmentsRef.current }
                }
            };

            const filas: any[] = [];
            let idSolicitud = 1;
            let tareaGlobalIndex = 0;

            // Iterar por cada día que tenga datos
            Object.keys(allDays).sort((a, b) => parseInt(a) - parseInt(b)).forEach(dayKey => {
                const dayIdx = parseInt(dayKey);
                if (excludedDates[dayIdx]) return; // Skip excluded days

                const { busTask, data, assignments: dayAssignments = {} } = allDays[dayIdx];
                if (!data || !busTask || busTask.length === 0) return;

                let tareaIndexDia = 0;

                const { lubricacionMotor, lubricacionChasis, engrase, diagnostico } = data;
                const fechaPlan = dates[dayIdx] || new Date();

                // Formateador de fecha/hora para este día específico
                const formatFechaInicioLocal = (indice: number) => {
                    const totalMinutesRange = 460;
                    const minutesOffset = (indice * 10) % (totalMinutesRange + 1);
                    const startHour = 21;
                    const currentTotalMinutes = (startHour * 60 + minutesOffset) % (24 * 60);
                    const h = Math.floor(currentTotalMinutes / 60);
                    const m = currentTotalMinutes % 60;

                    // Si la hora es < 21, significa que ya es el día siguiente (madrugada)
                    const d = new Date(fechaPlan);
                    if (h < 21) d.setDate(d.getDate() + 1);

                    const padLocal = (n: number) => n.toString().padStart(2, '0');
                    return `${d.getFullYear()}-${padLocal(d.getMonth() + 1)}-${padLocal(d.getDate())} ${padLocal(h)}:${padLocal(m)}:00`;
                };

                // Agrupar por bus usando busTask
                const tareasPorBusYTabla: Record<string, { 1: TareaData[]; 2: TareaData[]; 3: TareaData[]; 4: TareaData[] }> = {};
                busTask.forEach(bt => {
                    let lista: any[] = [];
                    if (bt.tablaIndex === 1) lista = lubricacionMotor;
                    else if (bt.tablaIndex === 2) lista = engrase;
                    else if (bt.tablaIndex === 3) lista = diagnostico;
                    else if (bt.tablaIndex === 4) lista = lubricacionChasis;

                    const idx = lista.findIndex((d: any) => d.bus === bt.bus && d.tarea === bt.tarea);
                    if (idx === -1) return;
                    const item = lista[idx];
                    if (!item || item.isPlaceholder) return;

                    // Construir rowId igual que en DashboardGrid: ${tablaIndex}-${filaIndex}
                    const rowId = `${bt.tablaIndex}-${idx}`;

                    if (!tareasPorBusYTabla[item.bus]) {
                        tareasPorBusYTabla[item.bus] = { 1: [], 2: [], 3: [], 4: [] };
                    }
                    tareasPorBusYTabla[item.bus][bt.tablaIndex as 1 | 2 | 3 | 4].push({ ...item, _rowId: rowId } as any);
                });

                // Ordenar buses del día
                const busesOrdenados = Object.keys(tareasPorBusYTabla).sort((a, b) => a.localeCompare(b));

                busesOrdenados.forEach(bus => {
                    const porTabla = tareasPorBusYTabla[bus];
                    const todasLasTareas = [
                        ...porTabla[1], ...porTabla[2], ...porTabla[3], ...porTabla[4]
                    ];

                    todasLasTareas.forEach((t) => {
                        const idAdmon = extraerID((t as any).tarea_abierta_posterior);
                        const parteInfo = idAdmon ? partesMap[idAdmon] : null;
                        const taxonomiaFull = parteInfo?.taxonomia_encadenada ?? '';
                        const taxonomias = taxonomiaFull.split('|').map((txt: string) => txt.trim());

                        // Obtener las modificaciones del usuario para esta tarea
                        const rowId = (t as any)._rowId;
                        const userAssignment = (rowId && dayAssignments[rowId]) ? dayAssignments[rowId] : {};

                        // Helper: usar valor del usuario si existe, sino el de la BD
                        const getValue = (userVal: any, dbVal: any) => {
                            return (userVal !== undefined && userVal !== null && userVal !== '') ? userVal : dbVal;
                        };

                        const fechaInicioStr = getValue(userAssignment.fechaInicio, formatFechaInicioLocal(tareaIndexDia));
                        const matchPrioridad = (parteInfo?.prioridad?.toString() || '').match(/\d+/g);
                        const diasPrioridad = (matchPrioridad && matchPrioridad.length >= 2) ? parseInt(matchPrioridad[1], 10) : 0;

                        let fechaRequerida = '';
                        if (fechaInicioStr) {
                            const d = new Date(fechaInicioStr.replace(' ', 'T'));
                            if (!isNaN(d.getTime())) {
                                d.setDate(d.getDate() + diasPrioridad);
                                const pad = (n: number) => n.toString().padStart(2, '0');
                                fechaRequerida = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                            }
                        }

                        const filaBase: any = {
                            'ID SOLICITUD TRABAJO': idSolicitud,
                            'CODIGO': bus,
                            'PARTE': parteInfo?.parte ?? '',
                            'TAREA': t.tarea,
                            'FECHA PROPUESTA': parteInfo?.fecha_propuesta ?? '',
                            'FECHA INICIO (COLUMNA EDITABLE)': fechaInicioStr,
                            'NOMBRE DIA': formatDay(dates[dayIdx]).split(' ')[1] || '',
                            'FECHA REQUERIDA': fechaRequerida,
                            'MES FECHA INICIO': (dates[dayIdx].getMonth() + 1),
                            'DIA FECHA INICIO': dates[dayIdx].getDate(),
                            'MODO DETECCION': parteInfo?.modo_deteccion ?? '',
                            'CODIGO PRIORIDAD (COLUMNA EDITABLE)': getValue(userAssignment.codigoPrioridad, (parteInfo?.prioridad?.toString() || '').charAt(0) || '1'),
                            'CODIGO SUBPROCESO (COLUMNA EDITABLE)': getValue(userAssignment.codigoSubproceso, 'PREVEN'),
                            'CODIGO ZONA MAQUINA (COLUMNA EDITABLE)': getValue(userAssignment.codigoZonaMaquina, parteInfo?.zona_maquina ?? ''),
                            'CODIGO CAUSA BASICA (COLUMNA EDITABLE)': getValue(userAssignment.codigoCausaBasica, parteInfo?.causa_basica ?? ''),
                            'CODIGO RESPONSABLE (COLUMNA EDITABLE)': getValue(userAssignment.codigoResponsable, parteInfo?.codigo_responsable ?? ''),
                            'IDENTIFICACION EMPLEADO': getValue(userAssignment.codigoEmpleado, parteInfo?.identificacion_empleado ?? ''),
                            'CODIGO EMPLEADO (COLUMNA EDITABLE)': parteInfo?.empleado ?? '',
                            'TIEMPO CARACTERIZACION': parteInfo?.tiempo_caracterizacion ?? '',
                            'TIEMPO DESPLAZAMIENTO': parteInfo?.tiempo_desplazamiento ?? '',
                            'TIEMPO PLANEACION': parteInfo?.tiempo_planeacion ?? '',
                            'TIEMPO CIERRE': parteInfo?.tiempo_cierre ?? '',
                            'OBSERVACION (COLUMNA EDITABLE)': getValue(userAssignment.observacion, parteInfo?.observacion ?? ''),
                            'CODIGO ESTADO (COLUMNA EDITABLE)': 'PLA',
                            'FRECUENCIA': parteInfo?.frecuencia || t.frecuencia_tarea_ultima || '',
                            'FRECUENCIA CARACTERIZADA': parteInfo?.frecuencia_caracterizada ?? '',
                            'AGRUPACION TAREA': parteInfo?.agrupacion_tarea ?? '',
                            'TIPO POLITICA': parteInfo?.tipo_politica ?? '',
                            'POLITICA': parteInfo?.politica ?? '',
                            'VALOR VARIABLE (COLUMNA EDITABLE)': getValue(userAssignment.valorVariable, parteInfo?.valor_variable ?? ''),
                            'NRO REVISION': parteInfo?.nro_revision ?? '',
                            'NRO NOVEDAD': parteInfo?.numero_novedad ?? '',
                            'NOVEDAD': parteInfo?.novedad ?? '',
                            'EMPLEADO REPORTA NOVEDAD': parteInfo?.empleado_reporta_novedad ?? '',
                            'OBSERVACION NOVEDAD': parteInfo?.observacion_novedad ?? '',
                            'MOTIVO CAUSA PARADA': parteInfo?.motivo_causa_parada ?? '',
                            'DURACION': (parteInfo?.duracion ?? '0').split('.')[0],
                            'PORCENTAJE DURACION': parteInfo?.porcentaje_duracion ?? '',
                            'USUARIO CREADOR': parteInfo?.usuario_creador ?? '',
                            'ID TAREA SOLICITADA': parteInfo?.id_tarea_solicitada ?? '',
                            'FECHA SOLICITUD NOVEDAD': parteInfo?.fecha_solicitud_novedad ?? '',
                            'REFERENCIA INTELIGENTE PARTE': parteInfo?.referencia_inteligente ?? '',
                            'VALOR MIN VARIABLE': parteInfo?.valor_min_variable ?? '',
                            'ESTADO OPERATIVIDAD': 'VEHICULO EN MANTENIMIENTO PREVENTIVO'
                        };

                        for (let i = 1; i <= 9; i++) {
                            filaBase[`TAXONOMIA-${i}`] = taxonomias[i - 1] || '';
                        }

                        filas.push(filaBase);
                        tareaGlobalIndex++;
                        tareaIndexDia++;
                    });
                    idSolicitud++;
                });
            });

            if (filas.length === 0) {
                alert('No hay datos seleccionados en ningún día.');
                return;
            }

            // --- USO DEL WEB WORKER PARA GENERAR EL EXCEL ---
            const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

            const header = [
                'ID SOLICITUD TRABAJO', 'CODIGO', 'PARTE', 'TAREA',
                'FECHA PROPUESTA', 'FECHA INICIO (COLUMNA EDITABLE)', 'NOMBRE DIA', 'FECHA REQUERIDA', 'MES FECHA INICIO',
                'DIA FECHA INICIO', 'MODO DETECCION', 'CODIGO PRIORIDAD (COLUMNA EDITABLE)',
                'CODIGO SUBPROCESO (COLUMNA EDITABLE)', 'CODIGO ZONA MAQUINA (COLUMNA EDITABLE)', 'CODIGO CAUSA BASICA (COLUMNA EDITABLE)',
                'CODIGO RESPONSABLE (COLUMNA EDITABLE)', 'IDENTIFICACION EMPLEADO', 'CODIGO EMPLEADO (COLUMNA EDITABLE)',
                'TIEMPO CARACTERIZACION', 'TIEMPO DESPLAZAMIENTO',
                'TIEMPO PLANEACION', 'TIEMPO CIERRE', 'OBSERVACION (COLUMNA EDITABLE)',
                'CODIGO ESTADO (COLUMNA EDITABLE)', 'FRECUENCIA', 'FRECUENCIA CARACTERIZADA',
                'AGRUPACION TAREA', 'TIPO POLITICA', 'POLITICA',
                'VALOR VARIABLE (COLUMNA EDITABLE)', 'NRO REVISION', 'NRO NOVEDAD',
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
                { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
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

    const checkQuotas = () => {
        if (!datosAgrupados.current) return false;
        const selected = selectedRowsRef.current;
        const stats = { motor: new Set<string>(), chasis: new Set<string>(), engrase: new Set<string>(), diagnostico: new Set<string>() };

        selected.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            // El backend envía lubricacionMotor y lubricacionChasis en el evento
            const { lubricacionMotor, lubricacionChasis, engrase, diagnostico } = datosAgrupados.current as any;
            const data = tIdx === 1 ? lubricacionMotor : tIdx === 2 ? engrase : tIdx === 3 ? diagnostico : lubricacionChasis;
            if (data && data[fIdx] && !data[fIdx].isPlaceholder) {
                if (tIdx === 1) stats.motor.add(data[fIdx].bus);
                if (tIdx === 2) stats.engrase.add(data[fIdx].bus);
                if (tIdx === 3) stats.diagnostico.add(data[fIdx].bus);
                if (tIdx === 4) stats.chasis.add(data[fIdx].bus);
            }
        });

        let totalSeleccionados = 0;
        selected.forEach(key => {
            const [tIdx, fIdx] = key.split('-').map(Number);
            const { lubricacionMotor, lubricacionChasis, engrase, diagnostico } = datosAgrupados.current as any;
            const data = tIdx === 1 ? lubricacionMotor : tIdx === 2 ? engrase : tIdx === 3 ? diagnostico : lubricacionChasis;
            if (data && data[fIdx] && !data[fIdx].isPlaceholder) {
                totalSeleccionados++;
            }
        });

        if (totalSeleccionados < 1) {
            setQuotaAlert("Debes seleccionar al menos 1 vehículo en cualquier tabla para poder avanzar.");
            return false;
        }
        return true;
    };

    const getExcludedBuses = (skipIndex: number) => {
        const excluded = new Set<string>();
        // Solo usamos committedBuses: solo los días confirmados con "Siguiente Día" excluyen buses
        Object.entries(committedBuses).forEach(([idx, buses]) => {
            if (parseInt(idx) !== skipIndex) {
                buses.forEach(b => excluded.add(b));
            }
        });
        return Array.from(excluded);
    };

    const goToDay = (index: number, skipSave = false, committedOverride?: Record<number, string[]>) => {
        if (index === currentDateIndex) return;

        // 1. Guardar snapshot de restauración (busTask + assignments) para poder volver
        if (!skipSave) {
            const updatedDaily = {
                ...dailyAssignments,
                [currentDateIndex]: {
                    busTask: [...selectedBusTaskRef.current],
                    data: datosAgrupados.current,
                    assignments: { ...assignmentsRef.current },
                    busFilter: busFilter,
                    typeFilter: typeFilter
                }
            };
            setDailyAssignments(updatedDaily);
        }

        // 2. Determinar qué buses están comprometidos en días anteriores
        const committed = committedOverride || committedBuses;
        const excludedBuses: string[] = [];
        for (let i = 0; i < index; i++) {
            if (committed[i] && !excludedDates[i]) { // No contar buses comprometidos de días excluidos
                excludedBuses.push(...committed[i]);
            }
        }

        // 3. Recuperar snapshot del día destino
        const targetSnap = dailyAssignments[index] || { busTask: [], data: null, assignments: {}, busFilter: 'todos', typeFilter: 'todos' };

        // 4. CRÍTICO: Actualizar assignmentsRef.current para sincronizar con el día destino
        // Esto evita que los datos del día anterior se guarden en el siguiente
        assignmentsRef.current = { ...(targetSnap.assignments || {}) };

        // 5. Cambiar de día y disparar carga
        setCurrentDateIndex(index);

        // Emitir evento con la fecha seleccionada
        const selectedDate = dates[index] || new Date();
        window.dispatchEvent(new CustomEvent('dashboard-date-changed', {
            detail: { selectedDate, index }
        }));

        window.dispatchEvent(new CustomEvent('dashboard-load-day', {
            detail: {
                busTask: targetSnap.busTask || [],
                data: targetSnap.data,
                excludedBuses,
                assignments: targetSnap.assignments || {}
            }
        }));

        // 5. Restaurar estado de agrupación del día destino
        if (!targetSnap.data) {
            setHasGrouped(false);
            datosAgrupados.current = null;
        } else {
            setHasGrouped(true);
            datosAgrupados.current = targetSnap.data;
        }
    };

    const handleRightClickDate = (e: MouseEvent, index: number) => {
        e.preventDefault();

        setExcludedDates(prev => {
            const next = { ...prev, [index]: !prev[index] };

            // Si acabamos de excluir el día en el que estamos parados, 
            // movernos automáticamente al siguiente día disponible
            if (next[index] && index === currentDateIndex) {
                let nextIndex = index + 1;
                while (nextIndex < dates.length && next[nextIndex]) {
                    nextIndex++;
                }
                if (nextIndex < dates.length) {
                    setTimeout(() => goToDay(nextIndex), 0);
                } else {
                    let prevIndex = index - 1;
                    while (prevIndex >= 0 && next[prevIndex]) {
                        prevIndex--;
                    }
                    if (prevIndex >= 0) {
                        setTimeout(() => goToDay(prevIndex), 0);
                    }
                }
            }

            return next;
        });
    };

    const nextDay = () => {
        if (!checkQuotas()) return;

        if (currentDateIndex < dates.length - 1) {
            // Construir el nuevo mapa de comprometidos de forma sincrona
            const newCommitted: Record<number, string[]> = {
                ...committedBuses,
                [currentDateIndex]: [...selectedTableBusesRef.current]
            };
            setCommittedBuses(newCommitted);

            // Guardar también el snapshot del día actual para que aparezca como completado
            const newDaily = {
                ...dailyAssignments,
                [currentDateIndex]: {
                    busTask: [...selectedBusTaskRef.current],
                    data: datosAgrupados.current,
                    assignments: { ...assignmentsRef.current },
                    busFilter: busFilter,
                    typeFilter: typeFilter
                }
            };
            setDailyAssignments(newDaily);

            // Buscar el próximo día que no esté excluido
            let nextIndex = currentDateIndex + 1;
            while (nextIndex < dates.length && excludedDates[nextIndex]) {
                nextIndex++;
            }

            if (nextIndex < dates.length) {
                // Pasar newCommitted directamente para que goToDay use los buses correctos
                goToDay(nextIndex, true, newCommitted);
            } else {
                alert('Has llegado al último día no excluido de la planeación.');
            }
        } else {
            alert('Has llegado al último día de la planeación.');
        }
    };

    const handleRangeSelect = (start: Date, end: Date) => {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 7) {
            alert('El rango máximo permitido es de 7 días.');
            return;
        }

        const newDates = [];
        for (let i = 0; i < diffDays; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            newDates.push(d);
        }
        setDates(newDates);
        setCurrentDateIndex(0);
        setDailyAssignments({});
        setCommittedBuses({});
        setShowCalendar(false);

        // Emitir evento con la primera fecha seleccionada
        if (newDates.length > 0) {
            window.dispatchEvent(new CustomEvent('dashboard-date-changed', {
                detail: { selectedDate: newDates[0], index: 0 }
            }));
        }
    };

    const formatDay = (d: Date) => {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const num = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${num}/${month}/${d.getFullYear()} ${days[d.getDay()]}`;
    };

    const handleAction = async (action: string) => {
        if (loading) return;

        if (action === 'agrupar' || action === 'reagrupar') {
            const currentDayState = dailyAssignments[currentDateIndex];
            const activeBusFilter = action === 'reagrupar' ? busFilter : (currentDayState?.busFilter || busFilter);
            const activeTypeFilter = action === 'reagrupar' ? typeFilter : (currentDayState?.typeFilter || typeFilter);

            window.dispatchEvent(new CustomEvent('dashboard-agrupar', {
                detail: {
                    priority,
                    busFilter: activeBusFilter,
                    typeFilter: activeTypeFilter,
                    excludedBuses: getExcludedBuses(currentDateIndex)
                }
            }));
            return;
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
            {/* 1. Selector de Días (Si no hay fechas generadas) */}
            {dates.length === 0 && (
                <div class="relative flex items-center gap-2 mr-2">
                    <div class="flex items-center gap-2 border-r border-gray-200 pr-3">
                        <HugeiconsIcon icon={Calendar03Icon} size={14} className="text-texto-grey" />
                        <span class="text-[10px] font-black text-texto-grey uppercase tracking-widest">Planear Fechas</span>
                    </div>

                    <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-texto-dark border border-gray-200 rounded-xl text-[10px] font-bold hover:bg-gray-100 transition-colors"
                    >
                        Seleccionar Rango
                    </button>

                    {showCalendar && (
                        <div class="absolute top-full left-0 mt-2 z-50">
                            <MiniCalendarPicker onSelectRange={handleRangeSelect} />
                        </div>
                    )}
                </div>
            )}

            {/* 2. Pills de Fechas (Si hay fechas generadas) */}
            {dates.length > 0 && (
                <div class="flex items-center gap-2 mr-2 border-r pr-3 border-gray-200">
                    <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-primary" />
                    <div class="flex gap-1 overflow-x-auto max-w-[300px] sm:max-w-none no-scrollbar">
                        {dates.map((d, i) => {
                            const isExcluded = excludedDates[i];
                            const esActivo = i === currentDateIndex;
                            const esCompletado = !!committedBuses[i] && committedBuses[i].length > 0;
                            const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                            const label = `${dias[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                            return (
                                <button
                                    key={i}
                                    onClick={() => !isExcluded && goToDay(i)}
                                    onContextMenu={(e) => handleRightClickDate(e, i)}
                                    class={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all duration-200 border relative ${isExcluded
                                        ? 'bg-red-50 text-red-400 border-red-200 line-through opacity-70 hover:opacity-100 cursor-not-allowed'
                                        : esActivo
                                            ? 'bg-primary text-white shadow-md border-primary scale-105 z-10'
                                            : esCompletado
                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer'
                                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 cursor-pointer'
                                        }`}
                                    title={isExcluded ? "Día excluido (Click derecho para incluir)" : "Click derecho para excluir este día"}
                                >
                                    <div class="flex items-center gap-1.5">
                                        {isExcluded ? (
                                            <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-red-500" />
                                        ) : esCompletado && !esActivo ? (
                                            <HugeiconsIcon icon={Tick02Icon} size={10} />
                                        ) : null}
                                        <span>{label}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

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

            {hasGrouped && (
                <>
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

                    {/* Filtro por Tipología */}
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <div class="flex items-center gap-2 mr-2 border-r border-gray-200 pr-3">
                            <HugeiconsIcon icon={ViewIcon} size={14} className="text-texto-grey" />
                            <span class="text-[10px] font-black text-texto-grey uppercase tracking-widest">Tipo</span>
                        </div>
                        {[
                            { id: 'todos', label: 'Todos' },
                            { id: 'RUNNER', label: 'Runner' },
                            { id: 'AGRALE', label: 'Agrale' },
                            { id: 'NPR', label: 'NPR' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTypeFilter(t.id as any)}
                                class={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border ${typeFilter === t.id
                                    ? 'bg-white shadow-sm border-gray-200 text-primary scale-105'
                                    : 'border-transparent text-texto-grey hover:bg-white hover:text-texto-dark'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {hasGrouped ? (
                (() => {
                    // Check if we are on the last valid (not excluded) day
                    let isLastValidDay = true;
                    if (dates.length > 0) {
                        for (let i = currentDateIndex + 1; i < dates.length; i++) {
                            if (!excludedDates[i]) {
                                isLastValidDay = false;
                                break;
                            }
                        }
                    } else {
                        isLastValidDay = false;
                    }

                    return (
                        <>
                            {renderButton('reagrupar', 'Volver a Agrupar', RefreshIcon)}

                            {dates.length > 0 ? (
                                isLastValidDay ? (
                                    <button
                                        onClick={async () => {
                                            // Guardar el estado actual antes de generar el Excel
                                            const updatedDaily = {
                                                ...dailyAssignments,
                                                [currentDateIndex]: {
                                                    busTask: [...selectedBusTaskRef.current],
                                                    data: datosAgrupados.current,
                                                    assignments: { ...assignmentsRef.current }
                                                }
                                            };
                                            setDailyAssignments(updatedDaily);

                                            // Dar tiempo a que el estado se actualice antes de generar
                                            setTimeout(() => handleAction('generar'), 0);
                                        }}
                                        disabled={!!loading}
                                        class={`relative flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-xs font-bold transition-all duration-300 min-w-[140px] overflow-hidden ml-auto ${success === 'generar'
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                            : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/30 active:scale-95'
                                            }`}
                                    >
                                        <div class="flex items-center gap-2 relative z-10">
                                            {loading === 'generar' ? (
                                                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : success === 'generar' ? (
                                                <HugeiconsIcon icon={Tick02Icon} size={18} />
                                            ) : (
                                                <HugeiconsIcon icon={PlayIcon} size={18} />
                                            )}
                                            <span>Generar Vista</span>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        onClick={nextDay}
                                        class="relative flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-xs font-bold transition-all duration-300 min-w-[140px] overflow-hidden bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/30 active:scale-95 ml-auto"
                                    >
                                        <div class="flex items-center gap-2">
                                            <span>Siguiente Día</span>
                                            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
                                        </div>
                                    </button>
                                )
                            ) : (
                                renderButton('generar', 'Generar Vista', PlayIcon)
                            )}
                        </>
                    );
                })()
            ) : (
                <>
                    <button
                        onClick={() => handleAction('agrupar')}
                        disabled={dates.length === 0}
                        title={dates.length === 0 ? "Selecciona un rango de fechas primero" : "Agrupar"}
                        class="relative flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-xs font-bold transition-all duration-300 min-w-[140px] overflow-hidden bg-primary text-white hover:shadow-lg hover:shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                    >
                        <div class="flex items-center gap-2">
                            <HugeiconsIcon icon={Layers01Icon} size={18} />
                            <span>Agrupar</span>
                        </div>
                    </button>
                </>
            )}

            {/* Modal de Alerta de Cuotas */}
            {quotaAlert && (
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div
                        class="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div class="p-8 flex flex-col items-center text-center">
                            <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                                <HugeiconsIcon icon={ZapIcon} size={32} className="text-orange-500" />
                            </div>

                            <h3 class="text-lg font-bold text-gray-900 mb-2">
                                ¡Atención Requerida!
                            </h3>

                            <p class="text-sm text-gray-500 leading-relaxed">
                                {quotaAlert}
                            </p>
                        </div>

                        <div class="p-4 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setQuotaAlert(null)}
                                class="flex-1 py-3 px-4 bg-primary text-white rounded-2xl text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
                            >
                                Entendido, lo revisaré
                            </button>
                        </div>
                    </div>
                </div>
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
