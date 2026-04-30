import { useState, useRef, useEffect } from 'preact/hooks';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    UserIcon,
    Logout01Icon
} from '@hugeicons/core-free-icons';

export default function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [userData, setUserData] = useState<{ nombre: string; cargo: string } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;

            try {
                const res = await fetch('http://localhost:4000/api/auth/get-data', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.done) {
                    setUserData(data.data);
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
            }
        };

        fetchUserData();

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full transition-all duration-400 border-2 group ${isOpen
                    ? 'bg-primary border-primary text-white shadow-[0_10px_25px_-5px_rgba(76,194,83,0.4)]'
                    : 'bg-white border-gray-100 text-texto-grey hover:border-primary/40 hover:shadow-lg hover:shadow-gray-200/50'
                    }`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-white/20 rotate-12 scale-110' : 'bg-primary/10 text-primary group-hover:scale-110'}`}>
                    <HugeiconsIcon icon={UserIcon} size={18} />
                </div>
                <div className="flex flex-col items-start leading-none pr-1">
                    <span className={`text-[11px] font-bold transition-colors ${isOpen ? 'text-white' : 'text-texto-dark'}`}>
                        {userData?.nombre || 'Cargando...'}
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase tracking-widest mt-1 opacity-60 ${isOpen ? 'text-white' : 'text-texto-grey'}`}>
                        {userData?.cargo || 'SAO6'}
                    </span>
                </div>
            </button>

            {/* Dropdown Menu Premium */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-3 w-56 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-2 z-50 animate-pop-in origin-top-right overflow-hidden"
                >
                    <div className="px-4 py-3 mb-1 border-b border-gray-50">
                        <p className="text-[10px] font-bold text-texto-grey uppercase tracking-tighter">Usuario</p>
                        <p className="text-xs font-bold text-primary truncate mt-0.5">{userData?.nombre}</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all text-xs font-bold group"
                    >
                        <div className="flex items-center gap-3">
                            <HugeiconsIcon icon={Logout01Icon} size={16} className="group-hover:translate-x-1 transition-transform" />
                            <span>Cerrar Sesión</span>
                        </div>
                    </button>
                </div>
            )}

            <style>{`
                @keyframes pop-in {
                    from { opacity: 0; transform: scale(0.9) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-pop-in {
                    animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}</style>
        </div>
    );
}
