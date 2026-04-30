import { useEffect } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: any;
    maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-4xl' }: ModalProps) {
    // Cerrar con escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEsc);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Overlay Animado */}
            <div 
                class="absolute inset-0 bg-texto-dark/40 backdrop-blur-[6px] animate-fade-in" 
                onClick={onClose}
            ></div>

            {/* Contenido del Modal */}
            <div 
                class={`relative w-full ${maxWidth} bg-white rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh] overflow-hidden animate-pop-in border border-white/20`}
            >
                {/* Header Premium */}
                <div class="flex items-center justify-between p-6 sm:px-8 border-b border-gray-50">
                    <div class="flex items-center gap-3">
                        <div class="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(76,194,83,0.4)]"></div>
                        <h2 class="text-xl font-bold text-texto-dark tracking-tight">{title}</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        class="w-10 h-10 flex items-center justify-center rounded-2xl bg-fondo-soft text-texto-grey hover:bg-red-50 hover:text-red-500 hover:rotate-90 transition-all duration-300 active:scale-90 group"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} size={20} />
                    </button>
                </div>

                {/* Body con Scroll Personalizado */}
                <div class="flex-1 overflow-y-auto p-6 sm:p-8 scroll-premium">
                    {children}
                </div>

                {/* Footer Opcional / Decorativo */}
                <div class="px-8 py-4 bg-gray-50/50 border-t border-gray-50 flex justify-end">
                    <button 
                        onClick={onClose}
                        class="px-6 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-texto-grey hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
                    >
                        Cerrar Ventana
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes pop-in {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out forwards;
                }
                .animate-pop-in {
                    animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                .scroll-premium::-webkit-scrollbar {
                    width: 6px;
                }
                .scroll-premium::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scroll-premium::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .scroll-premium::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
