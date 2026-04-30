import { useState, useMemo, useEffect } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import Modal from '../ui/Modal';
import {
    ArrowUp01Icon,
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Search01Icon
} from '@hugeicons/core-free-icons';

interface DataItem {
    id: number;
    bus: string;
    tarea: string;
    estado: string;
    frecuencia_tarea_ultima?: string;
    dato_hoy?: string;
}

export default function OperationsTable() {
    const [data, setData] = useState<DataItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: keyof DataItem, direction: 'asc' | 'desc' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchReports = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login';
                return;
            }

            try {
                const res = await fetch('http://localhost:4000/api/reports', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    if (res.status === 401) window.location.href = '/login';
                    throw new Error('Error al cargar reportes');
                }

                const result = await res.json();
                // Asignar ID temporal si no viene de la base de datos para el key del map
                const mappedData = (result || []).map((item: any, index: number) => ({
                    id: index + 1,
                    ...item
                }));
                setData(mappedData);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.bus?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.tarea?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const currentItems = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const requestSort = (key: keyof DataItem) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const [isModalOpen, setIsModalOpen] = useState(false);

    const getStatusStyle = (estado: string) => {
        const e = estado.toLowerCase();
        if (e.includes('vencida')) return 'bg-red-50 text-red-600 border-red-100';
        if (e.includes('proximo')) return 'bg-orange-50 text-orange-600 border-orange-100';
        if (e.includes('en tiempo')) return 'bg-green-50 text-green-600 border-green-100';
        return 'bg-gray-50 text-gray-600 border-gray-100';
    };

    return (
        <div class={`bg-white rounded-[32px] shadow-premium border border-gray-100 overflow-hidden flex flex-col h-full animate-fade-in relative ${isModalOpen ? 'z-[9999]' : 'z-0'}`}>
            {/* Header */}
            <div class="p-5 border-b border-gray-50">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold text-texto-dark leading-tight">Operaciones Hoy</h3>
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span class="text-[10px] font-bold text-primary uppercase tracking-widest">En Vivo</span>
                    </div>
                </div>
                <div class="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-grey group-focus-within:text-primary transition-colors">
                        <HugeiconsIcon icon={Search01Icon} size={14} />
                    </div>
                    <input
                        type="text"
                        placeholder="Filtrar por Bus o Tarea..."
                        value={searchTerm}
                        onInput={(e) => {
                            setSearchTerm((e.target as HTMLInputElement).value);
                            setCurrentPage(1);
                        }}
                        class="pl-10 pr-3 py-2.5 bg-fondo-soft border-2 border-transparent rounded-xl text-xs font-medium transition-all focus:outline-none focus:bg-white focus:border-primary w-full"
                    />
                </div>
            </div>

            <div class="flex-1 overflow-y-auto scroll-premium">
                {isLoading ? (
                    <div class="flex flex-col">
                        <table class="w-full text-left">
                            <thead class="bg-fondo-soft/50 border-b border-gray-50">
                                <tr>
                                    <th class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider">Bus</th>
                                    <th class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider">Tarea</th>
                                    <th class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider">Ultima Frec.</th>
                                    <th class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider">Dato Hoy</th>
                                    <th class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                {[...Array(10)].map((_, i) => (
                                    <tr key={i}>
                                        <td class="px-5 py-5"><div class="h-5 bg-gray-200 rounded-md animate-pulse-shimmer w-20"></div></td>
                                        <td class="px-5 py-5"><div class="h-4 bg-gray-100 rounded-md animate-pulse-shimmer w-full"></div></td>
                                        <td class="px-5 py-5"><div class="h-4 bg-gray-100 rounded-md animate-pulse-shimmer w-16"></div></td>
                                        <td class="px-5 py-5"><div class="h-4 bg-gray-100 rounded-md animate-pulse-shimmer w-16"></div></td>
                                        <td class="px-5 py-5"><div class="h-6 bg-gray-200 rounded-lg animate-pulse-shimmer w-24"></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : sortedData.length === 0 ? (
                    <div class="flex flex-col items-center justify-center h-full py-20 opacity-40">
                        <HugeiconsIcon icon={Search01Icon} size={40} />
                        <p class="text-xs font-bold mt-4 uppercase tracking-tighter">No se encontraron registros</p>
                    </div>
                ) : (
                    <table class="w-full text-left">
                        <thead class="sticky top-0 bg-white z-10">
                            <tr class="bg-fondo-soft/50 border-b border-gray-50">
                                {[
                                    { label: 'Bus', key: 'bus' },
                                    { label: 'Tarea', key: 'tarea' },
                                    { label: 'Ultima Frec.', key: 'frecuencia_tarea_ultima' },
                                    { label: 'Dato Hoy', key: 'dato_hoy' },
                                    { label: 'Estado', key: 'estado' },
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => requestSort(col.key as keyof DataItem)}
                                        class="px-5 py-4 text-[10px] font-extrabold text-texto-grey uppercase tracking-wider cursor-pointer hover:text-primary transition-colors select-none group"
                                    >
                                        <div class="flex items-center gap-2">
                                            {col.label}
                                            <div class={`transition-all duration-300 ${sortConfig?.key === col.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                                                {sortConfig?.key === col.key && sortConfig.direction === 'desc' ? (
                                                    <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                                                ) : (
                                                    <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            {currentItems.map((item) => (
                                <tr key={item.id} class="hover:bg-fondo-soft/30 transition-all duration-200 group">
                                    <td class="px-5 py-4">
                                        <span class="font-bold text-sm text-texto-dark">{item.bus}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <p class="text-[11px] text-texto-grey font-semibold break-words" title={item.tarea}>
                                            {item.tarea}
                                        </p>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="text-[10px] text-texto-grey font-bold">{item.frecuencia_tarea_ultima || '---'}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="text-[10px] text-texto-grey font-bold">{item.dato_hoy || '---'}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all ${getStatusStyle(item.estado)}`}>
                                            {item.estado}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Compact */}
            <div class="px-5 py-4 border-t border-gray-50 bg-fondo-soft/10 flex items-center justify-between">
                <span class="text-[9px] font-bold text-texto-grey uppercase tracking-widest">
                    Total: <span class="text-texto-dark">{sortedData.length}</span>
                </span>
                <div class="flex items-center gap-1.5">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        class="p-1.5 rounded-lg bg-white border border-gray-100 text-texto-grey hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                    </button>
                    <span class="text-[10px] font-bold text-texto-dark px-2">{currentPage} / {totalPages || 1}</span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        class="p-1.5 rounded-lg bg-white border border-gray-100 text-texto-grey hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </button>
                </div>
            </div>

            <style>{`
                .scroll-premium::-webkit-scrollbar { width: 4px; }
                .scroll-premium::-webkit-scrollbar-track { background: transparent; }
                .scroll-premium::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

                @keyframes pulse-shimmer {
                    0% { background-color: #f3f4f6; }
                    50% { background-color: #e5e7eb; }
                    100% { background-color: #f3f4f6; }
                }
                .animate-pulse-shimmer {
                    animation: pulse-shimmer 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    );
}
