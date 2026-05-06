import { useState } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface MiniCalendarPickerProps {
    onSelectRange: (start: Date, end: Date) => void;
}

export default function MiniCalendarPicker({ onSelectRange }: MiniCalendarPickerProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewYear, viewMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewYear, viewMonth + 1, 1));
    };

    // Generar días del mes
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo

    const days = [];
    // Rellenar días del mes anterior
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        days.push({
            date: new Date(viewYear, viewMonth - 1, prevMonthDays - i),
            isCurrentMonth: false
        });
    }
    // Rellenar días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            date: new Date(viewYear, viewMonth, i),
            isCurrentMonth: true
        });
    }
    // Rellenar días del mes siguiente (para completar la cuadrícula de 42 días, 6 filas)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
        days.push({
            date: new Date(viewYear, viewMonth + 1, i),
            isCurrentMonth: false
        });
    }

    const handleDayClick = (date: Date) => {
        if (date < today) return; // No permitir pasado

        if (!startDate || (startDate && endDate)) {
            // Empezar nueva selección
            setStartDate(date);
            setEndDate(null);
        } else {
            // Si hace clic en una fecha anterior a la de inicio, reiniciar a esta nueva fecha
            if (date < startDate) {
                setStartDate(date);
                return;
            }

            const diffDays = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
            if (diffDays > 7) {
                // Ignore click completely to force visual constraint
                return; 
            }

            setEndDate(date);
            onSelectRange(startDate, date);
        }
    };

    const isSameDay = (d1: Date | null, d2: Date | null) => {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const dayNames = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

    return (
        <div class="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 w-72 select-none z-50 animate-fade-in relative">
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
                </button>
                <div class="text-sm font-black text-texto-dark uppercase tracking-wider">
                    {monthNames[viewMonth]} {viewYear}
                </div>
                <button onClick={handleNextMonth} class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
                </button>
            </div>
            
            {/* Days Header */}
            <div class="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                    <div key={day} class="text-center text-[11px] font-black text-texto-grey uppercase">{day}</div>
                ))}
            </div>
            
            {/* Grid */}
            <div class="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHoverDate(null)}>
                {days.map((dayObj, i) => {
                    const isPast = dayObj.date < today;
                    const isSelectedStart = isSameDay(dayObj.date, startDate);
                    const isSelectedEnd = isSameDay(dayObj.date, endDate);

                    // Restricción visual dinámica: ¿está fuera del límite de 7 días?
                    let isExceedingLimit = false;
                    if (startDate && !endDate && !isPast && dayObj.date > startDate) {
                        const diff = Math.floor((dayObj.date.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
                        if (diff > 7) isExceedingLimit = true;
                    }

                    // Determinar si está en el rango visual del hover
                    let inRange = false;
                    if (startDate && endDate) {
                        inRange = dayObj.date > startDate && dayObj.date < endDate;
                    } else if (startDate && hoverDate && !isExceedingLimit && dayObj.date > startDate && dayObj.date <= hoverDate) {
                        inRange = true;
                    }

                    let bgClass = "bg-transparent";
                    let textClass = "text-texto-dark";
                    let hoverClass = "hover:bg-gray-100 cursor-pointer";
                    let roundedClass = "rounded-lg";
                    let opacityClass = "opacity-100";

                    if (isPast) {
                        textClass = "text-gray-300";
                        hoverClass = "cursor-not-allowed";
                    } else if (!dayObj.isCurrentMonth) {
                        textClass = "text-gray-400";
                    }

                    if (isExceedingLimit) {
                        // Día futuro que excede los 7 días
                        textClass = "text-gray-300";
                        hoverClass = "cursor-not-allowed";
                        opacityClass = "opacity-50";
                    }

                    if (!isPast && !isExceedingLimit) {
                        if (isSelectedStart || isSelectedEnd) {
                            bgClass = "bg-primary";
                            textClass = "text-white font-bold";
                        } else if (inRange) {
                            bgClass = "bg-primary/10";
                            textClass = "text-primary font-bold";
                            roundedClass = "rounded-none";
                        }
                    }

                    return (
                        <div 
                            key={i}
                            onClick={() => handleDayClick(dayObj.date)}
                            onMouseEnter={() => setHoverDate(dayObj.date)}
                            class={`flex items-center justify-center h-8 text-xs transition-colors ${bgClass} ${textClass} ${hoverClass} ${roundedClass} ${opacityClass}`}
                        >
                            {dayObj.date.getDate()}
                        </div>
                    );
                })}
            </div>
            
            {/* Feedback Footer */}
            {!startDate && (
                <div class="mt-3 text-[10px] text-center text-texto-grey font-bold">
                    Selecciona fecha de inicio
                </div>
            )}
            {startDate && !endDate && (
                <div class="mt-3 text-[10px] text-center text-primary font-bold">
                    Selecciona fecha de fin (Máximo 7 días)
                </div>
            )}
        </div>
    );
}
